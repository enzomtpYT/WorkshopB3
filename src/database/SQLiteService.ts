import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

export interface SQLiteResult {
  rows: {
    length: number;
    item: (index: number) => any;
    raw: () => any[];
  };
  insertId?: number;
  rowsAffected: number;
}

export interface Message {
  _id: string;
  message: string;
  timestamp: number;
  sender: string;
  isSent: boolean;
  senderIp?: string;
  isEncrypted?: boolean;        // Indique si le message est chiffré
  encryptionTarget?: string;    // Username du destinataire
  decryptionFailed?: boolean;   // Indique si le déchiffrement a échoué
  originalEncrypted?: string;   // Le message chiffré original pour déchiffrement ultérieur
  originalMessage?: string;     // Le message original non chiffré (pour les messages envoyés)
  lastUpdated?: number;         // Timestamp de dernière mise à jour (pour forcer le re-render)
}

class SQLiteService {
  private db: SQLiteDatabase | null = null;

  async executeQuery(query: string, params: any[] = []): Promise<SQLiteResult> {
    if (!this.db) {
      await this.init();
    }

    try {
      const [result] = await this.db!.executeSql(query, params);
      return result;
    } catch (error) {
      console.error('SQL Error:', error);
      throw error;
    }
  }

  async init(): Promise<void> {
    try {
      this.db = await SQLite.openDatabase({
        name: 'broadcast.db',
        location: 'default',
      });

      // Vérifier si la table messages existe et si elle est complète
      const [tableCheck] = await this.db.executeSql(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='messages'"
      );

      if (tableCheck.rows.length > 0) {
        // La table existe, vérifier si elle a toutes les colonnes nécessaires
        const [columnsCheck] = await this.db.executeSql("PRAGMA table_info(messages)");
        
        const existingColumns: string[] = [];
        for (let i = 0; i < columnsCheck.rows.length; i++) {
          existingColumns.push(columnsCheck.rows.item(i).name);
        }

        const requiredColumns = [
          'id', 'message', 'timestamp', 'sender', 'isSent', 'senderIp',
          'isEncrypted', 'encryptionTarget', 'decryptionFailed', 'originalEncrypted', 'originalMessage'
        ];

        const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

        if (missingColumns.length > 0) {

          
          // Supprimer la table incomplète
          await this.db.executeSql('DROP TABLE IF EXISTS messages');
        } else {

          return; // Table complète, rien à faire
        }
      }

      // Créer la table (soit elle n'existait pas, soit elle était incomplète et a été supprimée)
      await this.db.executeSql(
        `CREATE TABLE messages (
          id TEXT PRIMARY KEY,
          message TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          sender TEXT NOT NULL,
          isSent INTEGER DEFAULT 0,
          senderIp TEXT,
          isEncrypted INTEGER DEFAULT 0,
          encryptionTarget TEXT,
          decryptionFailed INTEGER DEFAULT 0,
          originalEncrypted TEXT,
          originalMessage TEXT
        )`
      );
      await sqliteService.executeQuery(
      `CREATE TABLE IF NOT EXISTS users (
        mac_address TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        encryption_key TEXT NOT NULL
      )`
    );


    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  async saveMessage(messageData: Omit<Message, '_id'>): Promise<string> {
    if (!this.db) {
      await this.init();
    }

    try {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);

      await this.db!.executeSql(
        `INSERT INTO messages (
          id, message, timestamp, sender, isSent, senderIp, 
          isEncrypted, encryptionTarget, decryptionFailed, originalEncrypted, originalMessage
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          messageData.message,
          messageData.timestamp,
          messageData.sender,
          messageData.isSent ? 1 : 0,
          messageData.senderIp || null,
          messageData.isEncrypted ? 1 : 0,
          messageData.encryptionTarget || null,
          messageData.decryptionFailed ? 1 : 0,
          messageData.originalEncrypted || null,
          messageData.originalMessage || null,
        ]
      );


      return id;
    } catch (error) {
      console.error('Save message error:', error);
      throw error;
    }
  }

  async getAllMessages(): Promise<Message[]> {
    if (!this.db) {
      await this.init();
    }

    try {
      const [results] = await this.db!.executeSql(
        'SELECT * FROM messages ORDER BY timestamp ASC'
      );

      const messages: Message[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        const row = results.rows.item(i);
        const isEncrypted = row.isEncrypted === 1;
        const isSent = row.isSent === 1;
        
        messages.push({
          _id: row.id,
          // Pour les messages envoyés chiffrés, afficher le message original décrypté avec icône
          message: isEncrypted && isSent && row.originalMessage ? `🔒 ${row.originalMessage}` : row.message,
          timestamp: row.timestamp,
          sender: row.sender,
          isSent: isSent,
          senderIp: row.senderIp,
          isEncrypted: isEncrypted,
          encryptionTarget: row.encryptionTarget,
          decryptionFailed: row.decryptionFailed === 1,
          originalEncrypted: row.originalEncrypted,
          originalMessage: row.originalMessage,
        });
      }

      return messages;
    } catch (error) {
      console.error('Get messages error:', error);
      throw error;
    }
  }

  async updateMessage(messageId: string, updates: Partial<Omit<Message, '_id'>>): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    try {
      const setParts: string[] = [];
      const params: any[] = [];

      // Construire dynamiquement la requête UPDATE
      Object.entries(updates).forEach(([key, value]) => {
        setParts.push(`${key} = ?`);
        params.push(value);
      });

      if (setParts.length === 0) {
        return; // Rien à mettre à jour
      }

      const query = `UPDATE messages SET ${setParts.join(', ')} WHERE id = ?`;
      params.push(messageId);

      await this.db!.executeSql(query, params);

    } catch (error) {
      console.error('Update message error:', error);
      throw error;
    }
  }

  async clearAllMessages(): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    try {
      await this.db!.executeSql('DELETE FROM messages');

    } catch (error) {
      console.error('Clear messages error:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      await this.db.close();
      this.db = null;

    } catch (error) {
      console.error('Database close error:', error);
      throw error;
    }
  }
}

// Créer et exporter une instance unique du service
export const sqliteService = new SQLiteService();
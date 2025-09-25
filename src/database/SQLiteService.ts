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
}

class SQLiteService {
  private db: SQLiteDatabase | null = null;

  async executeQuery(query: string, params: any[] = []): Promise<SQLiteResult> {
    if (!this.db) {
      console.log('trop tôt');
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
          console.log(`Table incomplete, missing columns: ${missingColumns.join(', ')}`);
          console.log('Dropping and recreating table...');
          
          // Supprimer la table incomplète
          await this.db.executeSql('DROP TABLE IF EXISTS messages');
        } else {
          console.log('Table messages is complete, no need to recreate');
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

      console.log('Database initialized successfully');
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

      console.log('Message saved successfully');
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
        messages.push({
          _id: row.id,
          message: row.message,
          timestamp: row.timestamp,
          sender: row.sender,
          isSent: row.isSent === 1,
          senderIp: row.senderIp,
          isEncrypted: row.isEncrypted === 1,
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

  async clearAllMessages(): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    try {
      await this.db!.executeSql('DELETE FROM messages');
      console.log('All messages cleared');
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
      console.log('Database closed');
    } catch (error) {
      console.error('Database close error:', error);
      throw error;
    }
  }
}

// Créer et exporter une instance unique du service
export const sqliteService = new SQLiteService();
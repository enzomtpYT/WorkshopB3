import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';

export interface Message {
  _id: string;
  message: string;
  timestamp: number;
  sender: string;
  isSent: boolean;
  senderIp?: string;
  isEncrypted?: boolean;        // NOUVEAU: Indique si le message est chiffré
  encryptionTarget?: string;    // NOUVEAU: Username du destinataire
  decryptionFailed?: boolean;   // NOUVEAU: Indique si le déchiffrement a échoué
}

export interface SQLiteResult {
  rows: {
    length: number;
    item: (index: number) => any;
    raw: () => any[];
  };
  insertId?: number;
  rowsAffected: number;
}

export default class SQLiteService {
  private db: SQLiteDatabase | null = null;

  async executeQuery(query: string, params: any[] = []): Promise<SQLiteResult> {
    if (!this.db) {
      await this.init();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      this.db!.transaction((tx) => {
        tx.executeSql(
          query,
          params,
          (_, result) => resolve(result),
          (_, error) => {
            console.error('SQL Error:', error);
            reject(error);
            return false;
          }
        );
      });
    });
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      SQLite.enablePromise(true);
      SQLite.openDatabase(
        {
          name: 'broadcast.db',
          location: 'default',
        },
        (database) => {
          this.db = database;
          this.createTable().then(resolve).catch(reject);
        },
        (error) => {
          console.error('Database open error:', error);
          reject(error);
        }
      );
    });
  }

  private createTable(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction(
        (tx) => {
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS messages (
              id TEXT PRIMARY KEY,
              message TEXT NOT NULL,
              timestamp TEXT NOT NULL,
              sender TEXT NOT NULL,
              isSent INTEGER DEFAULT 0,
              senderIp TEXT,
              isEncrypted INTEGER DEFAULT 0,
              encryptionTarget TEXT,
              decryptionFailed INTEGER DEFAULT 0
            )`,
            [],
            () => {
              console.log('Messages table created successfully');
            },
            (error) => {
              console.error('Create table error:', error);
              return false;
            }
          );
        },
        (error) => {
          console.error('Transaction error:', error);
          reject(error);
        },
        () => {
          resolve();
        }
      );
    });
  }

  async saveMessage(messageData: Omit<Message, '_id'>): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);

      this.db.transaction(
        (tx) => {
          tx.executeSql(
            `INSERT INTO messages (
              id, message, timestamp, sender, isSent, senderIp, 
              isEncrypted, encryptionTarget, decryptionFailed
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            ],
            () => {
              console.log('Message saved successfully');
              resolve(id);
            },
            (error) => {
              console.error('Save message error:', error);
              return false;
            }
          );
        },
        (error) => {
          console.error('Transaction error:', error);
          reject(error);
        }
      );
    });
  }

  async getAllMessages(): Promise<Message[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction(
        (tx) => {
          tx.executeSql(
            'SELECT * FROM messages ORDER BY timestamp ASC',
            [],
            (txx, results) => {
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
                });
              }
              resolve(messages);
            },
            (error) => {
              console.error('Get messages error:', error);
              return false;
            }
          );
        },
        (error) => {
          console.error('Transaction error:', error);
          reject(error);
        }
      );
    });
  }

  async clearAllMessages(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction(
        (tx) => {
          tx.executeSql(
            'DELETE FROM messages',
            [],
            () => {
              console.log('All messages cleared');
              resolve();
            },
            (error) => {
              console.error('Clear messages error:', error);
              return false;
            }
          );
        },
        (error) => {
          console.error('Transaction error:', error);
          reject(error);
        }
      );
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db.close(
        () => {
          console.log('Database closed');
          this.db = null;
          resolve();
        },
        (error) => {
          console.error('Database close error:', error);
          reject(error);
        }
      );
    });
  }
}

export const sqliteService = new SQLiteService();
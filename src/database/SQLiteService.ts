import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';

export interface Message {
  _id: string;
  message: string;
  timestamp: string;
  sender: string;
  isSent: boolean;
  senderIp?: string;
}

class SQLiteService {
  private db: SQLiteDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      SQLite.openDatabase(
        {
          name: 'broadcast.db',
          location: 'default',
          createFromLocation: '~www/broadcast.db',
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
              senderIp TEXT
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

      const id = Date.now().toString() + Math.random().toString(36);

      this.db.transaction(
        (tx) => {
          tx.executeSql(
            'INSERT INTO messages (id, message, timestamp, sender, isSent, senderIp) VALUES (?, ?, ?, ?, ?, ?)',
            [
              id,
              messageData.message,
              messageData.timestamp,
              messageData.sender,
              messageData.isSent ? 1 : 0,
              messageData.senderIp || null,
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
            (tx, results) => {
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
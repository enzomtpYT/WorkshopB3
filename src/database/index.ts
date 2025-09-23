import Realm from 'realm';
import { MessageSchema } from './schemas/MessageSchema';

class DatabaseManager {
  private realm: Realm | null = null;

  async initialize(): Promise<void> {
    try {
      this.realm = await Realm.open({
        schema: [MessageSchema],
        schemaVersion: 1,
      });
      console.log('Realm database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Realm database:', error);
      throw error;
    }
  }

  getRealm(): Realm {
    if (!this.realm) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.realm;
  }

  close(): void {
    if (this.realm) {
      this.realm.close();
      this.realm = null;
    }
  }
}

export const databaseManager = new DatabaseManager();
export { MessageSchema };
import Realm from 'realm';
import { databaseManager, MessageSchema } from '../database';

export interface MessageData {
  message: string;
  timestamp: Date;
  sender: string;
  isSent: boolean;
  senderIp?: string;
}

export class MessageService {
  private getRealm(): Realm {
    return databaseManager.getRealm();
  }

  // Sauvegarder un message
  saveMessage(messageData: MessageData): MessageSchema {
    const realm = this.getRealm();
    let savedMessage: MessageSchema;

    realm.write(() => {
      savedMessage = realm.create('Message', {
        _id: new Realm.BSON.ObjectId(),
        ...messageData,
      });
    });

    return savedMessage!;
  }

  // Récupérer tous les messages triés par timestamp
  getAllMessages(): Realm.Results<MessageSchema> {
    const realm = this.getRealm();
    return realm.objects('Message').sorted('timestamp');
  }

  // Supprimer tous les messages
  clearAllMessages(): void {
    const realm = this.getRealm();
    const allMessages = realm.objects('Message');
    
    realm.write(() => {
      realm.delete(allMessages);
    });
  }

  // Supprimer un message spécifique
  deleteMessage(messageId: Realm.BSON.ObjectId): void {
    const realm = this.getRealm();
    const message = realm.objectForPrimaryKey('Message', messageId);
    
    if (message) {
      realm.write(() => {
        realm.delete(message);
      });
    }
  }

  // Rechercher des messages
  searchMessages(query: string): Realm.Results<MessageSchema> {
    const realm = this.getRealm();
    return realm
      .objects('Message')
      .filtered('message CONTAINS[c] $0 OR sender CONTAINS[c] $0', query)
      .sorted('timestamp', true);
  }
}

export const messageService = new MessageService();
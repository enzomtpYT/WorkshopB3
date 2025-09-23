import Realm from 'realm';

export class MessageSchema extends Realm.Object<MessageSchema> {
  _id!: Realm.BSON.ObjectId;
  message!: string;
  timestamp!: Date;
  sender!: string;
  isSent!: boolean;
  senderIp?: string;

  static schema: Realm.ObjectSchema = {
    name: 'Message',
    primaryKey: '_id',
    properties: {
      _id: 'objectId',
      message: 'string',
      timestamp: 'date',
      sender: 'string',
      isSent: { type: 'bool', default: false },
      senderIp: 'string?',
    },
  };
}
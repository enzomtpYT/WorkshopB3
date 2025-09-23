export interface Message {
  _id: string;
  message: string;
  timestamp: Date;
  sender: string;
  isSent: boolean;
  senderIp?: string;
}

// Helper pour convertir Realm Object vers interface plain
export function messageToPlain(realmMessage: any): Message {
  return {
    _id: realmMessage._id.toString(),
    message: realmMessage.message,
    timestamp: realmMessage.timestamp,
    sender: realmMessage.sender,
    isSent: realmMessage.isSent,
    senderIp: realmMessage.senderIp,
  };
}
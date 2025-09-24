// ShowTimestamp.ts
type ChatMessage = {
  message: string;
  timestamp: number; // ms
  sender: string;
  isSent?: boolean;
};

export const FIVE_MIN = 5 * 60 * 1000;

export function computeShowTimestampFlags(msgs: ChatMessage[]): boolean[] {
  return msgs.map((msg, i) => {
    const currAuthor = msg.isSent ? 'You' : msg.sender;
    const next = msgs[i + 1];
    if (!next) return true; // dernier -> afficher heure

    const nextAuthor = next.isSent ? 'You' : next.sender;
    const sameAuthor = nextAuthor === currAuthor;
    const withinWindow = next.timestamp - msg.timestamp <= FIVE_MIN;

    // si le suivant est du même auteur dans les 5 min => PAS d'heure sur celui-ci
    return !(sameAuthor && withinWindow);
  });
}
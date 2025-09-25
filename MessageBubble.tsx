import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text as PaperText } from 'react-native-paper';
import { createMessageBubbleStyles } from './style/MessageBubbleStyles';
import { Message } from './src/database/SQLiteService'; // AJOUTER: Import du bon type

// SUPPRIMER: L'ancien type
// type Msg = {
//   message: string;
//   timestamp: number;
//   sender: string;
//   isSent?: boolean;
// };

function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

const GAP = 8;

const MessageBubble: React.FC<{
  msg: Message;
  showTime: boolean;
  theme: any;
  onEncryptedMessagePress?: (message: Message) => void; // Nouveau: callback pour le clic
}> = ({ msg, showTime, theme, onEncryptedMessagePress }) => {
  const timeStr = formatTime(msg.timestamp); // CHANGER: timestamp est string

  // Mesures
  const [lastLineWidth, setLastLineWidth] = React.useState(0);
  const [textBoxWidth, setTextBoxWidth] = React.useState(0);
  const [timeWidth, setTimeWidth] = React.useState(0);
  const [lineTexts, setLineTexts] = React.useState<string[] | null>(null);

  // Décision : l'heure tient sur la dernière ligne ET flush-right ?
  // Décision : l'heure tient sur la dernière ligne ET flush-right ?
  const canInlineTime =
    showTime &&
    lastLineWidth > 0 &&
    textBoxWidth > 0 &&
    timeWidth > 0 &&
    lastLineWidth + GAP + timeWidth <= textBoxWidth;

  const styles = React.useMemo(
    () => createMessageBubbleStyles(msg, theme),
    [msg, theme],
  );

  const contentStyle = [
    styles.content,
    showTime && !canInlineTime ? styles.contentWithBottomTime : null,
  ];

  const renderTextBlock = () => {
    if (showTime && canInlineTime && lineTexts && lineTexts.length > 0) {
      const last = lineTexts[lineTexts.length - 1];
      const prev = lineTexts.slice(0, -1);

      return (
        <>
          {prev.length > 0 && (
            <PaperText style={styles.text}>{prev.join('\n')}</PaperText>
          )}

          <View style={styles.lastLineRow}>
           <View style={styles.lastLineTextWrap}>
             <PaperText style={styles.lastLineText} numberOfLines={1} ellipsizeMode="clip">
               {last}
             </PaperText>
           </View>
           <PaperText
             style={[styles.info, styles.timeInlineLabel]}
             onLayout={(e) => {
               if (timeWidth === 0) setTimeWidth(e.nativeEvent.layout.width);
             }}
           >
             {timeStr}
           </PaperText>
         </View>
        </>
      );
    }

    return (
      <PaperText
        style={styles.text}
        onTextLayout={(ev) => {
          const lines = ev.nativeEvent.lines || [];
          setLineTexts(lines.map((l) => l.text));
          const last = lines[lines.length - 1];
          setLastLineWidth(last ? last.width || 0 : 0);
        }}
      >
        {msg.message}
      </PaperText>
    );
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity 
        style={[styles.card, msg.isEncrypted && !msg.isSent && styles.encryptedCard]} 
        onPress={() => {
          console.log('MessageBubble click:', {
            isEncrypted: msg.isEncrypted,
            isSent: msg.isSent,
            sender: msg.sender,
            message: msg.message,
            decryptionFailed: msg.decryptionFailed
          });
          if (msg.isEncrypted && !msg.isSent && onEncryptedMessagePress) {
            console.log('Calling onEncryptedMessagePress');
            onEncryptedMessagePress(msg);
          }
        }}
        activeOpacity={msg.isEncrypted && !msg.isSent ? 0.7 : 1}
      >
        <View style={contentStyle}>
          {!msg.isSent && (
            <PaperText style={styles.from}>
              {msg.sender} {msg.isEncrypted && '🔒'}
            </PaperText>
          )}

          <View
            style={styles.textBox}
            onLayout={(e) => setTextBoxWidth(e.nativeEvent.layout.width)}
          >
            {renderTextBlock()}
          </View>

          {showTime && !canInlineTime && (
            <PaperText
              style={[styles.info, styles.timeBottomRight]}
              onLayout={(e) => {
                if (timeWidth === 0) setTimeWidth(e.nativeEvent.layout.width);
              }}
            >
              {timeStr}
            </PaperText>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default MessageBubble;
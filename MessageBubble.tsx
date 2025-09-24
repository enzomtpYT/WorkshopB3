import React from 'react';
import { View } from 'react-native';
import { Card, Text as PaperText } from 'react-native-paper';
import { createMessageBubbleStyles } from './style/MessageBubbleStyles';

type Msg = {
  message: string;
  timestamp: number;
  sender: string;
  isSent?: boolean;
};

function formatTime(ts: number) {
  const d = new Date(ts);
  try {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

const GAP = 8; // espace entre texte et heure

const MessageBubble: React.FC<{
  msg: Msg;
  showTime: boolean; // tu continues à ne l'afficher que sur le dernier du lot
  theme: any;
}> = ({ msg, showTime, theme }) => {
  const timeStr = formatTime(msg.timestamp);

  // Mesures
  const [lastLineWidth, setLastLineWidth] = React.useState(0);
  const [textBoxWidth, setTextBoxWidth] = React.useState(0);
  const [timeWidth, setTimeWidth] = React.useState(0);
  const [lineTexts, setLineTexts] = React.useState<string[] | null>(null);

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

  // Helper pour rendre soit le bloc "split" (autres lignes + dernière ligne avec heure),
  // soit le bloc standard (texte complet).
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

    // Bloc standard : on mesure ici les lignes et la dernière largeur
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
      <Card style={styles.card}>
        <Card.Content style={contentStyle}>
          <View style={styles.header}>
            {!msg.isSent ? (
              <PaperText style={styles.info}>From: {msg.sender}</PaperText>
            ) : (
              <View />
            )}
          </View>

          <View
            style={styles.textBox}
            onLayout={(e) => setTextBoxWidth(e.nativeEvent.layout.width)}
          >
            {renderTextBlock()}
          </View>

          {/* Heure en bas-droite si ça ne tient pas en dernière ligne */}
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
        </Card.Content>
      </Card>
    </View>
  );
};

export default MessageBubble;
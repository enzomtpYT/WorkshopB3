import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text as PaperText } from 'react-native-paper';

type Msg = {
  message: string;
  timestamp: number;
  sender: string;
  isSent?: boolean;
};

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const MessageBubble: React.FC<{
  msg: Msg;
  showTime: boolean;
  theme: any;
}> = ({ msg, showTime, theme }) => {
  const [textWidth, setTextWidth] = React.useState(0);
  const [bubbleWidth, setBubbleWidth] = React.useState(0);
  const [timeWidth, setTimeWidth] = React.useState(0);
  const [lineCount, setLineCount] = React.useState(1);

  const timeStr = formatTime(msg.timestamp);

  const canInlineTime =
    showTime &&
    lineCount === 1 &&
    textWidth > 0 &&
    timeWidth > 0 &&
    textWidth + timeWidth + 8 <= bubbleWidth;

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        wrapSent: { flexDirection: 'row', marginBottom: 8, justifyContent: 'flex-end' },
        wrapRecv: { flexDirection: 'row', marginBottom: 8, justifyContent: 'flex-start' },
        cardSent: {
          maxWidth: '80%',
          backgroundColor: theme.primary,
          alignSelf: 'flex-end',
        },
        cardRecv: {
          maxWidth: '80%',
          backgroundColor: theme.card,
          alignSelf: 'flex-start',
        },
        // Card.Content de base
        content: {},
        // Variante : on ajoute de la place pour l’heure en bas à droite
        contentWithBottomTime: { paddingBottom: 18 },

        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 2,
        },

        // Corps du message : deux variantes d’orientation + d’alignement
        bodyRow: { flexDirection: 'row', alignItems: 'flex-end' },
        bodyColumn: { flexDirection: 'column', alignItems: 'flex-start' },

        textSent: { color: theme.textColored, fontSize: 16 },
        textRecv: { color: theme.text, fontSize: 16 },

        infoSent: { color: theme.textColored, fontSize: 11, opacity: 0.75 },
        infoRecv: { color: theme.text, fontSize: 11, opacity: 0.75 },

        // Heure inline (à la suite du texte)
        timeInline: { marginLeft: 8 },

        // Heure en bas à droite
        timeBottom: { position: 'absolute', right: 8, bottom: 6 },
      }),
    [theme],
  );

  const wrapStyle = msg.isSent ? styles.wrapSent : styles.wrapRecv;
  const cardStyle = msg.isSent ? styles.cardSent : styles.cardRecv;
  const textStyle = msg.isSent ? styles.textSent : styles.textRecv;
  const infoStyle = msg.isSent ? styles.infoSent : styles.infoRecv;

  // Card.Content : base + variante « paddingBottom »
  const contentStyle = [
    styles.content,
    showTime && !canInlineTime ? styles.contentWithBottomTime : null,
  ];

  // Corps du message : row si inline possible, sinon column
  const bodyStyle = canInlineTime ? styles.bodyRow : styles.bodyColumn;

  return (
    <View style={wrapStyle}>
      <Card style={cardStyle}>
        <Card.Content onLayout={(e) => setBubbleWidth(e.nativeEvent.layout.width)} style={contentStyle}>
          <View style={styles.header}>
            {!msg.isSent ? <PaperText style={infoStyle}>From: {msg.sender}</PaperText> : <View />}
          </View>

          <View style={bodyStyle}>
            <PaperText
              onTextLayout={(ev) => {
                const lines = ev.nativeEvent.lines || [];
                setLineCount(lines.length || 1);
                if (lines.length === 1) setTextWidth(lines[0].width || 0);
                else setTextWidth(0);
              }}
              style={textStyle}
            >
              {msg.message}
            </PaperText>

            {showTime && canInlineTime && (
              <PaperText
                onLayout={(e) => setTimeWidth(e.nativeEvent.layout.width)}
                style={[infoStyle, styles.timeInline]}
              >
                {timeStr}
              </PaperText>
            )}
          </View>

          {showTime && !canInlineTime && (
            <PaperText
              onLayout={(e) => setTimeWidth(e.nativeEvent.layout.width)}
              style={[infoStyle, styles.timeBottom]}
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

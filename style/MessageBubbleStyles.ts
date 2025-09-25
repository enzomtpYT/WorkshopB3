import { StyleSheet } from 'react-native';

export const createMessageBubbleStyles = (msg: any, theme: any) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      marginBottom: 8,
      justifyContent: msg.isSent ? 'flex-end' : 'flex-start',
    },
    card: {
      maxWidth: '80%',
      minWidth: 80,
      backgroundColor: msg.isSent ? theme.primary : theme.card,
      alignSelf: msg.isSent ? 'flex-end' : 'flex-start',
      elevation: msg.isEncrypted ? 4 : 1,
      opacity: msg.decryptionFailed ? 0.7 : 1,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    encryptedCard: {
      borderWidth: 1,
      borderColor: theme.primary,
    },
    content: { 
      paddingBottom: 6, 
      paddingTop: 5 
    },
    contentWithBottomTime: { 
      paddingBottom: 18 
    }, // quand l'heure est en bas-droite

    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 2,
    },

    text: { 
      color: msg.isSent ? theme.textColored : theme.text, 
      fontSize: 14 
    },

    info: { 
      color: msg.isSent ? theme.textColored : theme.text, 
      fontSize: 11, 
      opacity: 0.75 
    },

    textBox: { 
      position: 'relative', 
      width: '100%' 
    }, // prend toute la largeur de la bulle

    // Heure en bas-droite du Card.Content (mode non-inline)
    timeBottomRight: { 
      position: 'absolute', 
      right: 8, 
      bottom: 6, 
      zIndex: 1 
    },

    // Ligne finale en "row" quand ça tient
    lastLineRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      width: '100%',
    },
    lastLineTextWrap: {
      flex: 1,            // occupe tout l'espace restant
      paddingRight: 8,    // l'écart visuel avec l'heure (GAP)
    },
    lastLineText: {
      color: msg.isSent ? theme.textColored : theme.text,
      fontSize: 14,
      // flexShrink: 1,
      // garantit qu'elle reste sur 1 ligne car on sait que ça tient
    },
    timeInlineLabel: {
      // label d'heure à droite de la dernière ligne
      marginLeft: 0,
    },
    from: { 
      color: msg.isSent ? theme.textColored : theme.text, 
      fontSize: 12,
      opacity: 0.9,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    
    // Styles pour l'icône de cadenas des messages envoyés chiffrés
    encryptedMessageContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    lockIcon: {
      color: msg.isSent ? theme.textColored : theme.text,
      fontSize: 14,
      marginRight: 4,
    },
    messageTextWithIcon: {
      flex: 1,
    },

  });
import { StyleSheet } from 'react-native';

export const createAppContentStyles = (theme: any, insets: any) =>
  StyleSheet.create({
    sendButton: {
      padding: 8,
      marginLeft: 8,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonEnabled: {
      backgroundColor: theme.primary,
    },
    sendButtonDisabled: {
      backgroundColor: '#ccc',
    },
    sendButtonText: {
      color: '#fff',
      fontSize: 14,
    },
    flexContainer: {
      flex: 1,
    },
    container: {
      flex: 1,
      paddingTop: insets.top,
<<<<<<< HEAD
      paddingBottom: 0,
=======
      paddingBottom: keyboardVisible ? 0 : insets.bottom,
      backgroundColor: theme.background,
      justifyContent: 'space-between',
>>>>>>> feat/authentification
    },
    input: { 
      flex: 1, 
      backgroundColor: theme.card,
<<<<<<< HEAD
=======
      maxHeight: 100,
>>>>>>> feat/authentification
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 20,
      paddingVertical: keyboardVisible ? 5 : 10,
      backgroundColor: theme.background,
      borderTopWidth: 1,
      borderTopColor: theme.card,
    },
    messagesContainer: {
      flex: 1,
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: keyboardVisible ? 60 : 20,
    },
    statusContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 10,
    },
    statusInfo: { 
      flex: 1 
    },
    buttonContainer: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      gap: 8
    },
    statusText: { 
      color: theme.text, 
      fontSize: 14 
    },
    clearButton: { 
      marginTop: 10, 
      backgroundColor: theme.card 
    },
    clearButtonLabel: { 
      color: theme.text 
    },
    ipText: { 
      color: theme.text, 
      fontSize: 12, 
      opacity: 0.7 
    },
    encryptionContainer: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      backgroundColor: theme.card,
      marginHorizontal: 20,
      borderRadius: 8,
      marginBottom: 10,
      borderLeftWidth: 3,
      borderLeftColor: theme.primary,
    },
    encryptionLabel: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: 'bold',
      marginBottom: 8,
      textAlign: 'center',
    },
    encryptionInput: {
      backgroundColor: theme.background,
      fontSize: 14,
    },
    encryptionStatus: {
      color: theme.text,
      fontSize: 11,
      opacity: 0.7,
      textAlign: 'center',
      marginTop: 5,
    },
    activeIcon: {
      opacity: 1,
    },
    inactiveIcon: {
      opacity: 0.7,
    }
  });
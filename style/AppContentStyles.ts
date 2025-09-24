import { StyleSheet } from 'react-native';

export const createAppContentStyles = (theme: any, insets: any, keyboardVisible: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: insets.top,
      paddingBottom: keyboardVisible ? 0 : insets.bottom,
      backgroundColor: theme.background,
    },
    input: { 
      flex: 1, 
      backgroundColor: theme.card 
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    messagesContainer: {
      flex: 1,
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: 0,
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
  });
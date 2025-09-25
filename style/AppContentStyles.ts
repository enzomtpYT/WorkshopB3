import { StyleSheet } from 'react-native';

export const createAppContentStyles = (theme: any, insets: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: insets.top,
      paddingBottom: 0,
    },
    input: { 
      flex: 1, 
      backgroundColor: theme.card,
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
        // AJOUTER: Styles crypto
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
    },
  });
import { StyleSheet } from 'react-native';

export const createBluetoothContentStyles = (theme: any, insets: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: insets.top,
      paddingBottom: 0,
      backgroundColor: theme.background,
    },
    messagesContainer: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    statusContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingVertical: 12,
      paddingHorizontal: 8,
      backgroundColor: theme.card,
      borderRadius: 8,
      marginBottom: 8,
    },
    statusInfo: {
      flex: 1,
    },
    statusText: {
      fontSize: 14,
      color: theme.text,
      fontWeight: '600',
    },
    ipText: {
      fontSize: 12,
      color: theme.text,
      opacity: 0.7,
      marginTop: 4,
    },
    buttonContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    clearButton: {
      minWidth: 60,
    },
    clearButtonLabel: {
      fontSize: 12,
    },
    content: {
      flex: 1,
      padding: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 20,
    },
    placeholderText: {
      textAlign: 'center',
      color: theme.text,
      opacity: 0.7,
      marginBottom: 10,
      lineHeight: 20,
    },
    usernameText: {
      fontSize: 16,
      color: theme.primary,
      fontWeight: 'bold',
      marginTop: 20,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    input: {
      flex: 1,
      backgroundColor: theme.card,
    },
    activeIcon: {
      opacity: 1,
    },
    inactiveIcon: {
      opacity: 0.7,
    },
  });
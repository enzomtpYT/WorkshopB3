import { StyleSheet } from 'react-native';

export const createBluetoothContentStyles = (theme: any, insets: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
      backgroundColor: theme.background,
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
  });
import { StyleSheet } from 'react-native';

export const createDecryptionModalStyles = (theme: any) =>
  StyleSheet.create({
    centeredView: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalView: {
      width: '80%',
      backgroundColor: theme.background,
      borderRadius: 20,
      padding: 20,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 10,
      color: theme.text,
    },
    subtitle: {
      fontSize: 16,
      color: theme.text,
      opacity: 0.7,
      marginBottom: 20,
      textAlign: 'center',
    },
    input: {
      width: '100%',
      height: 40,
      borderWidth: 1,
      borderColor: theme.primary,
      borderRadius: 8,
      paddingHorizontal: 10,
      marginBottom: 20,
      color: theme.text,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
    },
    button: {
      padding: 10,
      borderRadius: 8,
      width: '45%',
      alignItems: 'center',
    },
    buttonCancel: {
      backgroundColor: '#666',
    },
    buttonDecrypt: {
      backgroundColor: theme.primary,
    },
    buttonText: {
      color: theme.textColored,
      fontSize: 16,
    },
    errorText: {
      color: '#ff3b30',
      marginBottom: 10,
      textAlign: 'center',
    },
  });
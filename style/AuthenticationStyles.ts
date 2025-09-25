import { StyleSheet } from 'react-native';

export const createAuthenticationStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: theme.card,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    backgroundColor: theme.card,
    color: theme.text,
  },
  button: {
    backgroundColor: theme.primary,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: theme.textColored,
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: theme.text,
  },
  errorText: {
    color: '#ef4444', // Keep red for errors but use a more modern red
    marginBottom: 15,
  }
});
import React, { useState, useEffect } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { authenticationStyles } from '../style/AuthenticationStyles';
import AuthenticationService from '../services/AuthenticationService';

interface AuthenticationScreenProps {
  onAuthenticationSuccess: () => void;
}

export const AuthenticationScreen: React.FC<AuthenticationScreenProps> = ({ onAuthenticationSuccess }) => {
  const [username, setUsername] = useState('');
  const [encryptionKey, setEncryptionKey] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkDeviceRegistration();
  }, []);

  const checkDeviceRegistration = async () => {
    const isRegistered = await AuthenticationService.isDeviceRegistered();
    setIsRegistering(!isRegistered);
  };

  const handleAuthentication = async () => {
    if (!username || !encryptionKey) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    try {
      if (isRegistering) {
        const success = await AuthenticationService.registerUser(username, encryptionKey);
        if (success) {
          Alert.alert('Succès', 'Enregistrement réussi');
          onAuthenticationSuccess();
        } else {
          setError('Erreur lors de l\'enregistrement');
        }
      } else {
        const isValid = await AuthenticationService.verifyUser(username, encryptionKey);
        if (isValid) {
          onAuthenticationSuccess();
        } else {
          setError('Nom d\'utilisateur ou clé d\'encryption invalide');
        }
      }
    } catch (e) {
      setError('Une erreur est survenue');
      console.error(e);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={authenticationStyles.container}
    >
      <Text style={authenticationStyles.title}>
        {isRegistering ? 'Enregistrement' : 'Authentification'}
      </Text>

      <TextInput
        style={authenticationStyles.input}
        placeholder="Nom d'utilisateur"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

      <TextInput
        style={authenticationStyles.input}
        placeholder="Clé d'encryption"
        value={encryptionKey}
        onChangeText={setEncryptionKey}
        secureTextEntry
      />

      {error ? <Text style={authenticationStyles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={authenticationStyles.button}
        onPress={handleAuthentication}
      >
        <Text style={authenticationStyles.buttonText}>
          {isRegistering ? 'S\'enregistrer' : 'Se connecter'}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};
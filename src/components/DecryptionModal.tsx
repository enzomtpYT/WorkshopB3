import React, { useState } from 'react';
import {
  Modal,
  View,
  TextInput,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useMaterialYouTheme } from '../../App';
import { createDecryptionModalStyles } from '../../style/DecryptionModalStyles';
import { cryptoService } from '../crypto/CryptoService';

interface DecryptionModalProps {
  visible: boolean;
  encryptedMessage: string;
  onDecrypted: (decryptedText: string | null) => void;
  onClose: () => void;
}

export const DecryptionModal: React.FC<DecryptionModalProps> = ({
  visible,
  encryptedMessage,
  onDecrypted,
  onClose,
}) => {
  const theme = useMaterialYouTheme();
  const styles = React.useMemo(() => createDecryptionModalStyles(theme), [theme]);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleDecryption = () => {
    console.log('DecryptionModal: Attempting decryption with:', {
      encryptedMessage: encryptedMessage,
      passwordLength: password.length
    });
    
    try {
      const encryptedData = cryptoService.parseEncryptedMessage(encryptedMessage);
      console.log('DecryptionModal: Parsed encrypted data:', encryptedData);
      
      if (!encryptedData) {
        console.log('DecryptionModal: Failed to parse encrypted message');
        setError('Format de message invalide');
        return;
      }

      const result = cryptoService.decryptMessage(encryptedData, password);
      console.log('DecryptionModal: Decryption result:', result);
      
      if (result.success && result.message) {
        console.log('DecryptionModal: Decryption successful:', result.message);
        onDecrypted(result.message);
        setPassword('');
        setError('');
        onClose();
      } else {
        console.log('DecryptionModal: Decryption failed:', result.error);
        setError(result.error || 'Échec du déchiffrement');
      }
    } catch (e) {
      console.log('DecryptionModal: Exception during decryption:', e);
      setError('Erreur lors du déchiffrement');
      console.error('Decrypt error:', e);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.title}>Message chiffré</Text>
          <Text style={styles.subtitle}>
            Entrez le mot de passe pour déchiffrer
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.buttonCancel]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonDecrypt]}
              onPress={handleDecryption}
            >
              <Text style={styles.buttonText}>Déchiffrer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default DecryptionModal;
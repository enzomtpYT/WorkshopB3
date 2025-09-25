import 'react-native-get-random-values';
import CryptoJS from 'crypto-js';

export interface EncryptedMessage {
  encrypted: string;
  iv: string;
  authTag: string;
  targetUser?: string; // Username du destinataire
}

export interface DecryptionResult {
  success: boolean;
  message?: string;
  error?: string;
}

export class CryptoService {
  /**
   * Hash une chaîne de caractères avec SHA-256 en utilisant un algorithme natif
   */
  async hash(text: string): Promise<string> {
    return CryptoJS.SHA256(text).toString();
  }

  /**
   * Génère une clé AES-256 à partir d'un mot de passe
   */
  private generateKey(password: string, salt: string = 'resnet_salt_2024'): CryptoJS.lib.WordArray {
    return CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32, // 256 bits = 32 bytes
      iterations: 10000,
    });
  }

  /**
   * Chiffre un message avec AES-256-CBC (plus compatible que GCM)
   */
  encryptMessage(
    message: string, 
    recipientPassword: string, 
    recipientUsername?: string
  ): EncryptedMessage {
    try {
      const key = this.generateKey(recipientPassword);
      const iv = CryptoJS.lib.WordArray.random(16); // 128 bits pour CBC
      
      // Chiffrement AES-256-CBC
      const encrypted = CryptoJS.AES.encrypt(message, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      // Générer un tag d'authentification HMAC
      const authTag = CryptoJS.HmacSHA256(
        encrypted.ciphertext.toString() + iv.toString(),
        key
      ).toString();

      return {
        encrypted: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
        iv: iv.toString(CryptoJS.enc.Base64),
        authTag: authTag,
        targetUser: recipientUsername,
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  /**
   * Déchiffre un message avec votre mot de passe
   */
  decryptMessage(
    encryptedData: EncryptedMessage, 
    yourPassword: string
  ): DecryptionResult {
    try {
      const key = this.generateKey(yourPassword);
      const iv = CryptoJS.enc.Base64.parse(encryptedData.iv);
      const ciphertext = CryptoJS.enc.Base64.parse(encryptedData.encrypted);

      // Vérifier l'authentification HMAC
      const expectedAuthTag = CryptoJS.HmacSHA256(
        encryptedData.encrypted + encryptedData.iv,
        key
      ).toString();

      if (expectedAuthTag !== encryptedData.authTag) {
        return {
          success: false,
          error: 'Message authentication failed - wrong password or tampering detected',
        };
      }

      // Déchiffrement AES-256-CBC
      const decrypted = CryptoJS.AES.decrypt(
        CryptoJS.lib.CipherParams.create({
          ciphertext: ciphertext,
        }),
        key,
        {
          iv: iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
        }
      );

      const decryptedMessage = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!decryptedMessage) {
        return {
          success: false,
          error: 'Wrong password or corrupted message',
        };
      }

      return {
        success: true,
        message: decryptedMessage,
      };
    } catch (error) {
      console.error('Decryption error:', error);
      return {
        success: false,
        error: 'Decryption failed - wrong password?',
      };
    }
  }

  /**
   * Vérifie si un message est chiffré
   */
  isEncryptedMessage(rawMessage: string): boolean {
    try {
      const parsed = JSON.parse(rawMessage);
      return !!(
        parsed.encrypted && 
        parsed.iv && 
        parsed.authTag &&
        typeof parsed.encrypted === 'string' &&
        typeof parsed.iv === 'string' &&
        typeof parsed.authTag === 'string'
      );
    } catch {
      return false;
    }
  }

  /**
   * Parse un message chiffré depuis JSON
   */
  parseEncryptedMessage(rawMessage: string): EncryptedMessage | null {
    try {
      const parsed = JSON.parse(rawMessage);
      if (parsed.encrypted && parsed.iv && parsed.authTag) {
        return {
          encrypted: parsed.encrypted,
          iv: parsed.iv,
          authTag: parsed.authTag,
          targetUser: parsed.targetUser,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Génère un mot de passe sécurisé
   */
  generateSecurePassword(length: number = 12): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const randomValues = CryptoJS.lib.WordArray.random(length);
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.abs(randomValues.words[i % randomValues.words.length]) % chars.length;
      password += chars[randomIndex];
    }
    
    return password;
  }
}

export const cryptoService = new CryptoService();
import { NativeModules, Platform } from 'react-native';
import { CryptoService } from '../crypto/CryptoService';
import { sqliteService } from '../database/SQLiteService';

class AuthenticationService {
  private cryptoService: CryptoService;
  
  constructor() {
    this.cryptoService = new CryptoService();
  }

  async getMacAddress(): Promise<string> {
    try {
      if (Platform.OS === 'ios') {
        const { MacAddress } = NativeModules;
        if (!MacAddress) {
          console.error('Module MacAddress non disponible');
          return 'DEFAULT_MAC_ADDRESS';
        }
        return await MacAddress.getBluetoothMacAddress();
      } else {
        const { NetworkInfo } = NativeModules;
        if (!NetworkInfo) {
          console.error('Module NetworkInfo non disponible');
          return 'DEFAULT_MAC_ADDRESS';
        }
        return await NetworkInfo.getBluetoothMacAddress();
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'adresse MAC:', error);
      return 'DEFAULT_MAC_ADDRESS';
    } finally {
      // Nettoyage si nécessaire
    }
  }

  async registerUser(username: string, encryptionKey: string): Promise<boolean> {
    try {
      console.log('Début de l\'enregistrement pour:', username);
      const macAddress = await this.getMacAddress();
      console.log('Adresse MAC obtenue:', macAddress);
      
      const hashedKey = await this.cryptoService.hash(encryptionKey);
      console.log('Clé hashée générée');
      
      console.log('Tentative d\'insertion dans la base de données...');
      await sqliteService.executeQuery(
        'INSERT OR REPLACE INTO users (mac_address, username, encryption_key) VALUES (?, ?, ?)',
        [macAddress, username, hashedKey]
      );
      
      console.log('Enregistrement réussi !');
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement:', error);
      if (error instanceof Error) {
        console.error('Message d\'erreur:', error.message);
        console.error('Stack trace:', error.stack);
      }
      return false;
    }
  }

  async verifyUser(username: string, encryptionKey: string): Promise<boolean> {
    try {
      const macAddress = await this.getMacAddress();
      const hashedKey = await this.cryptoService.hash(encryptionKey);
      
      const result = await sqliteService.executeQuery(
        'SELECT * FROM users WHERE mac_address = ? AND username = ? AND encryption_key = ?',
        [macAddress, username, hashedKey]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      console.error('Erreur lors de la vérification:', error);
      return false;
    }
  }

  async isDeviceRegistered(): Promise<boolean> {
    try {
      const macAddress = await this.getMacAddress();
      const result = await sqliteService.executeQuery(
        'SELECT * FROM users WHERE mac_address = ?',
        [macAddress]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      console.error('Erreur lors de la vérification du dispositif:', error);
      return false;
    }
  }
}

export default new AuthenticationService();
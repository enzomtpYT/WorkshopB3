import { PermissionsAndroid, Platform } from 'react-native';
import BleManager from 'react-native-ble-manager';
import { toastService } from './src/services/ToastService';
import {
  startAdvertising,
  stopAdvertising,
} from 'munim-bluetooth-peripheral';

export interface BluetoothMessage {
  id: string;
  message: string;
  sender: string;
  timestamp: number;
  deviceId?: string;
}

const serviceUUID = '44C13E43-097A-9C9F-537F-5666A6840C08';

export interface DiscoveredDevice {
  deviceId: string;
  name: string;
  rssi: number;
  lastSeen: number;
  isOnline: boolean;
}

class BluetoothMessagingService {
  private isServiceActive = false;
  private username = '';
  private onMessageReceived: (message: BluetoothMessage) => void = () => {};
  private onDeviceDiscovered: (device: DiscoveredDevice) => void = () => {};
  private recentMessages: BluetoothMessage[] = [];
  private discoveredDevices: DiscoveredDevice[] = [];
  private connectedDevices: DiscoveredDevice[] = [];

  constructor() {
    console.log('Starting bluetooth service.');
    BleManager.start({ showAlert: false });
  }

  async requestBluetoothPermission() {
    if (Platform.OS === 'ios') {
      return true
    }
    if (Platform.OS === 'android' && PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION) {
      const apiLevel = parseInt(Platform.Version.toString(), 10)
    
      if (apiLevel < 31) {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
        return granted === PermissionsAndroid.RESULTS.GRANTED
      }
      if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN && PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT && PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE) {
        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        ])
      
        return (
          result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.BLUETOOTH_ADVERTISE'] === PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
        )
      }
    }
  
    
    toastService.showError('Bluetooth permissions are required.');
    return false
  }

  async startService(username: string) {
    this.username = username;
    // Request necessary permissions
    if (!await this.requestBluetoothPermission()) {
      return false;
    }
    // Start advertising
    startAdvertising({
      serviceUUIDs: [serviceUUID],
    });
    // Start scanning for devices
    BleManager.scan([serviceUUID], 10, false).then(() => {
      console.log('Scan started');
    }).catch(err => {
      toastService.showError('Failed to start Bluetooth scan: ' + err);
      return false;
    });
    // Handle discovered devices
    BleManager.onDiscoverPeripheral((device: any) => {
      console.log(`Discovered Bluetooth device: ${device.name || 'Unnamed'} (${device.id}) RSSI: ${device.rssi}, Service UUIDs: ${device.advertising.serviceUUIDs}`);
      const discoveredDevice: DiscoveredDevice = {
        deviceId: device.id,
        name: device.name || 'Unnamed',
        rssi: device.rssi,
        lastSeen: Date.now(),
        isOnline: true,
      };
      this.onDeviceDiscovered(discoveredDevice);
    });
    this.isServiceActive = true;
    console.log(`Bluetooth service started for user: ${username}`);
    return true;
  }

  async stopService() {
    // Stop advertising
    stopAdvertising();
    // Stop scanning
    BleManager.stopScan().then(() => {
      console.log("Scan stopped");
    });
    this.isServiceActive = false;
    console.log('Bluetooth service stopped');
  }

  async sendMessage(message: string): Promise<void> {
    const messageData: BluetoothMessage = {
      id: this.generateMessageId(),
      message: message,
      sender: this.username || 'You',
      timestamp: Date.now()
    };

    console.log('Sending Bluetooth message:', {
      sender: messageData.sender,
      message: messageData.message,
      timestamp: new Date(messageData.timestamp).toLocaleTimeString()
    });

    // Add to recent messages for UI
    this.recentMessages.unshift(messageData);
    if (this.recentMessages.length > 10) {
      this.recentMessages = this.recentMessages.slice(0, 10);
    }
  }

  private generateMessageId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  getDiscoveredDevices(): DiscoveredDevice[] {
    return [...this.discoveredDevices];
  }

  getWorkshopDevices(): Array<{deviceId: string, username?: string, appVersion?: string, connectedAt: number}> {
    return [];
  }

  getConnectionStatus(): { discovered: number; connected: number; workshopDevices: number; recentMessages: number } {
    return {
      discovered: this.discoveredDevices.length,
      connected: 0,
      workshopDevices: 0,
      recentMessages: this.recentMessages.length
    };
  }

  getRecentBluetoothMessages(): BluetoothMessage[] {
    return [...this.recentMessages];
  }

  setMessageHandler(handler: (message: BluetoothMessage) => void) {
    this.onMessageReceived = handler;
  }

  setDeviceDiscoveryHandler(handler: (device: DiscoveredDevice) => void) {
    this.onDeviceDiscovered = handler;
  }

  isServiceRunning(): boolean {
    return this.isServiceActive;
  }

  cleanup() {
    this.isServiceActive = false;
    this.recentMessages = [];
  }
}

export const bluetoothMessaging = new BluetoothMessagingService();
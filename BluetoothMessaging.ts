import { PermissionsAndroid, Platform, NativeEventEmitter, NativeModules, EmitterSubscription } from 'react-native';
import BleManager from 'react-native-ble-manager';
import { toastService } from './src/services/ToastService';
import {
  startAdvertising,
  stopAdvertising,
  setServices,
  addListener,
  removeListeners,
} from 'munim-bluetooth-peripheral';

export interface BluetoothMessage {
  id: string;
  message: string;
  sender: string;
  timestamp: number;
  deviceId?: string;
}

const serviceUUID = '44C13E43-097A-9C9F-537F-5666A6840C08';
const messageCharacteristicUUID = 'A1B2C3D4-5678-9ABC-DEF0-123456789ABC';
const usernameCharacteristicUUID = 'B1C2D3E4-5678-9ABC-DEF0-123456789ABC';

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
  private connectedDevices: Set<string> = new Set();
  private discoveredDevices: Map<string, DiscoveredDevice> = new Map();
  private bleManagerEmitter: NativeEventEmitter;
  private eventListeners: EmitterSubscription[] = [];

  constructor() {
    console.log('Starting bluetooth service.');
    BleManager.start({ showAlert: false });
    
    const BleManagerModule = NativeModules.BleManager;
    this.bleManagerEmitter = new NativeEventEmitter(BleManagerModule);
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for discovered peripherals
    const discoverListener = this.bleManagerEmitter.addListener(
      'BleManagerDiscoverPeripheral',
      (peripheral: any) => {
        console.log('Discovered peripheral:', peripheral);
        this.handlePeripheralDiscovered(peripheral);
      }
    );

    // Listen for disconnections
    const disconnectListener = this.bleManagerEmitter.addListener(
      'BleManagerDisconnectPeripheral',
      (data: any) => {
        console.log('Peripheral disconnected:', data);
        this.connectedDevices.delete(data.peripheral);
        this.updateDeviceStatus(data.peripheral, false);
      }
    );

    // Listen for connection events
    const connectListener = this.bleManagerEmitter.addListener(
      'BleManagerConnectPeripheral',
      (data: any) => {
        console.log('Peripheral connected:', data);
        this.connectedDevices.add(data.peripheral);
        this.updateDeviceStatus(data.peripheral, true);
      }
    );

    // Listen for characteristic value updates (notifications)
    const updateListener = this.bleManagerEmitter.addListener(
      'BleManagerDidUpdateValueForCharacteristic',
      (data: any) => {
        console.log('Characteristic updated:', data);
        this.handleCharacteristicUpdate(data);
      }
    );

    this.eventListeners = [discoverListener, disconnectListener, connectListener, updateListener];
  }

  private handlePeripheralDiscovered(peripheral: any) {
    // Only handle peripherals that advertise our service
    if (peripheral.advertising?.serviceUUIDs?.includes(serviceUUID)) {
      const device: DiscoveredDevice = {
        deviceId: peripheral.id,
        name: peripheral.name || peripheral.localName || 'Unknown Device',
        rssi: peripheral.rssi,
        lastSeen: Date.now(),
        isOnline: true,
      };

      this.discoveredDevices.set(peripheral.id, device);
      this.onDeviceDiscovered(device);

      // Automatically attempt to connect to discovered Workshop devices
      this.connectToDevice(peripheral.id);
    }
  }

  private updateDeviceStatus(deviceId: string, isOnline: boolean) {
    const device = this.discoveredDevices.get(deviceId);
    if (device) {
      device.isOnline = isOnline;
      device.lastSeen = Date.now();
      this.onDeviceDiscovered(device);
    }
  }

  private async connectToDevice(deviceId: string) {
    if (this.connectedDevices.has(deviceId)) {
      return; // Already connected
    }

    try {
      console.log(`Attempting to connect to device: ${deviceId}`);
      await BleManager.connect(deviceId);
      console.log(`Connected to device: ${deviceId}`);
      
      // Retrieve services to find our messaging service
      const peripheralInfo = await BleManager.retrieveServices(deviceId);
      console.log('Peripheral services:', peripheralInfo);

      // Start notifications for message characteristic
      await BleManager.startNotification(deviceId, serviceUUID, messageCharacteristicUUID);
      console.log(`Started notifications for device: ${deviceId}`);

    } catch (error) {
      console.log(`Failed to connect to device ${deviceId}:`, error);
    }
  }

  private handleCharacteristicUpdate(data: any) {
    if (data.service === serviceUUID && data.characteristic === messageCharacteristicUUID) {
      try {
        // Convert byte array to string
        const messageData = String.fromCharCode.apply(null, data.value);
        const parsedMessage = JSON.parse(messageData);
        
        const receivedMessage: BluetoothMessage = {
          id: parsedMessage.id || this.generateMessageId(),
          message: parsedMessage.message,
          sender: parsedMessage.sender || 'Unknown',
          timestamp: parsedMessage.timestamp || Date.now(),
          deviceId: data.peripheral,
        };

        console.log('Received message:', receivedMessage);
        this.recentMessages.unshift(receivedMessage);
        if (this.recentMessages.length > 50) {
          this.recentMessages = this.recentMessages.slice(0, 50);
        }

        this.onMessageReceived(receivedMessage);
      } catch (error) {
        console.error('Failed to parse received message:', error);
      }
    }
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

    try {
      // Set up GATT service with message characteristic
      await this.setupGattService();
      
      // Start advertising with our service
      startAdvertising({
        serviceUUIDs: [serviceUUID],
        localName: `Workshop-${username}`,
        manufacturerData: '575394B3', // "WSB3" in hex
        advertisingData: {
          completeLocalName: `Workshop-${username}`,
          completeServiceUUIDs16: [serviceUUID],
          flags: 0x06, // LE General Discoverable Mode, BR/EDR Not Supported
        }
      });

      // Start scanning for other devices
      await BleManager.scan([serviceUUID], 30, true);
      console.log('BLE scan started');

      this.isServiceActive = true;
      console.log(`Bluetooth service started for user: ${username}`);
      return true;
      
    } catch (error) {
      console.error('Failed to start Bluetooth service:', error);
      toastService.showError('Failed to start Bluetooth service: ' + error);
      return false;
    }
  }

  private async setupGattService() {
    // Set up GATT service with message and username characteristics
    const services = [{
      uuid: serviceUUID,
      characteristics: [
        {
          uuid: messageCharacteristicUUID,
          properties: ['read', 'write', 'notify'],
          value: '' // Will be updated when messages are sent/received
        },
        {
          uuid: usernameCharacteristicUUID,
          properties: ['read'],
          value: this.username
        }
      ]
    }];

    setServices(services);
    console.log('GATT service configured with message characteristic');
  }

  async stopService() {
    try {
      // Stop advertising
      stopAdvertising();
      
      // Stop scanning
      await BleManager.stopScan();
      console.log("BLE scan stopped");
      
      // Disconnect from all connected devices
      for (const deviceId of this.connectedDevices) {
        try {
          await BleManager.disconnect(deviceId);
          console.log(`Disconnected from device: ${deviceId}`);
        } catch (error) {
          console.log(`Failed to disconnect from device ${deviceId}:`, error);
        }
      }
      
      this.connectedDevices.clear();
      this.discoveredDevices.clear();
      this.isServiceActive = false;
      
      console.log('Bluetooth service stopped');
    } catch (error) {
      console.error('Error stopping Bluetooth service:', error);
    }
  }

  async sendMessage(message: string): Promise<void> {
    if (!this.isServiceActive) {
      throw new Error('Bluetooth service is not active');
    }

    const messageData: BluetoothMessage = {
      id: this.generateMessageId(),
      message: message,
      sender: this.username || 'You',
      timestamp: Date.now()
    };

    console.log('Sending Bluetooth message:', {
      sender: messageData.sender,
      message: messageData.message,
      timestamp: new Date(messageData.timestamp).toLocaleTimeString(),
      connectedDevices: this.connectedDevices.size
    });

    // Add to recent messages for UI
    this.recentMessages.unshift(messageData);
    if (this.recentMessages.length > 50) {
      this.recentMessages = this.recentMessages.slice(0, 50);
    }

    // Send message to all connected devices
    const messagePayload = JSON.stringify({
      id: messageData.id,
      message: messageData.message,
      sender: messageData.sender,
      timestamp: messageData.timestamp
    });

    const messageBytes = Array.from(messagePayload).map(char => char.charCodeAt(0));
    
    for (const deviceId of this.connectedDevices) {
      try {
        await BleManager.write(
          deviceId,
          serviceUUID,
          messageCharacteristicUUID,
          messageBytes
        );
        console.log(`Message sent to device: ${deviceId}`);
      } catch (error) {
        console.error(`Failed to send message to device ${deviceId}:`, error);
        // Remove device from connected list if write fails
        this.connectedDevices.delete(deviceId);
        this.updateDeviceStatus(deviceId, false);
      }
    }

    if (this.connectedDevices.size === 0) {
      console.log('No connected devices to send message to');
    }
  }

  private generateMessageId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  getDiscoveredDevices(): DiscoveredDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  getConnectedDevices(): string[] {
    return Array.from(this.connectedDevices);
  }

  getWorkshopDevices(): Array<{deviceId: string, username?: string, appVersion?: string, connectedAt: number}> {
    return Array.from(this.discoveredDevices.values()).map(device => ({
      deviceId: device.deviceId,
      username: device.name.replace('Workshop-', ''),
      appVersion: '1.0.0',
      connectedAt: device.lastSeen,
    }));
  }

  getConnectionStatus(): { discovered: number; connected: number; workshopDevices: number; recentMessages: number } {
    return {
      discovered: this.discoveredDevices.size,
      connected: this.connectedDevices.size,
      workshopDevices: this.discoveredDevices.size,
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
    // Remove all event listeners
    this.eventListeners.forEach(listener => listener.remove());
    this.eventListeners = [];
    
    this.isServiceActive = false;
    this.recentMessages = [];
    this.connectedDevices.clear();
    this.discoveredDevices.clear();
  }

  // Manual discovery method
  async discoverWorkshopDevices(): Promise<void> {
    if (!this.isServiceActive) {
      console.log('🔍 Bluetooth service not active, cannot discover devices');
      return;
    }

    try {
      console.log('🔍 Starting manual Workshop device discovery');
      await BleManager.scan([serviceUUID], 10, true);
      console.log('🔍 Manual device discovery scan started');
    } catch (error) {
      console.error('🔍 Failed to start manual discovery:', error);
    }
  }
}

export const bluetoothMessaging = new BluetoothMessagingService();
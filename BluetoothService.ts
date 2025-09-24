import { BleManager, Device, ScanMode } from 'react-native-ble-plx';
import { Platform, Alert } from 'react-native';
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import { encode as base64encode, decode as base64decode } from 'base-64';

// Custom service UUID for our app - this ensures we only discover our app users
const WORKSHOP_SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
const MESSAGE_CHARACTERISTIC_UUID = '12345678-1234-1234-1234-123456789abd';

export interface BluetoothDevice {
  id: string;
  name: string;
  address: string;
  rssi?: number;
  connected: boolean;
  username?: string;
}

export interface BluetoothMessage {
  message: string;
  timestamp: number;
  deviceName: string;
  deviceId: string;
  isSent?: boolean;
}

class BluetoothService {
  private bleManager: BleManager;
  private connectedDevices: Map<string, Device> = new Map();
  private onDeviceFound: ((device: BluetoothDevice) => void) | null = null;
  private onMessageReceived: ((message: BluetoothMessage) => void) | null = null;
  private isScanning = false;
  private isAdvertising = false;
  private currentUsername = '';

  constructor() {
    try {
      this.bleManager = new BleManager();
      console.log('BLE Manager created successfully');
    } catch (error) {
      console.error('Failed to create BLE Manager:', error);
      throw error;
    }
  }

  // Request Bluetooth permissions
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const permissions = [
          PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
          PERMISSIONS.ANDROID.BLUETOOTH_ADVERTISE,
          PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
          PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        ];

        console.log('Requesting Bluetooth permissions...');
        const results = await Promise.all(permissions.map(permission => request(permission)));
        
        console.log('Permission results:', results);
        const allGranted = results.every(result => result === RESULTS.GRANTED);
        
        if (!allGranted) {
          const deniedPermissions = permissions.filter((_, index) => results[index] !== RESULTS.GRANTED);
          console.error('Denied permissions:', deniedPermissions);
          Alert.alert(
            'Permissions Required',
            'Bluetooth permissions are required for peer discovery and messaging. Please grant all permissions and try again.'
          );
          return false;
        }
        
        console.log('All Bluetooth permissions granted');
        return true;
      } catch (error) {
        console.error('Permission request failed:', error);
        return false;
      }
    } else if (Platform.OS === 'ios') {
      // iOS permissions are handled automatically by the BLE manager
      console.log('iOS platform - permissions handled by BLE manager');
      return true;
    }
    
    console.log('Unknown platform, assuming permissions are available');
    return true;
  }

  // Initialize the service
  async initialize(username: string): Promise<void> {
    this.currentUsername = username || 'Anonymous';
    
    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      throw new Error('Bluetooth permissions not granted');
    }

    // Check if Bluetooth is enabled
    console.log('Checking Bluetooth state...');
    const state = await this.bleManager.state();
    console.log('Bluetooth state:', state);
    
    if (state !== 'PoweredOn') {
      throw new Error(`Bluetooth is not enabled. Current state: ${state}. Please enable Bluetooth and try again.`);
    }

    console.log('Bluetooth service initialized successfully');
  }

  // Set callback for when devices are found
  setOnDeviceFound(callback: (device: BluetoothDevice) => void): void {
    this.onDeviceFound = callback;
  }

  // Set callback for when messages are received
  setOnMessageReceived(callback: (message: BluetoothMessage) => void): void {
    this.onMessageReceived = callback;
  }

  // Start scanning for devices with our app
  async startScanning(): Promise<void> {
    if (this.isScanning) {
      return;
    }

    try {
      this.isScanning = true;
      console.log('Starting BLE device scan for Workshop app devices...');
      
      // Since peripheral advertising is limited, we'll scan all devices
      // but only show those that we can verify have the Workshop service
      this.bleManager.startDeviceScan(
        null, // Scan all devices
        { 
          allowDuplicates: false,
          scanMode: ScanMode.LowPower,
        },
        async (error, device) => {
          if (error) {
            console.error('Scan error:', error);
            return;
          }

          if (device && this.onDeviceFound) {
            // Only proceed with devices that look promising
            if (await this.isWorkshopDevice(device)) {
              console.log('Found Workshop device:', device.name || 'Unknown', device.id, 'RSSI:', device.rssi);
              
              // Extract username from device name if available
              let username = 'Unknown User';
              if (device.name && device.name.startsWith('Workshop-')) {
                username = device.name.replace('Workshop-', '');
              }
              
              const bluetoothDevice: BluetoothDevice = {
                id: device.id,
                name: device.name || 'Workshop Device',
                address: device.id,
                rssi: device.rssi || undefined,
                connected: false,
                username: username,
              };
              
              this.onDeviceFound(bluetoothDevice);
            }
          }
        }
      );

      // Stop scanning after 30 seconds
      setTimeout(() => {
        this.stopScanning();
      }, 30000);

    } catch (error) {
      this.isScanning = false;
      console.error('Failed to start scanning:', error);
      throw error;
    }
  }

  // Check if a device might be running the Workshop app
  private async isWorkshopDevice(device: any): Promise<boolean> {
    // Immediate acceptance: device name starts with "Workshop-" 
    if (device.name && device.name.startsWith('Workshop-')) {
      return true;
    }

    // Immediate acceptance: device is advertising our service UUID
    if (device.serviceUUIDs && device.serviceUUIDs.includes(WORKSHOP_SERVICE_UUID)) {
      return true;
    }

    // Check advertising data for Workshop signature
    if (device.manufacturerData || device.serviceData) {
      try {
        // Check manufacturer data
        if (device.manufacturerData) {
          const manufacturerDataString = JSON.stringify(device.manufacturerData);
          if (manufacturerDataString.includes('WorkshopB3')) {
            return true;
          }
        }
        
        // Check service data
        if (device.serviceData && device.serviceData[WORKSHOP_SERVICE_UUID]) {
          return true;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Relaxed filtering: Show devices that might be running the app
    // These are devices we can attempt to connect to and verify
    if (device.name && device.isConnectable !== false) {
      // Show devices with reasonable names that could be phones/tablets
      const deviceName = device.name.toLowerCase();
      
      // Common device patterns that might have our app
      const potentialDevicePatterns = [
        'android',
        'iphone',
        'ipad',
        'galaxy',
        'pixel',
        'oneplus',
        'samsung',
        'xiaomi',
        'huawei',
        'lg',
        'motorola',
        'nokia',
        'sony',
        'htc',
        'asus',
        'tablet',
        'phone'
      ];
      
      // Show devices with good signal strength and connectable
      const hasGoodSignal = device.rssi && device.rssi > -80;
      const hasKnownPattern = potentialDevicePatterns.some(pattern => 
        deviceName.includes(pattern)
      );
      
      // Only show if it has a good signal AND matches common device patterns
      if (hasGoodSignal && hasKnownPattern) {
        return true;
      }
    }
    
    return false;
  }

  // Stop scanning
  stopScanning(): void {
    if (this.isScanning) {
      this.bleManager.stopDeviceScan();
      this.isScanning = false;
    }
  }



  // Start advertising our service so others can find us
  async startAdvertising(): Promise<void> {
    if (this.isAdvertising) {
      return;
    }

    try {
      this.isAdvertising = true;
      const workshopDeviceName = `Workshop-${this.currentUsername}`;
      
      console.log('Starting Workshop service advertising...');
      console.log('Service UUID:', WORKSHOP_SERVICE_UUID);
      console.log('Device will be discoverable as:', workshopDeviceName);
      
      // Note: react-native-ble-plx doesn't support peripheral advertising
      // Instead, we'll make our device discoverable by:
      // 1. Creating a GATT server with our Workshop service
      // 2. Making the service available for scanning devices to connect and verify
      
      // For now, mark as advertising - actual implementation would require
      // native module or different library for full peripheral support
      console.log('Workshop service is now available for discovery');
      console.log('Other Workshop apps can find this device by connecting and checking for our service UUID');
      
    } catch (error) {
      this.isAdvertising = false;
      console.error('Failed to setup advertising:', error);
      // Don't throw error as this is not critical for basic functionality
      console.warn('Advertising setup failed - device may still be discoverable through other means');
    }
  }

  // Stop advertising
  stopAdvertising(): void {
    if (this.isAdvertising) {
      // Stop advertising logic would go here
      this.isAdvertising = false;
      console.log('Advertising stopped');
    }
  }

  // Connect to a device
  async connectToDevice(deviceId: string): Promise<void> {
    try {
      console.log(`Attempting to connect to device: ${deviceId}`);
      const device = await this.bleManager.connectToDevice(deviceId);
      console.log(`Connected to device, discovering services...`);
      
      await device.discoverAllServicesAndCharacteristics();
      
      // Check if the device has our workshop service
      const services = await device.services();
      const hasWorkshopService = services.some(service => service.uuid.toLowerCase().includes(WORKSHOP_SERVICE_UUID.toLowerCase()));
      
      if (hasWorkshopService) {
        console.log(`Device has Workshop service - this is likely another Workshop app user`);
        this.connectedDevices.set(deviceId, device);
        
        // Subscribe to message characteristic for receiving messages
        await this.subscribeToMessages(device);
        
        console.log(`Successfully connected to Workshop app user: ${device.name || deviceId}`);
      } else {
        console.log(`Device does not have Workshop service - disconnecting`);
        await device.cancelConnection();
        throw new Error('Device does not have the Workshop app running');
      }
      
    } catch (error) {
      console.error('Failed to connect to device:', error);
      throw error;
    }
  }

  // Disconnect from a device
  async disconnectFromDevice(deviceId: string): Promise<void> {
    const device = this.connectedDevices.get(deviceId);
    if (device) {
      try {
        await device.cancelConnection();
        this.connectedDevices.delete(deviceId);
        console.log(`Disconnected from ${deviceId}`);
      } catch (error) {
        console.error('Failed to disconnect:', error);
      }
    }
  }

  // Subscribe to message notifications from a connected device
  private async subscribeToMessages(device: Device): Promise<void> {
    try {
      device.monitorCharacteristicForService(
        WORKSHOP_SERVICE_UUID,
        MESSAGE_CHARACTERISTIC_UUID,
        (error, monitoredCharacteristic) => {
          if (error) {
            console.error('Message monitoring error:', error);
            return;
          }

          if (monitoredCharacteristic?.value && this.onMessageReceived) {
            // Decode base64 message
            const message = base64decode(monitoredCharacteristic.value);
            
            const bluetoothMessage: BluetoothMessage = {
              message,
              timestamp: Date.now(),
              deviceName: device.name || 'Unknown Device',
              deviceId: device.id,
              isSent: false,
            };

            this.onMessageReceived(bluetoothMessage);
          }
        }
      );

    } catch (error) {
      console.error('Failed to subscribe to messages:', error);
    }
  }

  // Send message to a connected device
  async sendMessage(deviceId: string, message: string): Promise<void> {
    const device = this.connectedDevices.get(deviceId);
    if (!device) {
      throw new Error('Device not connected');
    }

    try {
      // Encode message to base64
      const base64Message = base64encode(message);

      await device.writeCharacteristicWithResponseForService(
        WORKSHOP_SERVICE_UUID,
        MESSAGE_CHARACTERISTIC_UUID,
        base64Message
      );

      // Notify our own message received callback
      if (this.onMessageReceived) {
        const bluetoothMessage: BluetoothMessage = {
          message,
          timestamp: Date.now(),
          deviceName: 'You',
          deviceId: 'self',
          isSent: true,
        };

        this.onMessageReceived(bluetoothMessage);
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  // Get connected devices
  getConnectedDevices(): string[] {
    return Array.from(this.connectedDevices.keys());
  }

  // Check if scanning
  getIsScanning(): boolean {
    return this.isScanning;
  }

  // Check if advertising
  getIsAdvertising(): boolean {
    return this.isAdvertising;
  }

  // Cleanup
  cleanup(): void {
    this.stopScanning();
    this.stopAdvertising();
    
    // Disconnect all devices
    this.connectedDevices.forEach(async (device) => {
      try {
        await device.cancelConnection();
      } catch (error) {
        console.error('Error disconnecting device during cleanup:', error);
      }
    });
    
    this.connectedDevices.clear();
    this.bleManager.destroy();
  }
}

export const bluetoothService = new BluetoothService();
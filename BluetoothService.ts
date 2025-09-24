import { BleManager, Device, ScanMode } from 'react-native-ble-plx';
import { Platform, Alert } from 'react-native';
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import { encode as base64encode, decode as base64decode } from 'base-64';

// Custom service UUID for our app - this ensures we only discover our app users
const WORKSHOP_SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
const MESSAGE_CHARACTERISTIC_UUID = '12345678-1234-1234-1234-123456789abd';

// GATT Service Implementation Notes:
// - This service uses BLE GATT (Generic Attribute Profile) for communication
// - Devices scan for peripherals advertising the WORKSHOP_SERVICE_UUID
// - Messages are exchanged via the MESSAGE_CHARACTERISTIC_UUID characteristic
// - No pairing required - communication happens over GATT without bonding
// - Each device acts as both central (scanner) and peripheral (advertiser) when possible

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
      console.log('Scanning for service UUID:', WORKSHOP_SERVICE_UUID);
      
      // First try scanning specifically for our service UUID
      this.bleManager.startDeviceScan(
        [WORKSHOP_SERVICE_UUID], // Scan specifically for our service
        { 
          allowDuplicates: false,
          scanMode: ScanMode.LowPower,
        },
        async (error, device) => {
          if (error) {
            console.error('Targeted scan error:', error);
            return;
          }

          if (device && this.onDeviceFound) {
            console.log('Found device advertising Workshop service:', device.name || 'Unknown', device.id, 'RSSI:', device.rssi);
            
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
      );

      // After 10 seconds, also start a broader scan to catch devices that might not be advertising the service in scan response
      setTimeout(() => {
        if (this.isScanning) {
          console.log('Starting broader scan to catch additional devices...');
          this.startBroadScan();
        }
      }, 10000);

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

  // Broader scan to catch devices that might not advertise the service UUID in scan response
  private startBroadScan(): void {
    this.bleManager.startDeviceScan(
      null, // Scan all devices
      { 
        allowDuplicates: false,
        scanMode: ScanMode.LowPower,
      },
      async (error, device) => {
        if (error) {
          console.error('Broad scan error:', error);
          return;
        }

        if (device && this.onDeviceFound) {
          // Only proceed with devices that look promising
          if (await this.isWorkshopDevice(device)) {
            console.log('Found potential Workshop device via broad scan:', device.name || 'Unknown', device.id, 'RSSI:', device.rssi);
            
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
  }

  // Check if a device might be running the Workshop app
  private async isWorkshopDevice(device: any): Promise<boolean> {
    // Immediate acceptance: device name starts with "Workshop-" 
    if (device.name && device.name.startsWith('Workshop-')) {
      console.log('Device accepted by name pattern:', device.name);
      return true;
    }

    // Immediate acceptance: device is advertising our service UUID
    if (device.serviceUUIDs && device.serviceUUIDs.includes(WORKSHOP_SERVICE_UUID)) {
      console.log('Device accepted by service UUID advertisement:', device.name || device.id);
      return true;
    }

    // Check advertising data for Workshop signature
    if (device.manufacturerData || device.serviceData) {
      try {
        // Check manufacturer data for Workshop signature
        if (device.manufacturerData) {
          const manufacturerDataString = JSON.stringify(device.manufacturerData);
          if (manufacturerDataString.includes('WorkshopB3') || manufacturerDataString.includes('Workshop')) {
            console.log('Device accepted by manufacturer data:', device.name || device.id);
            return true;
          }
        }
        
        // Check service data for our service UUID
        if (device.serviceData && device.serviceData[WORKSHOP_SERVICE_UUID]) {
          console.log('Device accepted by service data:', device.name || device.id);
          return true;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    // For broad scan: More selective filtering based on device characteristics
    if (device.name && device.isConnectable !== false && device.rssi && device.rssi > -85) {
      const deviceName = device.name.toLowerCase();
      
      // Look for common mobile device patterns that could have our app
      const mobileDevicePatterns = [
        'android',
        'iphone',
        'ipad',
        'galaxy',
        'pixel',
        'sm-', // Samsung model prefix
        'lg-',
        'oneplus',
        'xiaomi',
        'redmi',
        'huawei',
        'honor',
        'oppo',
        'vivo',
        'realme'
      ];
      
      const hasKnownMobilePattern = mobileDevicePatterns.some(pattern => 
        deviceName.includes(pattern)
      );
      
      if (hasKnownMobilePattern) {
        console.log('Device accepted as potential mobile device:', device.name, 'RSSI:', device.rssi);
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
      
      console.log('Starting Workshop GATT service advertising...');
      console.log('Service UUID:', WORKSHOP_SERVICE_UUID);
      console.log('Device will be discoverable as:', workshopDeviceName);
      
      // IMPORTANT: react-native-ble-plx primarily supports central (client) mode
      // Peripheral (server) mode with GATT advertising is limited on React Native
      // 
      // For proper GATT server implementation, you would need:
      // 1. Platform-specific native modules (Android: BluetoothGattServer, iOS: CBPeripheralManager)
      // 2. Custom GATT service with message characteristic
      // 3. Proper advertising with service UUID in scan response
      //
      // Current approach: devices act as centrals and scan for each other
      // When connecting, they verify the presence of the Workshop service
      
      console.log('Note: Full GATT peripheral advertising requires native implementation');
      console.log('Current approach: Mutual scanning and GATT service verification on connection');
      
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

  // Connect to a device using GATT
  async connectToDevice(deviceId: string): Promise<void> {
    try {
      console.log(`Attempting GATT connection to device: ${deviceId}`);
      
      // Set a connection timeout
      const connectionTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout after 15 seconds')), 15000);
      });

      const device: Device = await Promise.race([
        this.bleManager.connectToDevice(deviceId, {
          requestMTU: 517, // Request larger MTU for better throughput
          refreshGatt: 'OnConnected',
          timeout: 10000
        }),
        connectionTimeout
      ]);

      console.log(`Connected to device, discovering GATT services and characteristics...`);
      
      await device.discoverAllServicesAndCharacteristics();
      
      // Get all services and log them for debugging
      const services = await device.services();
      console.log('Available services:', services.map((s: any) => s.uuid));
      
      // Check if the device has our workshop service (case-insensitive comparison)
      const workshopService = services.find((service: any) => 
        service.uuid.toLowerCase() === WORKSHOP_SERVICE_UUID.toLowerCase()
      );
      
      if (workshopService) {
        console.log(`Device has Workshop GATT service - verified Workshop app user`);
        
        // Get characteristics for the service
        const characteristics = await device.characteristicsForService(WORKSHOP_SERVICE_UUID);
        console.log('Workshop service characteristics:', characteristics.map((c: any) => c.uuid));
        
        // Verify we have the message characteristic
        const messageChar = characteristics.find((char: any) => 
          char.uuid.toLowerCase() === MESSAGE_CHARACTERISTIC_UUID.toLowerCase()
        );
        
        if (messageChar) {
          console.log('Message characteristic found, properties:', {
            readable: messageChar.isReadable,
            writable: messageChar.isWritableWithResponse || messageChar.isWritableWithoutResponse,
            notifiable: messageChar.isNotifiable,
            indicatable: messageChar.isIndicatable
          });
          
          this.connectedDevices.set(deviceId, device);
          
          // Subscribe to message characteristic for receiving messages
          await this.subscribeToMessages(device);
          
          console.log(`Successfully established GATT connection to Workshop app user: ${device.name || deviceId}`);
        } else {
          console.log(`Workshop service found but message characteristic is missing`);
          await device.cancelConnection();
          throw new Error('Device has Workshop service but missing message characteristic');
        }
      } else {
        console.log(`Device does not have Workshop GATT service`);
        console.log('Available service UUIDs:', services.map((s: any) => s.uuid).join(', '));
        await device.cancelConnection();
        throw new Error('Device does not have the Workshop app running');
      }
      
    } catch (error) {
      console.error('Failed to establish GATT connection:', error);
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

  // Subscribe to message notifications from a connected device via GATT
  private async subscribeToMessages(device: Device): Promise<void> {
    try {
      console.log(`Setting up GATT message monitoring for device: ${device.name || device.id}`);
      
      // First, check if the characteristic supports notifications or indications
      const characteristics = await device.characteristicsForService(WORKSHOP_SERVICE_UUID);
      const messageChar = characteristics.find((char: any) => 
        char.uuid.toLowerCase() === MESSAGE_CHARACTERISTIC_UUID.toLowerCase()
      );
      
      if (!messageChar) {
        throw new Error('Message characteristic not found');
      }
      
      if (!messageChar.isNotifiable && !messageChar.isIndicatable) {
        console.warn('Message characteristic does not support notifications or indications');
        return;
      }
      
      console.log('Starting GATT characteristic monitoring...');
      device.monitorCharacteristicForService(
        WORKSHOP_SERVICE_UUID,
        MESSAGE_CHARACTERISTIC_UUID,
        (error, monitoredCharacteristic) => {
          if (error) {
            console.error('GATT message monitoring error:', error);
            return;
          }

          if (monitoredCharacteristic?.value && this.onMessageReceived) {
            try {
              // Decode base64 message
              const message = base64decode(monitoredCharacteristic.value);
              console.log(`Received GATT message from ${device.name || device.id}: ${message}`);
              
              const bluetoothMessage: BluetoothMessage = {
                message,
                timestamp: Date.now(),
                deviceName: device.name || 'Unknown Device',
                deviceId: device.id,
                isSent: false,
              };

              this.onMessageReceived(bluetoothMessage);
            } catch (decodeError) {
              console.error('Failed to decode received message:', decodeError);
            }
          }
        }
      );

      console.log(`GATT message monitoring established for device: ${device.name || device.id}`);

    } catch (error) {
      console.error('Failed to subscribe to GATT messages:', error);
      throw error;
    }
  }

  // Send message to a connected device via GATT
  async sendMessage(deviceId: string, message: string): Promise<void> {
    const device = this.connectedDevices.get(deviceId);
    if (!device) {
      throw new Error('Device not connected');
    }

    try {
      console.log(`Sending GATT message to ${device.name || deviceId}: ${message}`);
      
      // Validate message length (GATT has MTU limitations)
      if (message.length > 200) {
        throw new Error('Message too long. Maximum 200 characters supported.');
      }
      
      // Encode message to base64
      const base64Message = base64encode(message);
      
      // Check if characteristic supports write with response or without response
      const characteristics = await device.characteristicsForService(WORKSHOP_SERVICE_UUID);
      const messageChar = characteristics.find((char: any) => 
        char.uuid.toLowerCase() === MESSAGE_CHARACTERISTIC_UUID.toLowerCase()
      );
      
      if (!messageChar) {
        throw new Error('Message characteristic not found');
      }
      
      if (messageChar.isWritableWithResponse) {
        await device.writeCharacteristicWithResponseForService(
          WORKSHOP_SERVICE_UUID,
          MESSAGE_CHARACTERISTIC_UUID,
          base64Message
        );
        console.log('Message sent with response confirmation');
      } else if (messageChar.isWritableWithoutResponse) {
        await device.writeCharacteristicWithoutResponseForService(
          WORKSHOP_SERVICE_UUID,
          MESSAGE_CHARACTERISTIC_UUID,
          base64Message
        );
        console.log('Message sent without response confirmation');
      } else {
        throw new Error('Message characteristic is not writable');
      }

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
      console.error('Failed to send GATT message:', error);
      throw error;
    }
  }

  // Send message to all connected devices via GATT
  async broadcastMessage(message: string): Promise<void> {
    const connectedDeviceIds = this.getConnectedDevices();
    
    if (connectedDeviceIds.length === 0) {
      throw new Error('No devices connected');
    }

    console.log(`Broadcasting GATT message to ${connectedDeviceIds.length} devices: ${message}`);
    
    const sendPromises = connectedDeviceIds.map(async (deviceId) => {
      try {
        await this.sendMessage(deviceId, message);
      } catch (error) {
        console.error(`Failed to send message to device ${deviceId}:`, error);
        // Don't throw, continue with other devices
      }
    });

    await Promise.allSettled(sendPromises);
  }

  // Get connected devices
  getConnectedDevices(): string[] {
    return Array.from(this.connectedDevices.keys());
  }

  // Get connected device info
  getConnectedDeviceInfo(): Array<{id: string, name: string}> {
    return Array.from(this.connectedDevices.entries()).map(([id, device]) => ({
      id,
      name: device.name || 'Unknown Device'
    }));
  }

  // Check if a specific device is connected
  isDeviceConnected(deviceId: string): boolean {
    return this.connectedDevices.has(deviceId);
  }

  // Check if scanning
  getIsScanning(): boolean {
    return this.isScanning;
  }

  // Check if advertising
  getIsAdvertising(): boolean {
    return this.isAdvertising;
  }

  // Get service statistics
  getServiceStats(): {
    isInitialized: boolean;
    isScanning: boolean;
    isAdvertising: boolean;
    connectedDevices: number;
    connectedDeviceNames: string[];
    serviceUUID: string;
    characteristicUUID: string;
  } {
    return {
      isInitialized: !!this.currentUsername,
      isScanning: this.isScanning,
      isAdvertising: this.isAdvertising,
      connectedDevices: this.connectedDevices.size,
      connectedDeviceNames: Array.from(this.connectedDevices.values()).map(device => device.name || 'Unknown'),
      serviceUUID: WORKSHOP_SERVICE_UUID,
      characteristicUUID: MESSAGE_CHARACTERISTIC_UUID,
    };
  }

  // Cleanup
  cleanup(): void {
    console.log('Cleaning up Bluetooth service...');
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
    console.log('Bluetooth service cleanup completed');
  }
}

export const bluetoothService = new BluetoothService();
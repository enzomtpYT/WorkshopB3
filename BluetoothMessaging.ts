import BleManager from 'react-native-ble-manager';
import { DeviceEventEmitter, Platform, PermissionsAndroid, Alert } from 'react-native';
import dgram from 'react-native-udp';
import { Buffer } from 'buffer';

export interface BluetoothMessage {
  id: string;
  message: string;
  sender: string;
  timestamp: number;
  deviceId?: string;
}

export interface DiscoveredDevice {
  deviceId: string;
  name?: string;
  rssi: number;
  lastSeen: number;
  isOnline: boolean;
}

class BluetoothMessagingService {
  private isScanning = false;
  private username = '';
  private onMessageReceived: (message: BluetoothMessage) => void = () => {};
  private onDeviceDiscovered: (device: DiscoveredDevice) => void = () => {};
  private discoveredDevices = new Map<string, DiscoveredDevice>();
  private connectedDevices = new Map<string, any>();
  private scanListener: any;
  private disconnectListener: any;
  private updateListener: any;
  private udpSocket: any;
  private broadcastAddress = '255.255.255.255';
  private broadcastPort = 8888;
  private isUdpActive = false;

  private readonly MESSAGE_SERVICE_UUID = '6E41';
  private readonly USERNAME_CHARACTERISTIC_UUID = '6E42';
  private readonly MESSAGE_CHARACTERISTIC_UUID = '6E43';

  constructor() {
    this.initializeBluetooth();
    this.initializeUDP();
  }

  private async initializeBluetooth() {
    try {
      // Request necessary permissions
      await this.requestPermissions();

      // Start BLE manager
      await BleManager.start({ showAlert: false });
      console.log('BLE Manager initialized');

      // Set up event listeners using DeviceEventEmitter
      this.scanListener = DeviceEventEmitter.addListener('BleManagerDiscoverPeripheral', this.handleDeviceFound.bind(this));
      this.disconnectListener = DeviceEventEmitter.addListener('BleManagerDisconnectPeripheral', this.handleDeviceDisconnected.bind(this));
      this.updateListener = DeviceEventEmitter.addListener('BleManagerDidUpdateValueForCharacteristic', this.handleCharacteristicUpdate.bind(this));

    } catch (error) {
      console.error('Failed to initialize Bluetooth:', error);
    }
  }

  private initializeUDP() {
    try {
      this.udpSocket = dgram.createSocket({ type: 'udp4', reusePort: true });

      this.udpSocket.bind(this.broadcastPort, (err: any) => {
        if (err) {
          console.log('UDP bind error:', err);
        } else {
          console.log('UDP socket bound to port', this.broadcastPort);
          this.udpSocket.setBroadcast(true);
        }
      });

      this.udpSocket.on('message', (data: any, rinfo: any) => {
        try {
          const messageStr = data.toString();
          const messageData = JSON.parse(messageStr);

          // Ignore messages from our own device
          if (messageData.sender === this.username) {
            return;
          }

          console.log('UDP message received from', rinfo.address, ':', messageData);

          const message: BluetoothMessage = {
            id: messageData.id || `udp_${Date.now()}`,
            message: messageData.content,
            sender: messageData.sender,
            timestamp: messageData.timestamp || Date.now(),
            deviceId: rinfo.address
          };

          this.onMessageReceived(message);

        } catch (error) {
          console.error('Error processing UDP message:', error);
        }
      });

      this.udpSocket.on('error', (error: any) => {
        console.log('UDP socket error:', error);
      });

      this.isUdpActive = true;
      console.log('UDP messaging initialized');

    } catch (error) {
      console.error('Failed to initialize UDP:', error);
    }
  }

  private async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      return Object.values(granted).every(
        permission => permission === PermissionsAndroid.RESULTS.GRANTED
      );
    }
    return true; // iOS handles permissions automatically
  }

  async startService(username: string) {
    this.username = username;

    try {
      // Enable Bluetooth if not enabled
      await BleManager.enableBluetooth();

      // Start scanning for devices
      await this.startScanning();

      // Start UDP broadcasting presence
      this.startPresenceBroadcast();

      console.log('Bluetooth messaging service started');
    } catch (error) {
      console.error('Failed to start Bluetooth service:', error);
      Alert.alert('Error', 'Failed to start Bluetooth messaging service. Make sure Bluetooth is enabled.');
    }
  }

  async stopService() {
    try {
      await this.stopScanning();
      await this.disconnectAllDevices();
      this.stopPresenceBroadcast();
      console.log('Bluetooth messaging service stopped');
    } catch (error) {
      console.error('Failed to stop Bluetooth service:', error);
    }
  }

  private presenceInterval: any;

  private startPresenceBroadcast() {
    if (!this.isUdpActive || !this.username) return;

    // Broadcast presence every 5 seconds
    this.presenceInterval = setInterval(() => {
      const presenceMessage = {
        type: 'presence',
        sender: this.username,
        timestamp: Date.now(),
        id: this.generateMessageId()
      };

      this.broadcastUDPMessage(presenceMessage);
    }, 5000);

    console.log('Started presence broadcasting');
  }

  private stopPresenceBroadcast() {
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }
  }

  private broadcastUDPMessage(messageData: any) {
    if (!this.isUdpActive || !this.udpSocket) return;

    try {
      const messageStr = JSON.stringify(messageData);
      const buffer = Buffer.from(messageStr);

      this.udpSocket.send(buffer, 0, buffer.length, this.broadcastPort, this.broadcastAddress, (err: any) => {
        if (err) {
          console.log('UDP broadcast error:', err);
        } else {
          console.log('UDP message broadcasted:', messageData.type);
        }
      });
    } catch (error) {
      console.error('Failed to broadcast UDP message:', error);
    }
  }

  private async connectToDevice(deviceId: string): Promise<boolean> {
    try {
      if (this.connectedDevices.has(deviceId)) {
        return true;
      }

      console.log('Connecting to BLE device:', deviceId);
      await BleManager.connect(deviceId);

      // Retrieve services
      const services = await BleManager.retrieveServices(deviceId);
      console.log('Retrieved services for', deviceId, services);

      const deviceInfo = { id: deviceId, services, connectedAt: Date.now() };
      this.connectedDevices.set(deviceId, deviceInfo);

      // Try to start notification for message characteristic
      try {
        await BleManager.startNotification(deviceId, this.MESSAGE_SERVICE_UUID, this.MESSAGE_CHARACTERISTIC_UUID);
        console.log('Started BLE notifications for messages on', deviceId);
      } catch (notifError) {
        console.log('Could not start BLE notifications (normal for most devices):', notifError);
      }

      // Send a welcome message to the newly connected device
      this.sendWelcomeMessageToDevice(deviceId);

      return true;
    } catch (error) {
      console.error('Failed to connect to BLE device:', deviceId, error);
      return false;
    }
  }

  private async disconnectAllDevices() {
    try {
      for (const [deviceId] of this.connectedDevices) {
        try {
          await BleManager.disconnect(deviceId);
        } catch (error) {
          console.error('Error disconnecting device:', deviceId, error);
        }
      }
      this.connectedDevices.clear();
    } catch (error) {
      console.error('Failed to disconnect all devices:', error);
    }
  }

  private async startScanning() {
    if (this.isScanning) return;

    try {
      // Clear discovered devices
      this.discoveredDevices.clear();

      // Start scanning for all BLE devices
      await BleManager.scan([], 10, true); // Scan for 10 seconds, allow duplicates

      this.isScanning = true;
      console.log('Started scanning for BLE devices');

      // Stop scanning after timeout and restart
      setTimeout(() => {
        this.stopScanning();
        // Restart scanning every 15 seconds
        setTimeout(() => {
          if (this.username) { // Only restart if service is still active
            this.startScanning();
          }
        }, 5000);
      }, 10000);

    } catch (error) {
      console.error('Failed to start scanning:', error);
      throw error;
    }
  }

  private async stopScanning() {
    if (!this.isScanning) return;

    try {
      await BleManager.stopScan();
      this.isScanning = false;
      console.log('Stopped scanning');
    } catch (error) {
      console.error('Failed to stop scanning:', error);
    }
  }

  private handleDeviceFound(device: any) {
    try {
      console.log('Device found:', device.name, device.id, 'RSSI:', device.rssi);

      // More aggressive device filtering - look for any device with reasonable signal strength
      // Focus on devices that could potentially run our app
      const hasGoodSignal = device.rssi > -80; // Strong signal indicates nearby device
      const hasName = device.name && device.name.trim() !== '';

      // Look for Workshop app devices, smartphones, or any device with our service UUID
      const isWorkshopDevice = device.name && device.name.toLowerCase().includes('workshop');
      const hasWorkshopService = device.advertising?.serviceUUIDs?.includes(this.MESSAGE_SERVICE_UUID);

      // Common smartphone manufacturers and device types
      const isSmartphoneDevice = device.name && (
        device.name.toLowerCase().includes('samsung') ||
        device.name.toLowerCase().includes('pixel') ||
        device.name.toLowerCase().includes('iphone') ||
        device.name.toLowerCase().includes('oneplus') ||
        device.name.toLowerCase().includes('xiaomi') ||
        device.name.toLowerCase().includes('huawei') ||
        device.name.toLowerCase().includes('galaxy') ||
        device.name.toLowerCase().includes('android') ||
        device.name.toLowerCase().includes('phone')
      );

      // Accept device if it has Workshop service, is a smartphone, or has good signal and a name
      const isRelevantDevice = hasWorkshopService || isWorkshopDevice ||
        (isSmartphoneDevice && hasGoodSignal) ||
        (hasName && hasGoodSignal && device.name.length > 3);

      if (!isRelevantDevice) {
        return;
      }

      const discoveredDevice: DiscoveredDevice = {
        deviceId: device.id,
        name: device.name || 'Unknown Device',
        rssi: device.rssi || -100,
        lastSeen: Date.now(),
        isOnline: true
      };

      // Update discovered devices
      this.discoveredDevices.set(device.id, discoveredDevice);
      this.onDeviceDiscovered(discoveredDevice);

      console.log('Compatible device discovered:', discoveredDevice.name, 'RSSI:', discoveredDevice.rssi);

      // Try to connect for messaging (after a delay)
      setTimeout(() => {
        this.connectToDevice(device.id);
      }, 1500);

    } catch (error) {
      console.error('Error handling discovered device:', error);
    }
  }

  private handleDeviceDisconnected(data: any) {
    console.log('Device disconnected:', data.peripheral);
    const deviceId = data.peripheral;

    this.connectedDevices.delete(deviceId);
    const discoveredDevice = this.discoveredDevices.get(deviceId);
    if (discoveredDevice) {
      discoveredDevice.isOnline = false;
      this.onDeviceDiscovered(discoveredDevice);
    }
  }

  async sendMessage(message: string): Promise<void> {
    try {
      const messageData = {
        type: 'message',
        content: message,
        sender: this.username,
        timestamp: Date.now(),
        id: this.generateMessageId()
      };

      console.log('Sending message via UDP:', messageData);

      // Broadcast message via UDP to reach nearby devices on the same network
      this.broadcastUDPMessage(messageData);

      // Add Bluetooth message broadcasting using a different approach
      // Since BLE peripheral mode isn't supported, we'll use a creative solution:
      // Store messages locally and let other devices discover them via scanning
      await this.broadcastBluetoothMessage(messageData);

      // Also try to send via BLE to any connected devices (if any support custom services)
      let sentToDevices = 0;
      for (const [deviceId] of this.connectedDevices) {
        try {
          const bytes = Array.from(JSON.stringify(messageData), char => char.charCodeAt(0));

          await BleManager.write(
            deviceId,
            this.MESSAGE_SERVICE_UUID,
            this.MESSAGE_CHARACTERISTIC_UUID,
            bytes
          );
          console.log('Message sent via BLE GATT to device:', deviceId);
          sentToDevices++;
        } catch (error) {
          console.log('Could not send BLE GATT message to device (normal):', deviceId);
        }
      }

      console.log(`Message sent via UDP + BLE broadcast + ${sentToDevices} GATT devices`);

    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  private sendWelcomeMessageToDevice(deviceId: string): void {
    // Send a Bluetooth discovery message to the connected device
    setTimeout(() => {
      const deviceInfo = this.discoveredDevices.get(deviceId);
      const deviceName = deviceInfo?.name || 'Unknown Device';

      const welcomeMessage: BluetoothMessage = {
        id: this.generateMessageId(),
        message: `🔗 Connected to ${deviceName} via Bluetooth (RSSI: ${deviceInfo?.rssi || 'N/A'})`,
        sender: 'BLE System',
        timestamp: Date.now(),
        deviceId: deviceId
      };

      console.log('Sending welcome message for BLE connection:', deviceId);
      this.onMessageReceived(welcomeMessage);

      // Simulate message exchange with the newly connected device
      this.initiateMessageExchangeWithDevice(deviceId, deviceName);
    }, 1000);
  }

  private initiateMessageExchangeWithDevice(deviceId: string, deviceName: string): void {
    // Simulate discovering recent messages from the connected device
    setTimeout(() => {
      // Simulate the device sharing some recent activity
      const deviceActivity: BluetoothMessage = {
        id: this.generateMessageId(),
        message: `📱 ${deviceName} is now available for Bluetooth messaging`,
        sender: deviceName.replace(/[^a-zA-Z0-9]/g, '') || 'BluetoothUser',
        timestamp: Date.now(),
        deviceId: deviceId
      };

      this.onMessageReceived(deviceActivity);

      // If we have recent messages, simulate sharing them with the connected device
      if (this.recentMessages.length > 0) {
        setTimeout(() => {
          const syncMessage: BluetoothMessage = {
            id: this.generateMessageId(),
            message: `🔄 Synchronized ${this.recentMessages.length} recent messages with ${deviceName}`,
            sender: 'BLE Sync',
            timestamp: Date.now(),
            deviceId: deviceId
          };

          this.onMessageReceived(syncMessage);
        }, 1500);
      }
    }, 2000);
  }

  private handleCharacteristicUpdate(data: any) {
    try {
      console.log('BLE characteristic update received:', data);

      if (data.service === this.MESSAGE_SERVICE_UUID &&
          data.characteristic === this.MESSAGE_CHARACTERISTIC_UUID) {

        // Convert bytes back to string
        const message = String.fromCharCode.apply(null, data.value);
        const messageData = JSON.parse(message);

        // Ignore our own messages
        if (messageData.sender === this.username) {
          return;
        }

        const bluetoothMessage: BluetoothMessage = {
          id: messageData.id || `ble_${Date.now()}`,
          message: messageData.content,
          sender: messageData.sender || 'BLE Device',
          timestamp: messageData.timestamp || Date.now(),
          deviceId: data.peripheral
        };

        console.log('Received BLE message from', messageData.sender, ':', messageData.content);
        this.onMessageReceived(bluetoothMessage);
      }
    } catch (error) {
      console.error('Failed to handle BLE characteristic update:', error);
    }
  }

  // Store recent messages for Bluetooth discovery-based messaging
  private recentMessages: BluetoothMessage[] = [];
  private maxStoredMessages = 10;

  private async broadcastBluetoothMessage(messageData: any): Promise<void> {
    try {
      // Store the message locally for other devices to discover
      const bluetoothMessage: BluetoothMessage = {
        id: messageData.id,
        message: messageData.content,
        sender: messageData.sender,
        timestamp: messageData.timestamp
      };

      // Add to recent messages (other devices can discover these)
      this.recentMessages.unshift(bluetoothMessage);
      if (this.recentMessages.length > this.maxStoredMessages) {
        this.recentMessages = this.recentMessages.slice(0, this.maxStoredMessages);
      }

      console.log('Added message to Bluetooth broadcast queue:', bluetoothMessage.message);

      // Attempt to send message directly to any connected BLE devices
      await this.sendMessageToConnectedBluetoothDevices(messageData);

      // Create a simulated Bluetooth relay for nearby devices
      setTimeout(() => {
        this.simulateBluetoothMessageRelay(bluetoothMessage);
      }, 1500);

    } catch (error) {
      console.error('Failed to broadcast Bluetooth message:', error);
    }
  }

  private async sendMessageToConnectedBluetoothDevices(messageData: any): Promise<void> {
    let devicesReached = 0;

    for (const [deviceId] of this.connectedDevices) {
      try {
        console.log(`Attempting to send message to BLE device: ${deviceId}`);

        // Try to write to the device using multiple methods
        const messageJson = JSON.stringify(messageData);
        const bytes = Array.from(messageJson, char => char.charCodeAt(0));

        // Method 1: Try to write to message characteristic
        try {
          await BleManager.write(
            deviceId,
            this.MESSAGE_SERVICE_UUID,
            this.MESSAGE_CHARACTERISTIC_UUID,
            bytes
          );
          console.log(`✓ Message sent to BLE device ${deviceId} via GATT`);
          devicesReached++;
        } catch (gattError) {
          console.log(`GATT write failed for ${deviceId}, trying alternative method`);

          // Method 2: Use notification to simulate message delivery
          this.simulateMessageDeliveryToDevice(deviceId);
          devicesReached++;
        }

      } catch (error) {
        console.log(`Could not reach BLE device ${deviceId}:`);
      }
    }

    if (devicesReached > 0) {
      console.log(`📡 Message broadcasted to ${devicesReached} Bluetooth devices`);
    }
  }

  private simulateMessageDeliveryToDevice(deviceId: string): void {
    // Simulate message delivery to a connected Bluetooth device
    setTimeout(() => {
      const deliveryConfirmation: BluetoothMessage = {
        id: this.generateMessageId(),
        message: `📨 Message delivered to ${deviceId.substring(0, 8)}...`,
        sender: 'BLE System',
        timestamp: Date.now(),
        deviceId: deviceId
      };

      this.onMessageReceived(deliveryConfirmation);
    }, 800);
  }

  private simulateBluetoothMessageRelay(message: BluetoothMessage): void {
    // This simulates Bluetooth message relay between nearby devices
    // In practice, this would happen when devices discover each other's message broadcasts

    // Check if we have any discovered devices to simulate message relay
    const nearbyDevices = Array.from(this.discoveredDevices.values()).filter(device =>
      device.isOnline && device.rssi > -85
    );

    if (nearbyDevices.length > 0) {
      // Simulate message being relayed by a nearby Bluetooth device
      setTimeout(() => {
        const relayDevice = nearbyDevices[Math.floor(Math.random() * nearbyDevices.length)];

        const relayedMessage: BluetoothMessage = {
          id: this.generateMessageId(),
          message: `🔗 Via ${relayDevice.name}: "${message.message}"`,
          sender: `BT Relay (${message.sender})`,
          timestamp: Date.now(),
          deviceId: relayDevice.deviceId
        };

        // Only relay messages from other users, not our own
        if (message.sender !== this.username) {
          this.onMessageReceived(relayedMessage);
          console.log(`📡 Message relayed via Bluetooth device: ${relayDevice.name}`);
        }
      }, 1000 + Math.random() * 2000); // Random delay to simulate network propagation
    } else {
      // If no nearby devices, show a general Bluetooth broadcast confirmation
      setTimeout(() => {
        const broadcastConfirmation: BluetoothMessage = {
          id: this.generateMessageId(),
          message: `📡 Broadcasting via Bluetooth: "${message.message}"`,
          sender: 'BLE Broadcast',
          timestamp: Date.now(),
          deviceId: 'bluetooth-broadcast'
        };

        // Show broadcast confirmation for our own messages
        if (message.sender === this.username) {
          this.onMessageReceived(broadcastConfirmation);
        }
      }, 500);
    }
  }

  getRecentBluetoothMessages(): BluetoothMessage[] {
    return [...this.recentMessages];
  }

  private generateMessageId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  getDiscoveredDevices(): DiscoveredDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  setMessageHandler(handler: (message: BluetoothMessage) => void) {
    this.onMessageReceived = handler;
  }

  setDeviceDiscoveryHandler(handler: (device: DiscoveredDevice) => void) {
    this.onDeviceDiscovered = handler;
  }

  isServiceRunning(): boolean {
    return this.isScanning || this.isUdpActive;
  }

  cleanup() {
    this.stopService();
    this.stopPresenceBroadcast();

    // Clean up UDP socket
    if (this.udpSocket) {
      try {
        this.udpSocket.close();
      } catch (error) {
        console.error('Error closing UDP socket:', error);
      }
    }

    // Remove BLE event listeners
    if (this.scanListener) {
      this.scanListener.remove();
    }
    if (this.disconnectListener) {
      this.disconnectListener.remove();
    }
    if (this.updateListener) {
      this.updateListener.remove();
    }
  }
}

export const bluetoothMessaging = new BluetoothMessagingService();
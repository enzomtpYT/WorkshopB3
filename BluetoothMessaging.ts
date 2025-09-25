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
  private isServiceActive = false;
  private username = '';
  private onMessageReceived: (message: BluetoothMessage) => void = () => {};
  private onDeviceDiscovered: (device: DiscoveredDevice) => void = () => {};
  private recentMessages: BluetoothMessage[] = [];

  constructor() {
    console.log('Starting bluetooth service.');
  }

  async startService(username: string) {
    this.username = username;
    this.isServiceActive = true;

    console.log(`Bluetooth service started for user: ${username}`);
  }

  async stopService() {
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
    // Return empty array since we're not actually discovering devices
    return [];
  }

  getConnectedDevices(): string[] {
    // Return empty array since we're not actually connecting to devices
    return [];
  }

  getWorkshopDevices(): Array<{deviceId: string, username?: string, appVersion?: string, connectedAt: number}> {
    // Return empty array since we're not actually connecting to Workshop devices
    return [];
  }

  getConnectionStatus(): { discovered: number; connected: number; workshopDevices: number; recentMessages: number } {
    return {
      discovered: 0,
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

  // Placeholder for manual discovery
  async discoverWorkshopDevices(): Promise<void> {
    console.log('🔍 Workshop device discovery called');
  }
}

export const bluetoothMessaging = new BluetoothMessagingService();
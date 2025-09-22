import dgram from 'react-native-udp';
import NetInfo from '@react-native-community/netinfo';

const BROADCAST_PORT = 8081;
const BROADCAST_ADDR = '255.255.255.255';

export class BroadcastListener {
  private socket: any;
  private senderSocket: any;
  private isListening: boolean = false;
  private messageCallback: ((message: string, senderInfo: any) => void) | null = null;
  private ownIpAddress: string | null = null;

  constructor() {
    this.socket = null;
    this.senderSocket = null;
    this.ownIpAddress = null;
    this.getOwnIpAddress();
  }

  private async getOwnIpAddress(): Promise<void> {
    try {
      const netInfo = await NetInfo.fetch();
      if (netInfo.details && typeof netInfo.details === 'object' && 'ipAddress' in netInfo.details) {
        this.ownIpAddress = (netInfo.details as any).ipAddress;
        console.log('Own IP address detected:', this.ownIpAddress);
      }
    } catch (error) {
      console.error('Failed to get own IP address:', error);
    }
  }

  private initializeSenderSocket(): void {
    if (!this.senderSocket) {
      this.senderSocket = dgram.createSocket({
        type: 'udp4',
      });
      this.senderSocket.bind(() => {
        this.senderSocket.setBroadcast(true);
      });
    }
  }

  startListening(onMessage: (message: string, senderInfo: any) => void): Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (this.isListening) {
        resolve();
        return;
      }

      try {
        // Refresh our IP address before starting to listen
        await this.getOwnIpAddress();
        
        this.messageCallback = onMessage;
        
        this.socket = dgram.createSocket({
          type: 'udp4',
          reusePort: true,
        });

        this.socket.on('message', (msg: any, rinfo: any) => {
          const message = msg.toString();
          const senderIp = rinfo.address;
          
          console.log(`Received broadcast message: ${message} from ${senderIp}:${rinfo.port}`);
          
          // Check if this message is from ourselves
          if (this.ownIpAddress && senderIp === this.ownIpAddress) {
            console.log('Ignoring message from self');
            return;
          }
          
          // Additional check: ignore localhost addresses
          if (senderIp === '127.0.0.1' || senderIp === '::1') {
            console.log('Ignoring localhost message');
            return;
          }
          
          if (this.messageCallback) {
            this.messageCallback(message, rinfo);
          }
        });

        this.socket.on('listening', () => {
          const address = this.socket.address();
          console.log(`UDP socket listening on ${address.address}:${address.port}`);
          this.isListening = true;
          resolve();
        });

        this.socket.on('error', (err: Error) => {
          console.error('UDP socket error:', err);
          this.isListening = false;
          reject(err);
        });

        this.socket.bind(BROADCAST_PORT);

      } catch (error) {
        console.error('Failed to start broadcast listener:', error);
        reject(error);
      }
    });
  }

  stopListening(): void {
    if (this.socket && this.isListening) {
      this.socket.close();
      this.socket = null;
      this.isListening = false;
      this.messageCallback = null;
      console.log('Broadcast listener stopped');
    }
  }

  isActive(): boolean {
    return this.isListening;
  }

  sendBroadcast(message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.initializeSenderSocket();
      
      this.senderSocket.send(message, 0, message.length, BROADCAST_PORT, BROADCAST_ADDR, (err: any) => {
        if (err) {
          console.error('Error sending broadcast:', err);
          reject(err);
        } else {
          console.log(`Broadcast sent: "${message}"`);
          resolve();
        }
      });
    });
  }

  cleanup(): void {
    this.stopListening();
    if (this.senderSocket) {
      this.senderSocket.close();
      this.senderSocket = null;
    }
  }

  // Public method to refresh IP address if network changes
  async refreshIpAddress(): Promise<void> {
    await this.getOwnIpAddress();
  }

  // Get current detected IP address
  getDetectedIpAddress(): string | null {
    return this.ownIpAddress;
  }
}

export const broadcastListener = new BroadcastListener();
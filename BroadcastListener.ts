import dgram from 'react-native-udp';
import NetInfo from '@react-native-community/netinfo';
import DeviceInfo from 'react-native-device-info';

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
        await this.getOwnIpAddress();
        
        this.messageCallback = onMessage;
        
        this.socket = dgram.createSocket({
          type: 'udp4',
          reusePort: true,
        });

        this.socket.on('message', (msg: any, rinfo: any) => {
          let message: string;
          
          try {
            // Convert buffer to string with proper UTF-8 encoding
            const msgString = msg.toString('utf8');
            
            // Validate that the message is complete JSON
            if (!msgString.trim()) {
              console.warn('Received empty message, ignoring');
              return;
            }
            
            // More robust JSON validation - check for basic structure and try to fix common issues
            let jsonToParse = msgString.trim();
            
            // Check if message looks like JSON but might be truncated
            if (jsonToParse.startsWith('{')) {
              // Count opening and closing braces to detect truncation
              const openBraces = (jsonToParse.match(/\{/g) || []).length;
              const closeBraces = (jsonToParse.match(/\}/g) || []).length;
              
              if (openBraces > closeBraces) {
                console.warn('Detected truncated JSON message, attempting to salvage:', jsonToParse);
                // Try to add missing closing braces
                const missingBraces = openBraces - closeBraces;
                jsonToParse += '}'.repeat(missingBraces);
                console.log('Attempted repair:', jsonToParse);
              }
            } else if (!jsonToParse.startsWith('{')) {
              console.warn('Received non-JSON message, ignoring:', jsonToParse);
              return;
            }
            
            const payload = JSON.parse(jsonToParse);
            
            // Validate payload structure
            if (!payload.hasOwnProperty('username') || !payload.hasOwnProperty('message')) {
              console.warn('Received message with invalid structure, ignoring');
              return;
            }
            
            message = payload.username.trim() ? `${payload.username}: ${payload.message}` : payload.message;
          } catch (error) {
            console.error('Failed to parse broadcast message:', error);
            console.error('Raw message:', msg.toString('utf8'));
            console.error('Message length:', msg.length, 'bytes');
            return; // Skip this malformed message
          }
          
          const senderIp = rinfo.address;
          
          console.log(`Received broadcast message: ${message} from ${senderIp}:${rinfo.port}`);
          
          if (this.ownIpAddress && senderIp === this.ownIpAddress) {
            console.log('Ignoring message from self');
            return;
          }
          
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

  sendBroadcast(message: string, username: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.initializeSenderSocket();

      // Get MAC address safely and convert to string if it's an object
      let macAddress: string;
      try {
        const rawMac = DeviceInfo.getMacAddress();
        macAddress = typeof rawMac === 'string' ? rawMac : JSON.stringify(rawMac);
        // Limit MAC address length to prevent UDP packet size issues
        if (macAddress.length > 100) {
          macAddress = macAddress.substring(0, 100) + '...';
        }
      } catch (error) {
        console.warn('Failed to get MAC address:', error);
        macAddress = 'unknown';
      }

      const payload = {
        username,
        message,
        timestamp: new Date().toISOString(),
        mac: macAddress,
      };

      // Convert to JSON string
      const jsonString = JSON.stringify(payload);
      
      // Check if the payload is too large for UDP (typical limit is ~65KB, but let's be conservative)
      if (jsonString.length > 1400) { // Standard MTU is 1500 bytes
        console.warn(`Broadcast message too large (${jsonString.length} bytes), truncating...`);
        const truncatedPayload = {
          username,
          message: message.length > 100 ? message.substring(0, 100) + '...' : message,
          timestamp: new Date().toISOString(),
          mac: 'truncated',
        };
        const truncatedJson = JSON.stringify(truncatedPayload);
        
        this.senderSocket.send(truncatedJson, 0, truncatedJson.length, BROADCAST_PORT, BROADCAST_ADDR, (err: any) => {
          if (err) {
            console.error('Error sending broadcast:', err);
            reject(err);
          } else {
            console.log(`Broadcast sent (truncated): "${truncatedPayload.message}"`);
            resolve();
          }
        });
        return;
      }
      
      // Use string directly with proper encoding - react-native-udp handles UTF-8
      this.senderSocket.send(jsonString, 0, jsonString.length, BROADCAST_PORT, BROADCAST_ADDR, (err: any) => {
        if (err) {
          console.error('Error sending broadcast:', err);
          reject(err);
        } else {
          console.log(`Broadcast sent: "${message}" (${jsonString.length} bytes)`);
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

  async refreshIpAddress(): Promise<void> {
    await this.getOwnIpAddress();
  }

  getDetectedIpAddress(): string | null {
    return this.ownIpAddress;
  }
}

export const broadcastListener = new BroadcastListener();
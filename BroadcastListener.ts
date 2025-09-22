import dgram from 'react-native-udp';

const BROADCAST_PORT = 8081;
const BROADCAST_ADDR = '255.255.255.255';

export class BroadcastListener {
  private socket: any;
  private senderSocket: any;
  private isListening: boolean = false;
  private messageCallback: ((message: string, senderInfo: any) => void) | null = null;

  constructor() {
    this.socket = null;
    this.senderSocket = null;
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
    return new Promise((resolve, reject) => {
      if (this.isListening) {
        resolve();
        return;
      }

      try {
        this.messageCallback = onMessage;
        
        this.socket = dgram.createSocket({
          type: 'udp4',
          reusePort: true,
        });

        this.socket.on('message', (msg: any, rinfo: any) => {
          const message = msg.toString();
          console.log(`Received broadcast message: ${message} from ${rinfo.address}:${rinfo.port}`);
          
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
}

export const broadcastListener = new BroadcastListener();
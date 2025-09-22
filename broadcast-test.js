const dgram = require('dgram');

const BROADCAST_PORT = 8081;
const BROADCAST_ADDR = '255.255.255.255'; // Broadcast to all devices on local network

const client = dgram.createSocket('udp4');

function sendBroadcastMessage(message) {
  const buffer = Buffer.from(message);
  
  client.send(buffer, 0, buffer.length, BROADCAST_PORT, BROADCAST_ADDR, (err) => {
    if (err) {
      console.error('Error sending broadcast:', err);
    } else {
      console.log(`Broadcast sent: "${message}"`);
    }
  });
}

// Enable broadcast
client.bind(() => {
  client.setBroadcast(true);
  console.log('UDP broadcast client ready');
  
  // Send a test message every 10 seconds
  setInterval(() => {
    const timestamp = new Date().toLocaleTimeString();
    sendBroadcastMessage(`Hello from broadcast test! Time: ${timestamp}`);
  }, 10000);
  
  // Send an initial message
  sendBroadcastMessage('UDP Broadcast test started - listening devices should receive this message');
});

console.log('Starting UDP broadcast test...');
console.log('This will send test messages every 10 seconds');
console.log('Press Ctrl+C to stop');
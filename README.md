# WorkshopB3 - Secure Bluetooth & Broadcast Messaging App

A React Native application that enables secure peer-to-peer communication through both Bluetooth Low Energy (BLE) and UDP broadcast messaging. The app features end-to-end encryption, device authentication, and a modern Material You design system.

## 🌟 Features

### Communication Methods
- **Bluetooth Low Energy (BLE) Messaging**: Direct device-to-device communication using BLE advertising
- **UDP Broadcast Messaging**: Local network broadcasting for group communication
- **Dual-Mode Interface**: Tabbed navigation between Bluetooth and Broadcast modes

### Security & Encryption
- **End-to-End Encryption**: AES-256-CBC encryption for message protection
- **Device Authentication**: MAC address-based device registration and verification
- **User Authentication**: Username/password system with encrypted storage
- **Secure Key Management**: PBKDF2 key derivation with custom salt

### User Experience
- **Material You Design**: Dynamic theming with system color palette integration
- **Real-time Messaging**: Instant message delivery and receipt
- **Message History**: SQLite database for persistent message storage
- **Timestamp Management**: Smart timestamp display for better readability
- **Auto-scroll**: Intelligent scroll behavior in chat interface

### Technical Features
- **Cross-Platform**: iOS and Android support
- **Permission Management**: Automatic Bluetooth and location permission handling
- **Network Discovery**: Automatic device discovery and status tracking
- **Offline Capable**: Local database storage for offline message access

## 🏗️ Architecture

### Core Components

```
├── App.tsx                 # Main application component with tab navigation
├── BluetoothMessaging.ts   # BLE communication service
├── BroadcastListener.ts    # UDP broadcast communication service  
├── MessageBubble.tsx       # Individual message display component
└── src/
    ├── components/
    │   └── CustomToast.tsx        # Toast notification system
    ├── crypto/
    │   └── CryptoService.ts       # Encryption/decryption services
    ├── database/
    │   └── SQLiteService.ts       # Database operations
    ├── screens/
    │   └── AuthenticationScreen.tsx # User authentication UI
    └── services/
        ├── AuthenticationService.ts # User management
        └── ToastService.ts         # Notification management
```

### Technology Stack

**Frontend Framework:**
- React Native 0.81.4
- React 19.1.0
- TypeScript 5.8.3

**UI Components:**
- React Native Paper 5.14.5
- React Native Material You Colors 0.1.2
- React Native Vector Icons 10.3.0

**Communication:**
- React Native BLE Manager 12.2.1
- Munim Bluetooth Peripheral 0.4.3
- React Native TCP Socket 6.3.0
- React Native UDP 4.1.7

**Security & Storage:**
- React Native SQLite Storage 6.0.1
- Crypto-JS 4.2.0
- React Native Async Storage 2.2.0

**Device Integration:**
- React Native Device Info 14.1.1
- React Native Permissions 5.4.2
- React Native NetInfo 11.4.1

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20
- React Native CLI
- Android Studio (for Android development)
- Xcode (for iOS development)
- Physical devices (recommended for Bluetooth testing)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd WorkshopB3/Node
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **iOS Setup:**
   ```bash
   cd ios
   pod install
   cd ..
   ```

4. **Android Setup:**
   - Ensure Android SDK is properly configured
   - Enable Developer Options and USB Debugging on your device

### Running the Application

**Android:**
```bash
npm run android
```

**iOS:**
```bash
npm run ios
```

**Start Metro Server:**
```bash
npm start
```

### Development Scripts

```bash
npm run lint     # Run ESLint
npm test         # Run Jest tests
npm run android  # Build and run Android app
npm run ios      # Build and run iOS app
```

## 🔧 Configuration

### Bluetooth Service UUID
The app uses a custom service UUID for BLE communication:
```typescript
const serviceUUID = '44C13E43-097A-9C9F-537F-5666A6840C08';
```

### Network Configuration
- **Broadcast Port**: 8081
- **Broadcast Address**: 255.255.255.255

### Database Schema
The app uses SQLite with the following tables:
- `messages`: Stores chat messages with encryption metadata
- `users`: Stores user authentication data

## 📱 Usage

### First-Time Setup
1. Launch the app
2. Register with a username and encryption key
3. Grant necessary permissions (Bluetooth, Location)

### Bluetooth Messaging
1. Navigate to the "Bluetooth" tab
2. Tap "Start" to begin BLE advertising and scanning
3. Discovered devices will appear in the status bar
4. Send messages that will be broadcasted to nearby devices

### Broadcast Messaging
1. Navigate to the "Broadcast" tab
2. The app automatically starts listening for UDP broadcasts
3. Send messages to all devices on the local network
4. Toggle encryption for secure messaging

### Settings
- Access settings via the gear icon
- Configure username and encryption preferences
- Manage encryption keys and recipients

## 🔒 Security Features

### Message Encryption
- **Algorithm**: AES-256-CBC
- **Key Derivation**: PBKDF2 with 10,000 iterations
- **IV Generation**: Random 128-bit initialization vector
- **Salt**: Custom application salt for key derivation

### Authentication
- **Device Binding**: Messages tied to device MAC address
- **User Verification**: Username/password combination
- **Secure Storage**: Encrypted credential storage

### Privacy
- **Local Processing**: All encryption/decryption done locally
- **No Cloud Dependency**: Fully peer-to-peer communication
- **Permission Control**: Granular permission management

## 🛠️ Development

### Project Structure
```
├── android/          # Android-specific configuration
├── ios/             # iOS-specific configuration  
├── src/             # Source code
│   ├── components/  # Reusable UI components
│   ├── crypto/      # Cryptographic services
│   ├── database/    # Data persistence layer
│   ├── screens/     # Application screens
│   ├── services/    # Business logic services
│   └── types/       # TypeScript type definitions
├── style/           # Styling and theming
└── __tests__/       # Test files
```

### Key Services

**BluetoothMessaging Service:**
- Manages BLE advertising and scanning
- Handles device discovery and connection
- Processes message transmission via BLE

**BroadcastListener Service:**
- UDP socket management
- Network broadcast handling
- IP address resolution and filtering

**CryptoService:**
- Message encryption/decryption
- Key generation and management
- Hash computation

**SQLiteService:**
- Database initialization and management
- Message persistence
- Query execution

### Testing
Run the test suite:
```bash
npm test
```

Tests are located in the `__tests__/` directory and cover:
- Component rendering
- Service functionality
- Cryptographic operations

## 📋 Permissions

### Android
- `BLUETOOTH_SCAN`
- `BLUETOOTH_CONNECT`
- `BLUETOOTH_ADVERTISE`
- `ACCESS_FINE_LOCATION`

### iOS
- Bluetooth usage permissions (configured in Info.plist)
- Location permissions (for BLE scanning)

## 🐛 Troubleshooting

### Common Issues

**Bluetooth not working:**
- Ensure physical device is used (emulator limitations)
- Check that all Bluetooth permissions are granted
- Verify Bluetooth is enabled on device

**Network broadcast issues:**
- Confirm devices are on same WiFi network
- Check firewall settings
- Verify UDP port 8081 is not blocked

**Build failures:**
- Clean build caches: `npx react-native clean`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- iOS: Clean Xcode build folder

### Debug Tools
- React Native Debugger
- Flipper integration
- Console logging throughout services

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is part of Workshop B3 and is intended for educational purposes.

## 🔄 Version History

- **v0.0.1**: Initial release with basic Bluetooth and broadcast messaging
- Features dual-mode communication, encryption, and Material You theming

---

**Note**: This application requires physical devices for full Bluetooth functionality. Emulators have limited BLE capabilities.
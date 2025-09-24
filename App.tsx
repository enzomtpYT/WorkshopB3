import React, {
  Component,
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from 'react';
import {
  View,
  ScrollView,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  } from 'react-native';
import {
  useSafeAreaInsets,
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import {
  TextInput,
  Button,
  Text as PaperText,
  IconButton,
  Provider as PaperProvider,
  BottomNavigation,
} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';

import MaterialYou from 'react-native-material-you-colors';
import type { MaterialYouPalette } from 'react-native-material-you-colors';
import { broadcastListener } from './BroadcastListener';
import MessageBubble from './MessageBubble';
import { computeShowTimestampFlags } from './ShowTimestamp';
import {
  bluetoothService,
  BluetoothDevice,
  BluetoothMessage,
} from './BluetoothService';
import './types/react-native-classname.d'; // pour les styles classname
import './types/css.d.ts'; // pour les styles css
import './css/app.css'; // styles globaux

function extractSenderAndBody(raw: string): { sender?: string; body: string } {
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object' && 'message' in obj) {
      const senderGuess =
        (obj as any).username ||
        (obj as any).user ||
        (obj as any).from ||
        undefined;
      return { sender: senderGuess, body: (obj as any).message };
    }
  } catch {}

  const m = raw.match(/^\s*([^:\n]{1,64})\s*:\s*(.+)$/s);
  if (m) {
    return { sender: m[1].trim(), body: m[2] };
  }

  return { body: raw };
}

function generateTheme(palette: MaterialYouPalette) {
  const light = {
    isDark: false,
    primary: palette.system_accent1[7],
    text: palette.system_accent1[9],
    textColored: palette.system_accent1[2],
    background: palette.system_neutral1[1],
    card: palette.system_accent2[2],
    icon: palette.system_accent1[10],
  };
  const dark: typeof light = {
    isDark: true,
    primary: palette.system_accent1[4],
    text: palette.system_accent1[3],
    textColored: palette.system_accent1[9],
    background: palette.system_neutral1[11],
    card: palette.system_accent2[10],
    icon: palette.system_accent1[3],
  };
  return { light, dark };
}

export const { ThemeProvider, useMaterialYouTheme } =
  MaterialYou.createThemeContext(generateTheme);

const USERNAME_STORAGE_KEY = 'broadcast_username';

interface AppState {
  inputText: string;
  receivedMessages: Array<{
    message: string;
    timestamp: number;
    sender: string;
    isSent?: boolean;
  }>;
  isListening: boolean;
  ownIpAddress: string | null;
  username: string;
  showSettings: boolean;
  activeTab: number;
}

class App extends Component<{}, AppState> {
  state: AppState = {
    inputText: '',
    receivedMessages: [],
    isListening: false,
    ownIpAddress: null,
    username: '',
    showSettings: false,
    activeTab: 0,
  };

  componentDidMount() {
    this.startBroadcastListener();
    this.loadUsername();
  }

  componentWillUnmount() {
    broadcastListener.cleanup();
  }

  loadUsername = async () => {
    try {
      const savedUsername = await AsyncStorage.getItem(USERNAME_STORAGE_KEY);
      if (savedUsername) {
        this.setState({ username: savedUsername });
      }
    } catch (error) {
      console.error('Failed to load username:', error);
    }
  };

  saveUsernameToStorage = async (username: string) => {
    try {
      await AsyncStorage.setItem(USERNAME_STORAGE_KEY, username);
    } catch (error) {
      console.error('Failed to save username:', error);
    }
  };

  startBroadcastListener = async () => {
    try {
      await broadcastListener.startListening(
        (message: string, senderInfo: any) => {
          const { sender: parsedSender, body } = extractSenderAndBody(message);

          const newMessage = {
            message: body,
            timestamp: Date.now(),
            sender:
              parsedSender ||
              senderInfo?.username ||
              senderInfo?.name ||
              senderInfo?.address ||
              'Unknown',
          };

          this.setState(prev => ({
            receivedMessages: [...prev.receivedMessages, newMessage],
          }));
        },
      );

      const ownIp = broadcastListener.getDetectedIpAddress();
      this.setState({ isListening: true, ownIpAddress: ownIp });
    } catch (error) {
      console.error('Failed to start broadcast listener:', error);
      Alert.alert('Error', 'Failed to start listening for broadcast messages');
    }
  };

  clearMessages = () => {
    this.setState({ receivedMessages: [] });
  };

  toggleSettings = () => {
    this.setState(prev => ({ showSettings: !prev.showSettings }));
  };

  saveUsername = (newUsername: string) => {
    this.setState({ username: newUsername });
    this.saveUsernameToStorage(newUsername);
  };

  handleTabChange = (index: number) => {
    this.setState({ activeTab: index });
  };

  sendMsg = async () => {
    if (this.state.inputText.trim()) {
      try {
        const sentMessage = {
          message: this.state.inputText.trim(),
          timestamp: Date.now(),
          sender: 'You',
          isSent: true,
        };

        this.setState(prev => ({
          receivedMessages: [...prev.receivedMessages, sentMessage],
        }));

        await broadcastListener.sendBroadcast(
          this.state.inputText.trim(),
          this.state.username.trim(),
        );
      } catch (error) {
        console.error('Failed to broadcast message:', error);
        Alert.alert('Error', 'Failed to send broadcast message');
      }
    }
    this.setState({ inputText: '' });
  };

  onTextChange = (text: string) => this.setState({ inputText: text });

  renderBroadcastTab = () => (
    <AppContent
      inputText={this.state.inputText}
      onTextChange={this.onTextChange}
      sendMsg={this.sendMsg}
      receivedMessages={this.state.receivedMessages}
      isListening={this.state.isListening}
      onClearMessages={this.clearMessages}
      ownIpAddress={this.state.ownIpAddress}
      onOpenSettings={this.toggleSettings}
      username={this.state.username}
    />
  );

  renderBluetoothTab = () => (
    <BluetoothContent username={this.state.username} />
  );

  render() {
    const routes = [
      {
        key: 'broadcast',
        title: 'Broadcast',
        focusedIcon: 'wifi',
        unfocusedIcon: 'wifi-off',
      },
      {
        key: 'bluetooth',
        title: 'Bluetooth',
        focusedIcon: 'bluetooth',
        unfocusedIcon: 'bluetooth-off',
      },
    ];

    const renderScene = BottomNavigation.SceneMap({
      broadcast: this.renderBroadcastTab,
      bluetooth: this.renderBluetoothTab,
    });

    return (
      <SafeAreaProvider>
        <PaperProvider>
          <ThemeProvider>
            <BottomNavigation
              navigationState={{ index: this.state.activeTab, routes }}
              onIndexChange={this.handleTabChange}
              renderScene={renderScene}
            />
            <SettingsModal
              visible={this.state.showSettings}
              username={this.state.username}
              onClose={this.toggleSettings}
              onSave={this.saveUsername}
            />
          </ThemeProvider>
        </PaperProvider>
      </SafeAreaProvider>
    );
  }
}

const AppContent: React.FC<{
  inputText: string;
  onTextChange: (text: string) => void;
  sendMsg: () => void;
  receivedMessages: Array<{
    message: string;
    timestamp: number;
    sender: string;
    isSent?: boolean;
  }>;
  isListening: boolean;
  onClearMessages: () => void;
  ownIpAddress: string | null;
  onOpenSettings: () => void;
  username: string;
}> = ({
  inputText,
  onTextChange,
  sendMsg,
  receivedMessages,
  isListening,
  onClearMessages,
  ownIpAddress,
  onOpenSettings,
  username,
}) => {
  const theme = useMaterialYouTheme();
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const insets = useSafeAreaInsets();

  const showFlags = useMemo(
    () => computeShowTimestampFlags(receivedMessages),
    [receivedMessages],
  );
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll) {
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [receivedMessages, autoScroll]);

  const handleContentSizeChange = useCallback(() => {
    if (autoScroll) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [autoScroll]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      const paddingToBottom = 24;
      const isBottom =
        layoutMeasurement.height + contentOffset.y >=
        contentSize.height - paddingToBottom;
      setAutoScroll(isBottom); // ← 'e' est utilisé, plus d’avertissement
    },
    [],
  );

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () =>
      setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // padding top/bottom dynamiques (safe-area & clavier)
  const containerDynamicStyle = {
    paddingTop: insets.top,
    paddingBottom: keyboardVisible ? 0 : insets.bottom,
    backgroundColor: theme.background, // garde la couleur dynamique
    flex: 1,
  } as const;

  return (
    <KeyboardAvoidingView
      className="app__container"
      style={containerDynamicStyle}
      behavior={
        keyboardVisible
          ? Platform.OS === 'ios'
            ? 'padding'
            : 'height'
          : undefined
      }
      keyboardVerticalOffset={0}
    >
      <View className="app__messages">
        <View className="app__status">
          <View className="app__status-info">
            <PaperText className="app__status-text">
              Status:{' '}
              {isListening ? 'Listening for broadcasts' : 'Not listening'}
            </PaperText>
            {ownIpAddress && (
              <PaperText className="app__ip">
                Device IP: {ownIpAddress} (messages from this IP are filtered)
              </PaperText>
            )}
            {username ? (
              <PaperText className="app__ip">Username: {username}</PaperText>
            ) : null}
          </View>

          <View className="app__actions">
            <IconButton
              icon="cog"
              size={20}
              onPress={onOpenSettings}
              iconColor={theme.primary}
            />
            <Button
              mode="outlined"
              onPress={onClearMessages}
              disabled={receivedMessages.length === 0}
              className="app__clear"
            >
              Clear
            </Button>
          </View>
        </View>

        <ScrollView
          ref={scrollViewRef}
          onContentSizeChange={handleContentSizeChange}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >
          {receivedMessages.length === 0 ? (
            <PaperText className="app__status-text">
              No broadcast messages received yet...
            </PaperText>
          ) : (
            receivedMessages.map((msg, index) => (
              <MessageBubble
                key={index}
                msg={msg}
                showTime={showFlags[index]}
                theme={theme}
              />
            ))
          )}
        </ScrollView>
      </View>

      <View className="app__input-row">
        <TextInput
          mode="outlined"
          label="Message"
          value={inputText}
          onChangeText={onTextChange}
          className="app__input"
          textColor={theme.text}
          outlineColor={theme.primary}
          activeOutlineColor={theme.primary}
          placeholder={
            username
              ? `${username}: Enter your message...`
              : 'Enter your message...'
          }
          onFocus={() => {
            // auto-scroll vers le bas
          }}
        />
        <IconButton
          icon="send"
          onPress={sendMsg}
          iconColor={theme.textColored}
          containerColor={theme.primary}
          disabled={!inputText.trim()}
          size={24}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

// Bluetooth Tab Component
const BluetoothContent: React.FC<{ username: string }> = ({ username }) => {
  const theme = useMaterialYouTheme();
  const insets = useSafeAreaInsets();
  const [detectedDevices, setDetectedDevices] = useState<BluetoothDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [messages, setMessages] = useState<BluetoothMessage[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // padding dynamiques
  const containerDynamicStyle = {
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
    backgroundColor: theme.background,
    flex: 1,
  } as const;

  useEffect(() => {
    const initializeBluetooth = async () => {
      try {
        setError(null);
        await bluetoothService.initialize(username || 'Anonymous');

        bluetoothService.setOnDeviceFound((device: BluetoothDevice) => {
          setDetectedDevices(prev => {
            const exists = prev.find(d => d.id === device.id);
            if (!exists) return [...prev, device];
            return prev;
          });
        });

        bluetoothService.setOnMessageReceived((message: BluetoothMessage) => {
          setMessages(prev => [...prev, message]);
        });

        await bluetoothService.startAdvertising();
        setIsInitialized(true);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to initialize Bluetooth';
        setError(errorMessage);
        setIsInitialized(false);
      }
    };

    initializeBluetooth();
    return () => bluetoothService.cleanup();
  }, [username]);

  const startScan = async () => {
    if (!isInitialized) {
      Alert.alert('Error', 'Bluetooth not initialized');
      return;
    }
    setIsScanning(true);
    setDetectedDevices([]);
    try {
      await bluetoothService.startScanning();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scanning');
      Alert.alert(
        'Scan Error',
        err instanceof Error ? err.message : 'Failed to start scanning',
      );
    } finally {
      setTimeout(() => {
        setIsScanning(bluetoothService.getIsScanning());
      }, 30500);
    }
  };

  const connectToDevice = async (deviceId: string) => {
    try {
      const device = detectedDevices.find(d => d.id === deviceId);
      if (!device) return;

      if (device.connected) {
        await bluetoothService.disconnectFromDevice(deviceId);
        setDetectedDevices(prev =>
          prev.map(d => (d.id === deviceId ? { ...d, connected: false } : d)),
        );
      } else {
        try {
          await bluetoothService.connectToDevice(deviceId);
          setDetectedDevices(prev =>
            prev.map(d => (d.id === deviceId ? { ...d, connected: true } : d)),
          );
          Alert.alert('Success', 'Connected to Workshop app user!');
        } catch (connectErr) {
          const errorMessage =
            connectErr instanceof Error
              ? connectErr.message
              : 'Failed to connect';
          if (errorMessage.includes('Workshop app')) {
            Alert.alert(
              'Not a Workshop App',
              'This device does not appear to be running the Workshop app.',
            );
          } else {
            throw connectErr;
          }
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to connect to device';
      Alert.alert('Connection Error', errorMessage);
    }
  };

  const clearMessages = () => setMessages([]);

  return (
    <View className="bt__container" style={containerDynamicStyle}>
      <View className="bt__content">
        <View className="bt__header">
          <PaperText className="bt__title">Bluetooth Chat</PaperText>
          <Button
            mode="contained"
            onPress={startScan}
            disabled={isScanning || !isInitialized}
            className={
              isScanning || !isInitialized ? 'bt__scan--disabled' : 'bt__scan'
            }
            loading={isScanning}
            compact
          >
            {isScanning ? 'Scanning...' : 'Scan'}
          </Button>
        </View>

        {error && (
          <View>
            <PaperText className="bt__error">{error}</PaperText>
            <Button
              mode="outlined"
              onPress={() => {
                setError(null);
                setIsInitialized(false);
                bluetoothService
                  .initialize(username || 'Anonymous')
                  .then(() => setIsInitialized(true))
                  .catch(err => {
                    setError(
                      err instanceof Error
                        ? err.message
                        : 'Failed to initialize Bluetooth',
                    );
                  });
              }}
              className="bt__retry"
            >
              Retry
            </Button>
          </View>
        )}

        {!isInitialized && !error && (
          <PaperText className="bt__empty">Initializing Bluetooth...</PaperText>
        )}

        <View className="bt__header">
          <PaperText className="bt__section">
            Detected Devices ({detectedDevices.length})
          </PaperText>
          {detectedDevices.length > 0 && (
            <Button
              mode="outlined"
              onPress={() => setDetectedDevices([])}
              compact
            >
              Clear
            </Button>
          )}
        </View>

        <ScrollView>
          {detectedDevices.length === 0 ? (
            <PaperText className="bt__empty">
              {isScanning
                ? 'Scanning for nearby devices...'
                : 'No devices found. Tap "Scan" to search for nearby devices. Devices will be verified for Workshop app when you connect.'}
            </PaperText>
          ) : (
            detectedDevices.map(device => (
              <View key={device.id} className="bt__device">
                <View className="bt__device-info">
                  <PaperText className="bt__device-name">
                    {device.name}
                    {device.name?.startsWith('Workshop-') && ' ✓'}
                  </PaperText>
                  {device.username && device.username !== 'Unknown User' && (
                    <PaperText className="bt__username">
                      User: {device.username}
                    </PaperText>
                  )}
                  <PaperText className="bt__device-address">
                    {device.address}
                  </PaperText>
                  {device.rssi && (
                    <PaperText className="bt__device-address">
                      Signal: {device.rssi} dBm (
                      {device.rssi > -50
                        ? 'Strong'
                        : device.rssi > -70
                        ? 'Medium'
                        : 'Weak'}
                      )
                    </PaperText>
                  )}
                  <PaperText className="bt__hint">
                    {device.name?.startsWith('Workshop-')
                      ? 'Verified Workshop app device'
                      : 'Potential device - connect to verify Workshop app'}
                  </PaperText>
                </View>
                <View className="bt__device-status">
                  <IconButton
                    icon={
                      device.connected
                        ? 'bluetooth-connect'
                        : device.name?.startsWith('Workshop-')
                        ? 'shield-check'
                        : 'bluetooth'
                    }
                    size={20}
                    iconColor={
                      device.connected
                        ? theme.primary
                        : device.name?.startsWith('Workshop-')
                        ? '#4CAF50'
                        : theme.text
                    }
                    onPress={() => connectToDevice(device.id)}
                  />
                  <PaperText className="bt__status-text">
                    {device.connected ? 'Connected' : 'Tap to connect'}
                  </PaperText>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <View className="bt__header">
          <PaperText className="bt__section">Messages</PaperText>
          <Button
            mode="outlined"
            onPress={clearMessages}
            disabled={messages.length === 0}
            compact
          >
            Clear
          </Button>
        </View>

        <ScrollView className="bt__messages">
          {messages.length === 0 ? (
            <PaperText className="bt__empty">
              No messages yet. Connect to a device to start chatting.
            </PaperText>
          ) : (
            messages.map((msg, index) => (
              <View key={index} className="bt__device">
                <PaperText className="bt__device-name">
                  {msg.deviceName}: {msg.message}
                </PaperText>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
};

// Settings Modal Component
const SettingsModal: React.FC<{
  visible: boolean;
  username: string;
  onClose: () => void;
  onSave: (username: string) => void;
}> = ({ visible, username, onClose, onSave }) => {
  const [tempUsername, setTempUsername] = React.useState(username);
  const theme = useMaterialYouTheme();

  useEffect(() => {
    setTempUsername(username);
  }, [username, visible]);

  const handleSave = () => {
    onSave(tempUsername);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="modal__overlay">
        <View className="modal__content">
          <ScrollView >
            <PaperText className="modal__title">Settings</PaperText>

            <TextInput
              mode="outlined"
              label="Username"
              value={tempUsername}
              onChangeText={setTempUsername}
              className="modal__input"
              textColor={theme.text}
              outlineColor={theme.primary}
              activeOutlineColor={theme.primary}
              placeholder="Enter your username"
            />

            <View className="modal__actions">
              <Button
                mode="outlined"
                onPress={onClose}
                className="modal__button"
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                className="modal__button"
                buttonColor={theme.primary}
                textColor={theme.textColored}
              >
                Save
              </Button>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default App;

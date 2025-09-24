import React, {
  Component,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  StyleSheet,
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
  } catch {
  }

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

  stopBroadcastListener = () => {
    broadcastListener.stopListening();
    this.setState({ isListening: false });
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

  renderBluetoothTab = () => <BluetoothContent username={this.state.username} />;

  render() {
    const routes = [
      { key: 'broadcast', title: 'Broadcast', focusedIcon: 'wifi', unfocusedIcon: 'wifi-off' },
      { key: 'bluetooth', title: 'Bluetooth', focusedIcon: 'bluetooth', unfocusedIcon: 'bluetooth-off' },
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

  // ⚠️ Calcul des flags (re-mémorisé)
  const showFlags = useMemo(
    () => computeShowTimestampFlags(receivedMessages),
    [receivedMessages],
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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: insets.top,
      paddingBottom: keyboardVisible ? 0 : insets.bottom,
      backgroundColor: theme.background,
    },
    input: { flex: 1, backgroundColor: theme.card },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    messagesContainer: {
      flex: 1,
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: 0,
    },
    statusContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 10,
    },
    statusInfo: { flex: 1 },
    buttonContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusText: { color: theme.text, fontSize: 14 },
    clearButton: { marginTop: 10, backgroundColor: theme.card },
    clearButtonLabel: { color: theme.text },
    ipText: { color: theme.text, fontSize: 12, opacity: 0.7 },
  });

  // ------- Auto-scroll + suivi clavier -------
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
      setAutoScroll(isBottom);
    },
    [],
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        keyboardVisible
          ? Platform.OS === 'ios'
            ? 'padding'
            : 'height'
          : undefined
      }
      keyboardVerticalOffset={0}
    >
      <View style={styles.messagesContainer}>
        <View style={styles.statusContainer}>
          <View style={styles.statusInfo}>
            <PaperText style={styles.statusText}>
              Status:{' '}
              {isListening ? 'Listening for broadcasts' : 'Not listening'}
            </PaperText>
            {ownIpAddress && (
              <PaperText style={styles.ipText}>
                Device IP: {ownIpAddress} (messages from this IP are filtered)
              </PaperText>
            )}
            {username ? (
              <PaperText style={styles.ipText}>Username: {username}</PaperText>
            ) : null}
          </View>

          <View style={styles.buttonContainer}>
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
              style={styles.clearButton}
              labelStyle={styles.clearButtonLabel}
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
            <PaperText style={styles.statusText}>
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

      <View style={styles.inputContainer}>
        <TextInput
          mode="outlined"
          label="Message"
          value={inputText}
          onChangeText={onTextChange}
          style={styles.input}
          textColor={theme.text}
          outlineColor={theme.primary}
          activeOutlineColor={theme.primary}
          placeholder={
            username
              ? `${username}: Enter your message...`
              : 'Enter your message...'
          }
          onFocus={() => {
            if (autoScroll) {
              requestAnimationFrame(() =>
                scrollViewRef.current?.scrollToEnd({ animated: true }),
              );
            }
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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
      backgroundColor: theme.background,
    },
    content: {
      flex: 1,
      padding: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 20,
    },
    placeholderText: {
      textAlign: 'center',
      color: theme.text,
      opacity: 0.7,
      marginBottom: 10,
      lineHeight: 20,
    },
    usernameText: {
      fontSize: 16,
      color: theme.primary,
      fontWeight: 'bold',
      marginTop: 20,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <PaperText style={styles.title}>Bluetooth Chat</PaperText>
        <PaperText style={styles.placeholderText}>
          Bluetooth functionality is currently under development.
        </PaperText>
        <PaperText style={styles.placeholderText}>
          This feature will allow you to discover and connect to nearby devices
          running the Workshop app and exchange messages over Bluetooth.
        </PaperText>
        {username && (
          <PaperText style={styles.usernameText}>
            Signed in as: {username}
          </PaperText>
        )}
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

  const modalStyles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.background,
      padding: 20,
      margin: 0,
      borderRadius: 10,
      width: '90%',
      maxWidth: 420,
      maxHeight: '80%',
      overflow: 'hidden',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    input: { marginBottom: 20, backgroundColor: theme.card },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
    },
    button: { flex: 1 },
    modalScrollContent: { paddingBottom: 8 },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={modalStyles.modalOverlay}>
        <View style={modalStyles.modalContent}>
          <ScrollView contentContainerStyle={modalStyles.modalScrollContent}>
            <PaperText style={modalStyles.modalTitle}>Settings</PaperText>

            <TextInput
              mode="outlined"
              label="Username"
              value={tempUsername}
              onChangeText={setTempUsername}
              style={modalStyles.input}
              textColor={theme.text}
              outlineColor={theme.primary}
              activeOutlineColor={theme.primary}
              placeholder="Enter your username"
            />

            <View style={modalStyles.buttonContainer}>
              <Button
                mode="outlined"
                onPress={onClose}
                style={modalStyles.button}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                style={modalStyles.button}
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

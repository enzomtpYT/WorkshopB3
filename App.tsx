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

import { 
  createAppContentStyles, 
  createBluetoothContentStyles, 
  createSettingsModalStyles 
} from './style';

import MaterialYou from 'react-native-material-you-colors';
import type { MaterialYouPalette } from 'react-native-material-you-colors';
import { broadcastListener } from './BroadcastListener';
import MessageBubble from './MessageBubble';
import { computeShowTimestampFlags } from './ShowTimestamp';
import {
  bluetoothMessaging,
  BluetoothMessage,
  DiscoveredDevice
} from './BluetoothMessaging';
import { sqliteService, Message } from './src/database/SQLiteService';
import { cryptoService } from './src/crypto/CryptoService';
import { AuthenticationScreen } from './src/screens/AuthenticationScreen';

// Helper : extrait {sender, body} à partir du message brut
function extractSenderAndBody(raw: string): { sender?: string; body: string } {
  // 1) Essaye JSON d'abord
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
    // pas du JSON → on continue
  }

  // 2) Pattern "Username: message" (une seule fois, en début de chaîne)
  const m = raw.match(/^\s*([^:\n]{1,64})\s*:\s*(.+)$/s);
  if (m) {
    return { sender: m[1].trim(), body: m[2] };
  }

  // 3) Pas de username détecté → on garde tel quel
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

// function formatHHMM(date: Date = new Date()): string {
//   const h = date.getHours().toString().padStart(2, '0');
//   const m = date.getMinutes().toString().padStart(2, '0');
//   return `${h}:${m}`;
// }

const USERNAME_STORAGE_KEY = 'broadcast_username';

interface AppState {
  inputText: string;
  receivedMessages: Message[];
  isListening: boolean;
  ownIpAddress: string | null;
  showSettings: boolean;
  username: string;
  isDatabaseInitialized: boolean;
  activeTab: number;
  userPassword: string; // NOUVEAU: Mot de passe de l'utilisateur
  encryptionMode: boolean; // NOUVEAU: Mode chiffrement activé
  recipientPassword: string; // NOUVEAU: Mot de passe du destinataire
  showEncryptionSettings: boolean; // NOUVEAU: Modal paramètres crypto
  isAuthenticated: boolean; // État d'authentification de l'utilisateur
}

class App extends Component<{}, AppState> {
  state: AppState = {
    inputText: '',
    receivedMessages: [],
    isListening: false,
    ownIpAddress: null,
    username: '',
    showSettings: false,
    isDatabaseInitialized: false,
    activeTab: 0,
    userPassword: '',
    encryptionMode: false,
    recipientPassword: '',
    showEncryptionSettings: false,
    isAuthenticated: false, // Ajouter l'état d'authentification
  };

  async componentDidMount() {
    await this.initializeDatabase();
    this.startBroadcastListener();
    this.loadUsername();
    this.loadUserPassword(); // NOUVEAU
    this.loadMessages();
  }

  async componentWillUnmount() {
    broadcastListener.cleanup();
    await sqliteService.close();
  }

  formatHHMM = (date: Date = new Date()): string => {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  initializeDatabase = async () => {
    try {
      await sqliteService.init();
      this.setState({ isDatabaseInitialized: true });
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      Alert.alert('Error', 'Failed to initialize database');
    }
    try {
      await sqliteService.init();
      this.setState({ isDatabaseInitialized: true });
      console.log('SQLite database initialized');
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  };

  loadMessages = async () => {
    try {
      if (!this.state.isDatabaseInitialized) return;
      const messages = await sqliteService.getAllMessages();
      this.setState({ receivedMessages: messages });
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

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

  // NOUVEAU: Charger le mot de passe utilisateur
  loadUserPassword = async () => {
    try {
      const savedPassword = await AsyncStorage.getItem(
        'user_encryption_password',
      );
      if (savedPassword) {
        this.setState({ userPassword: savedPassword });
      }
    } catch (error) {
      console.error('Failed to load user password:', error);
    }
  };

  // NOUVEAU: Sauvegarder le mot de passe utilisateur
  saveUserPassword = async (password: string) => {
    try {
      await AsyncStorage.setItem('user_encryption_password', password);
      this.setState({ userPassword: password });
    } catch (error) {
      console.error('Failed to save user password:', error);
    }
  };

  // NOUVEAU: Toggle mode chiffrement
  toggleEncryptionMode = () => {
    this.setState(prev => ({ encryptionMode: !prev.encryptionMode }));
  };

  // NOUVEAU: Ouvrir settings crypto
  openEncryptionSettings = () => {
    this.setState({ showEncryptionSettings: true });
  };

  // NOUVEAU: Fermer settings crypto
  closeEncryptionSettings = () => {
    this.setState({ showEncryptionSettings: false });
  };

  // MODIFIER: sendMsg avec support du chiffrement
  sendMsg = async () => {
    if (!this.state.isDatabaseInitialized) {
      console.error('Failed to broadcast message: Database not initialized');
      Alert.alert(
        'Error',
        'Database not initialized yet. Please try again in a moment.',
      );
      return;
    }

    if (this.state.inputText.trim()) {
      try {
        let messageToSend = this.state.inputText.trim();
        let messageToStore = messageToSend;
        let isEncrypted = false;
        let encryptionTarget: string | undefined;

        // Si le mode chiffrement est activé
        if (this.state.encryptionMode && this.state.recipientPassword) {
          try {
            const encryptedData = cryptoService.encryptMessage(
              messageToSend,
              this.state.recipientPassword,
              'recipient', // Ou le username du destinataire si vous l'avez
            );

            // Message à envoyer (JSON chiffré)
            messageToSend = JSON.stringify(encryptedData);
            // Message à stocker (texte original + indicateur)
            messageToStore = `🔒 [Encrypted] ${this.state.inputText.trim()}`;
            isEncrypted = true;
            encryptionTarget = 'recipient';
          } catch (error) {
            Alert.alert('Encryption Error', 'Failed to encrypt message');
            return;
          }
        }

        // Sauvegarder en base de données
        const messageId = await sqliteService.saveMessage({
          message: messageToStore,
          timestamp: Date.now(),
          sender: 'You',
          isSent: true,
          isEncrypted,
          encryptionTarget,
        });

        // Créer le message pour l'état
        const sentMessage: Message = {
          _id: messageId,
          message: messageToStore,
          timestamp: Date.now(),
          sender: 'You',
          isSent: true,
          isEncrypted,
          encryptionTarget,
        };

        this.setState(prev => ({
          receivedMessages: [...prev.receivedMessages, sentMessage],
        }));

        // Envoyer le message (chiffré ou non)
        await broadcastListener.sendBroadcast(
          messageToSend,
          this.state.username.trim(),
        );
      } catch (error) {
        console.error('Failed to broadcast message:', error);
        Alert.alert('Error', 'Failed to send broadcast message');
      }
    }
    this.setState({ inputText: '' });
  };

  // MODIFIER: startBroadcastListener avec support du déchiffrement
  startBroadcastListener = async () => {
    try {
      await broadcastListener.startListening(
        async (message: string, senderInfo: any) => {
          try {
            // 1) Première extraction côté "clair" (avant déchiffrement)
            const firstParse = extractSenderAndBody(message);
            let parsedSender = firstParse.sender; // username s’il est déjà dans l’enveloppe
            let finalMessage = firstParse.body;

            let isEncrypted = false;
            let decryptionFailed = false;

            // 2) Gestion chiffrage
            if (
              cryptoService.isEncryptedMessage(finalMessage) &&
              this.state.userPassword
            ) {
              const encryptedData =
                cryptoService.parseEncryptedMessage(finalMessage);
              if (encryptedData) {
                isEncrypted = true;
                const decryptionResult = cryptoService.decryptMessage(
                  encryptedData,
                  this.state.userPassword,
                );

                if (decryptionResult.success) {
                  finalMessage = decryptionResult.message!;

                  // 2.bis) Si on n’avait pas de username AVANT, on re-tente l’extraction APRÈS déchiffrement
                  if (!parsedSender) {
                    const afterDecrypt = extractSenderAndBody(finalMessage);
                    parsedSender = afterDecrypt.sender || parsedSender;
                    finalMessage = afterDecrypt.body; // on nettoie le corps si format "Alice: ..."/JSON
                  }
                } else {
                  finalMessage = '🔒 [Encrypted message - wrong password]';
                  decryptionFailed = true;
                }
              }
            } else if (cryptoService.isEncryptedMessage(finalMessage)) {
              // Message chiffré mais pas de mot de passe défini
              finalMessage = '🔒 [Encrypted message - no password set]';
              isEncrypted = true;
              decryptionFailed = true;
            }

            // 3) Détermination du "sender" à afficher (username prioritaire)
            const displaySender =
              (parsedSender && String(parsedSender).trim()) ||
              (senderInfo?.username && String(senderInfo.username).trim()) ||
              (senderInfo?.name && String(senderInfo.name).trim()) ||
              (senderInfo?.address && String(senderInfo.address).trim()) ||
              'Unknown';

            // 4) Sauvegarde SQLite
            const messageId = await sqliteService.saveMessage({
              message: finalMessage,
              timestamp: Date.now(),
              sender: displaySender,
              isSent: false,
              senderIp: senderInfo?.address,
              isEncrypted,
              decryptionFailed,
            });

            // 5) Push dans le state pour affichage
            const newMessage: Message = {
              _id: messageId,
              message: finalMessage,
              timestamp: Date.now(),
              sender: displaySender,
              isSent: false,
              senderIp: senderInfo?.address,
              isEncrypted,
              decryptionFailed,
            };

            this.setState(prev => ({
              receivedMessages: [...prev.receivedMessages, newMessage],
            }));
          } catch (error) {
            console.error('Failed to save received message:', error);
          }
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

  clearMessages = async () => {
    try {
      await sqliteService.clearAllMessages();
      this.setState({ receivedMessages: [] });
    } catch (error) {
      console.error('Failed to clear messages:', error);
    }
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

  onTextChange = (text: string) => {
    this.setState({ inputText: text });
  };

  onRecipientPasswordChange = (password: string) => {
    this.setState({ recipientPassword: password });
  };

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
      // AJOUTER: Props crypto manquantes
      encryptionMode={this.state.encryptionMode}
      recipientPassword={this.state.recipientPassword}
      onToggleEncryption={this.toggleEncryptionMode}
      onOpenEncryptionSettings={this.openEncryptionSettings}
      onRecipientPasswordChange={this.onRecipientPasswordChange}
      userPassword={this.state.userPassword}
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
            {!this.state.isAuthenticated ? (
              <AuthenticationScreen
                onAuthenticationSuccess={() => {
                  this.setState({ isAuthenticated: true });
                  console.log('Authentification réussie');
                }}
              />
            ) : (
              <>
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
                <EncryptionSettingsModal
                  visible={this.state.showEncryptionSettings}
                  userPassword={this.state.userPassword}
                  onClose={this.closeEncryptionSettings}
                  onSave={this.saveUserPassword}
                />
              </>
            )}
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
  receivedMessages: Message[];
  isListening: boolean;
  onClearMessages: () => void;
  ownIpAddress: string | null;
  onOpenSettings: () => void;
  username: string;
  // AJOUTER: Props crypto
  encryptionMode: boolean;
  recipientPassword: string;
  onToggleEncryption: () => void;
  onOpenEncryptionSettings: () => void;
  onRecipientPasswordChange: (password: string) => void;
  userPassword: string;
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
  // AJOUTER: Destructuring crypto
  encryptionMode,
  recipientPassword,
  onToggleEncryption,
  onOpenEncryptionSettings,
  onRecipientPasswordChange,
  userPassword,
}) => {
  const theme = useMaterialYouTheme();
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const insets = useSafeAreaInsets();

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

  const styles = createAppContentStyles(theme, insets, keyboardVisible);

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

      {/* AJOUTER: Interface de chiffrement */}
      {encryptionMode && (
        <View style={styles.encryptionContainer}>
          <PaperText style={styles.encryptionLabel}>
            🔒 ENCRYPTION MODE ACTIVE
          </PaperText>
          <TextInput
            mode="outlined"
            label="Recipient's password"
            value={recipientPassword}
            onChangeText={onRecipientPasswordChange}
            style={styles.encryptionInput}
            secureTextEntry
            placeholder="Enter recipient's password to encrypt"
            textColor={theme.text}
            outlineColor={theme.primary}
            activeOutlineColor={theme.primary}
            dense
          />
          <PaperText style={styles.encryptionStatus}>
            {userPassword
              ? `✅ Your password set | ${
                  recipientPassword
                    ? '🔒 Ready to encrypt'
                    : '⚠️ Enter recipient password'
                }`
              : '⚠️ Set your password in settings to decrypt messages'}
          </PaperText>
        </View>
      )}

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
            encryptionMode
              ? `🔒 ${username}: Encrypted message...`
              : username
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

        {/* AJOUTER: Boutons crypto */}
        <IconButton
          icon={encryptionMode ? 'lock' : 'lock-open'}
          onPress={onToggleEncryption}
          iconColor={encryptionMode ? theme.primary : theme.text}
          size={20}
          style={encryptionMode ? styles.activeIcon : styles.inactiveIcon}
        />

        <IconButton
          icon="key"
          onPress={onOpenEncryptionSettings}
          iconColor={theme.primary}
          size={20}
        />

        <IconButton
          icon="send"
          onPress={sendMsg}
          iconColor={theme.textColored}
          containerColor={theme.primary}
          disabled={
            !inputText.trim() || (encryptionMode && !recipientPassword.trim())
          }
          size={24}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const BluetoothContent: React.FC<{ username: string }> = ({ username }) => {
  const theme = useMaterialYouTheme();
  const insets = useSafeAreaInsets();
  const [bluetoothMessages, setBluetoothMessages] = useState<BluetoothMessage[]>([]);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [isBluetoothActive, setIsBluetoothActive] = useState(false);
  const [bluetoothInputText, setBluetoothInputText] = useState('');
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const bluetoothScrollViewRef = useRef<ScrollView | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const styles = createBluetoothContentStyles(theme, insets);

  // Bluetooth message flags for timestamps
  const bluetoothShowFlags = useMemo(
    () => computeShowTimestampFlags(bluetoothMessages.map(msg => ({
      message: msg.message,
      timestamp: msg.timestamp,
      sender: msg.sender,
      isSent: msg.sender === 'You'
    }))),
    [bluetoothMessages],
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

  useEffect(() => {
    // Set up Bluetooth message handler
    bluetoothMessaging.setMessageHandler((message: BluetoothMessage) => {
      setBluetoothMessages(prev => [...prev, message]);
    });

    // Set up device discovery handler
    bluetoothMessaging.setDeviceDiscoveryHandler((device: DiscoveredDevice) => {
      setDiscoveredDevices(prev => {
        const existing = prev.find(d => d.deviceId === device.deviceId);
        if (existing) {
          return prev.map(d => d.deviceId === device.deviceId ? device : d);
        }
        return [...prev, device];
      });
    });

    return () => {
      bluetoothMessaging.cleanup();
    };
  }, []);

  useEffect(() => {
    if (autoScroll) {
      requestAnimationFrame(() => {
        bluetoothScrollViewRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [bluetoothMessages, autoScroll]);

  const handleBluetoothContentSizeChange = useCallback(() => {
    if (autoScroll) {
      bluetoothScrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [autoScroll]);

  const handleBluetoothScroll = useCallback(
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

  const toggleBluetoothService = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Please set a username first in settings');
      return;
    }

    try {
      if (isBluetoothActive) {
        await bluetoothMessaging.stopService();
        setIsBluetoothActive(false);
        setDiscoveredDevices([]);
      } else {
        await bluetoothMessaging.startService(username.trim());
        setIsBluetoothActive(true);
      }
    } catch (error) {
      console.error('Failed to toggle Bluetooth service:', error);
      Alert.alert('Error', 'Failed to start/stop Bluetooth service');
    }
  };

  const sendBluetoothMessage = async () => {
    if (!bluetoothInputText.trim()) return;
    if (!isBluetoothActive) {
      Alert.alert('Error', 'Please start Bluetooth service first');
      return;
    }

    try {
      // Add message to local list immediately
      const sentMessage: BluetoothMessage = {
        id: `sent_${Date.now()}`,
        message: bluetoothInputText.trim(),
        sender: 'You',
        timestamp: Date.now()
      };

      setBluetoothMessages(prev => [...prev, sentMessage]);

      // Send via Bluetooth
      await bluetoothMessaging.sendMessage(bluetoothInputText.trim());
      setBluetoothInputText('');
    } catch (error) {
      console.error('Failed to send Bluetooth message:', error);
      Alert.alert('Error', 'Failed to send Bluetooth message');
    }
  };

  const clearBluetoothMessages = () => {
    setBluetoothMessages([]);
  };

  const onlineDevicesCount = discoveredDevices.filter(device => device.isOnline).length;

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
              Bluetooth Status: {isBluetoothActive ? 'Active' : 'Inactive'}
            </PaperText>
            <PaperText style={styles.ipText}>
              Devices nearby: {onlineDevicesCount}
            </PaperText>
            {username && (
              <PaperText style={styles.ipText}>
                Broadcasting as: {username}
              </PaperText>
            )}
          </View>

          <View style={styles.buttonContainer}>
            <Button
              mode={isBluetoothActive ? 'contained' : 'outlined'}
              onPress={toggleBluetoothService}
              style={styles.clearButton}
              labelStyle={styles.clearButtonLabel}
              buttonColor={isBluetoothActive ? theme.primary : undefined}
            >
              {isBluetoothActive ? 'Stop' : 'Start'}
            </Button>
            <Button
              mode="outlined"
              onPress={clearBluetoothMessages}
              disabled={bluetoothMessages.length === 0}
              style={styles.clearButton}
              labelStyle={styles.clearButtonLabel}
            >
              Clear
            </Button>
          </View>
        </View>

        <ScrollView
          ref={bluetoothScrollViewRef}
          onContentSizeChange={handleBluetoothContentSizeChange}
          onScroll={handleBluetoothScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >
          {bluetoothMessages.length === 0 ? (
            <View style={styles.content}>
              <PaperText style={styles.title}>Bluetooth Chat</PaperText>
              <PaperText style={styles.placeholderText}>
                Start the Bluetooth service to begin discovering nearby Workshop app users and exchange messages.
              </PaperText>
              <PaperText style={styles.placeholderText}>
                Messages are sent using BLE advertising without requiring device pairing.
              </PaperText>
            </View>
          ) : (
            bluetoothMessages.map((msg, index) => (
              <MessageBubble
                key={msg.id || index}
                msg={{
                  _id: msg.id || index.toString(),
                  message: msg.message,
                  timestamp: msg.timestamp,
                  sender: msg.sender,
                  isSent: msg.sender === 'You'
                }}
                showTime={bluetoothShowFlags[index]}
                theme={theme}
              />
            ))
          )}
        </ScrollView>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          mode="outlined"
          label="Bluetooth Message"
          value={bluetoothInputText}
          onChangeText={setBluetoothInputText}
          style={styles.input}
          textColor={theme.text}
          outlineColor={theme.primary}
          activeOutlineColor={theme.primary}
          placeholder="Enter message to broadcast..."
          disabled={!isBluetoothActive}
          onFocus={() => {
            if (autoScroll) {
              requestAnimationFrame(() =>
                bluetoothScrollViewRef.current?.scrollToEnd({ animated: true }),
              );
            }
          }}
        />
        <IconButton
          icon="bluetooth"
          onPress={sendBluetoothMessage}
          iconColor={theme.textColored}
          containerColor={theme.primary}
          disabled={!bluetoothInputText.trim() || !isBluetoothActive}
          size={24}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const SettingsModal: React.FC<{
  visible: boolean;
  username: string;
  onClose: () => void;
  onSave: (username: string) => void;
}> = ({ visible, username, onClose, onSave }) => {
  const [tempUsername, setTempUsername] = React.useState(username);
  const theme = useMaterialYouTheme();
  const styles = React.useMemo(() => createSettingsModalStyles(theme), [theme]);

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
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <PaperText style={styles.modalTitle}>Settings</PaperText>

            <TextInput
              mode="outlined"
              label="Username"
              value={tempUsername}
              onChangeText={setTempUsername}
              style={styles.input}
              textColor={theme.text}
              outlineColor={theme.primary}
              activeOutlineColor={theme.primary}
              placeholder="Enter your username"
            />

            <View style={styles.buttonContainer}>
              <Button
                mode="outlined"
                onPress={onClose}
                style={styles.button}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                style={styles.button}
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

const EncryptionSettingsModal: React.FC<{
  visible: boolean;
  userPassword: string;
  onClose: () => void;
  onSave: (password: string) => void;
}> = ({ visible, userPassword, onClose, onSave }) => {
  const [tempPassword, setTempPassword] = React.useState(userPassword);
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const theme = useMaterialYouTheme();
  const styles = React.useMemo(() => createSettingsModalStyles(theme), [theme]);

  useEffect(() => {
    setTempPassword(userPassword);
    setConfirmPassword('');
  }, [userPassword, visible]);

  const handleSave = () => {
    if (tempPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (tempPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    onSave(tempPassword);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <PaperText style={styles.modalTitle}>
            🔐 Encryption Settings
          </PaperText>

          <PaperText style={styles.infoText}>
            Set your encryption password. Others need this password to send you
            encrypted messages.
          </PaperText>

          <TextInput
            mode="outlined"
            label="Your encryption password"
            value={tempPassword}
            onChangeText={setTempPassword}
            style={styles.input}
            secureTextEntry
            textColor={theme.text}
            outlineColor={theme.primary}
            activeOutlineColor={theme.primary}
            placeholder="Enter a strong password"
          />

          <TextInput
            mode="outlined"
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            style={styles.input}
            secureTextEntry
            textColor={theme.text}
            outlineColor={theme.primary}
            activeOutlineColor={theme.primary}
            placeholder="Confirm your password"
          />

          <View style={styles.buttonContainer}>
            <Button
              mode="outlined"
              onPress={onClose}
              style={styles.button}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSave}
              style={styles.button}
              buttonColor={theme.primary}
              textColor={theme.textColored}
              disabled={
                !tempPassword.trim() || tempPassword !== confirmPassword
              }
            >
              Save
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default App;
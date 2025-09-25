import React, { Component } from 'react';
import {
  View,
  ScrollView,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  TextInput,
  Button,
  Text as PaperText,
  IconButton,
  Provider as PaperProvider,
} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialYou from 'react-native-material-you-colors';
import type { MaterialYouPalette } from 'react-native-material-you-colors';

// Importations locales
import { AuthenticationScreen } from './src/screens/AuthenticationScreen';
import { broadcastListener } from './BroadcastListener';
import MessageBubble from './MessageBubble';
import SQLiteService, { Message } from './src/database/SQLiteService';
import { CryptoService } from './src/crypto/CryptoService';

// Types
interface AppState {
  inputText: string;
  receivedMessages: Message[];
  isListening: boolean;
  ownIpAddress: string | null;
  showSettings: boolean;
  username: string;
  isDatabaseInitialized: boolean;
  activeTab: number;
  userPassword: string;
  encryptionMode: boolean;
  recipientPassword: string;
  showEncryptionSettings: boolean;
  isAuthenticated: boolean;
}

// Configuration du thème
const styles = {
  container: {
    flex: 1,
  } as const,
  messageList: {
    flex: 1,
    padding: 10,
  } as const,
  inputContainer: {
    flexDirection: 'row' as const,
    padding: 10,
    alignItems: 'center' as const,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  } as const,
  input: {
    flex: 1,
    marginRight: 10,
    paddingVertical: 8,
  } as const,
  settingsButton: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    zIndex: 1,
  } as const,
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 10,
  } as const,
  settingsTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    marginBottom: 20,
  } as const,
  settingsField: {
    marginBottom: 15,
  } as const,
  header: {
    padding: 15,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  } as const,
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  } as const,
};

const generateTheme = (palette: MaterialYouPalette) => ({
  light: {
    isDark: false,
    primary: palette.system_accent1[7],
    text: palette.system_accent1[9],
    textColored: palette.system_accent1[2],
    background: palette.system_neutral1[1],
    card: palette.system_accent2[2],
    icon: palette.system_accent1[10],
  },
  dark: {
    isDark: true,
    primary: palette.system_accent1[4],
    text: palette.system_accent1[3],
    textColored: palette.system_accent1[9],
    background: palette.system_neutral1[11],
    card: palette.system_accent2[10],
    icon: palette.system_accent1[3],
  }
});

export const { ThemeProvider, useMaterialYouTheme } = MaterialYou.createThemeContext(generateTheme);

class App extends Component<{}, AppState> {
  private cryptoService: CryptoService;
  private sqliteService: SQLiteService;
  private scrollView: ScrollView | null = null;

  constructor(props: {}) {
    super(props);
    this.cryptoService = new CryptoService();
    this.sqliteService = new SQLiteService();
    this.state = {
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
      isAuthenticated: false,
    };
  }

  handleAuthenticationSuccess = () => {
    this.setState({ isAuthenticated: true }, async () => {
      await this.initializeDatabase();
      await this.startBroadcastListener();
      await this.loadUsername();
      await this.loadUserPassword();
      await this.loadMessages();
    });
  };

  async componentDidMount() {
    // L'initialisation se fera après l'authentification réussie
  }

  async componentWillUnmount() {
    if (broadcastListener) {
      broadcastListener.cleanup();
    }
    await this.sqliteService.close();
  }

  private initializeDatabase = async (): Promise<void> => {
    try {
      await this.sqliteService.init();
      this.setState({ isDatabaseInitialized: true });
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      Alert.alert('Error', 'Failed to initialize database');
    }
  };

  private loadMessages = async (): Promise<void> => {
    try {
      if (!this.state.isDatabaseInitialized) return;
      const messages = await this.sqliteService.getAllMessages();
      this.setState({ receivedMessages: messages });
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  private loadUsername = async (): Promise<void> => {
    try {
      const savedUsername = await AsyncStorage.getItem('broadcast_username');
      if (savedUsername) {
        this.setState({ username: savedUsername });
      }
    } catch (error) {
      console.error('Failed to load username:', error);
    }
  };

  private loadUserPassword = async (): Promise<void> => {
    try {
      const savedPassword = await AsyncStorage.getItem('user_password');
      if (savedPassword) {
        this.setState({ userPassword: savedPassword });
      }
    } catch (error) {
      console.error('Failed to load user password:', error);
    }
  };

  private startBroadcastListener = async (): Promise<void> => {
    await broadcastListener.startListening((message) => {
      this.handleReceivedMessage(message);
    });
  };

  private handleReceivedMessage = async (message: any): Promise<void> => {
    try {
      if (!this.state.isDatabaseInitialized) return;

      // Vérifier si le message est chiffré et le déchiffrer si nécessaire
      let finalMessage = message;
      if (this.state.encryptionMode && this.state.recipientPassword) {
        try {
          const decryptResult = this.cryptoService.decryptMessage({
            encrypted: typeof message === 'string' ? message : JSON.stringify(message),
            iv: '',  // À extraire du message
            authTag: '', // À extraire du message
          }, this.state.recipientPassword);

          if (decryptResult.success && decryptResult.message) {
            finalMessage = decryptResult.message;
          } else {
            console.error('Failed to decrypt message:', decryptResult.error);
            return;
          }
        } catch (error) {
          console.error('Failed to decrypt message:', error);
          return;
        }
      }

      const newMessage: Message = {
        _id: Date.now().toString(),
        message: typeof finalMessage === 'string' ? finalMessage : JSON.stringify(finalMessage),
        timestamp: Date.now(),
        sender: 'unknown',
        isSent: false
      };

      await this.sqliteService.saveMessage(newMessage);
      await this.loadMessages();
    } catch (error) {
      console.error('Error handling received message:', error);
    }
  };

  private handleSendMessage = async (): Promise<void> => {
    if (!this.state.inputText.trim() || !this.state.username) return;

    try {
      let messageToSend = this.state.inputText;
      
      // Chiffrer le message si le mode chiffrement est activé
      if (this.state.encryptionMode && this.state.userPassword) {
        const encryptedData = this.cryptoService.encryptMessage(
          messageToSend,
          this.state.userPassword
        );
        messageToSend = JSON.stringify(encryptedData);
      }

      // Enregistrer le message dans la base de données
      const newMessage: Message = {
        _id: Date.now().toString(),
        message: messageToSend,
        timestamp: Date.now(),
        sender: this.state.username,
        isSent: true
      };

      await this.sqliteService.saveMessage(newMessage);
      
      // Envoyer le message via le broadcastListener
      await broadcastListener.sendBroadcast(messageToSend, this.state.username);
      
      // Réinitialiser le champ de texte et recharger les messages
      this.setState({ inputText: '' });
      await this.loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  render(): React.ReactNode {
    const { isAuthenticated } = this.state;

    if (!isAuthenticated) {
      return (
        <SafeAreaProvider>
          <PaperProvider>
            <View style={styles.container}>
              <AuthenticationScreen onAuthenticationSuccess={this.handleAuthenticationSuccess} />
            </View>
          </PaperProvider>
        </SafeAreaProvider>
      );
    }

    return (
      <ThemeProvider>
        <SafeAreaProvider>
          <PaperProvider>
            <View style={styles.container}>
              <View style={styles.header}>
                <PaperText style={styles.headerTitle}>
                  {this.state.username || 'Chat'}
                </PaperText>
                <IconButton
                  icon="cog"
                  size={24}
                  onPress={() => this.setState({ showSettings: true })}
                />
              </View>
              
              <ScrollView
                style={styles.messageList}
                ref={(ref) => { this.scrollView = ref; }}
                onContentSizeChange={() => {
                  this.scrollView?.scrollToEnd({ animated: true });
                }}
              >
                {this.state.receivedMessages.map((msg) => (
                  <MessageBubble
                    key={msg._id}
                    msg={msg}
                    showTime={true}
                    theme={{
                      isDark: false,
                      primary: '#1976d2',
                      background: '#ffffff'
                    }}
                  />
                ))}
              </ScrollView>

              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              >
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={this.state.inputText}
                    onChangeText={(text) => this.setState({ inputText: text })}
                    placeholder="Tapez votre message..."
                    multiline
                  />
                  <IconButton
                    icon="send"
                    size={24}
                    onPress={this.handleSendMessage}
                    disabled={!this.state.inputText.trim()}
                  />
                </View>
              </KeyboardAvoidingView>

              <Modal
                visible={this.state.showSettings}
                onDismiss={() => this.setState({ showSettings: false })}
                transparent
              >
                <View style={styles.modalContent}>
                  <ScrollView>
                    <PaperText style={styles.settingsTitle}>Paramètres</PaperText>
                    
                    <View style={styles.settingsField}>
                      <TextInput
                        label="Nom d'utilisateur"
                        value={this.state.username}
                        onChangeText={async (text) => {
                          this.setState({ username: text });
                          await AsyncStorage.setItem('broadcast_username', text);
                        }}
                      />
                    </View>

                    <View style={styles.settingsField}>
                      <TextInput
                        label="Mot de passe de chiffrement"
                        value={this.state.userPassword}
                        onChangeText={async (text) => {
                          this.setState({ userPassword: text });
                          await AsyncStorage.setItem('user_password', text);
                        }}
                        secureTextEntry
                      />
                    </View>

                    <View style={styles.settingsField}>
                      <TextInput
                        label="Mot de passe du destinataire"
                        value={this.state.recipientPassword}
                        onChangeText={(text) => this.setState({ recipientPassword: text })}
                        secureTextEntry
                      />
                    </View>

                    <Button
                      mode="outlined"
                      onPress={() => this.setState({ showSettings: false })}
                    >
                      Fermer
                    </Button>
                  </ScrollView>
                </View>
              </Modal>
            </View>
          </PaperProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }
}

export default App;
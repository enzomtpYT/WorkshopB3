import React, {Component} from 'react';
import {View, StyleSheet, ScrollView, Alert, Modal, KeyboardAvoidingView, Platform, Keyboard, StatusBar} from 'react-native';
import {TextInput, Button, Card, Text as PaperText, IconButton, Provider as PaperProvider} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';

import MaterialYou from 'react-native-material-you-colors';
import type { MaterialYouPalette } from 'react-native-material-you-colors';
import { broadcastListener } from './BroadcastListener';

function generateTheme(palette: MaterialYouPalette) {
  const light = {
    isDark: false,
    primary: palette.system_accent1[7], // shade 500
    text: palette.system_accent1[9], // shade 700
    textColored: palette.system_accent1[2], // shade 50
    background: palette.system_neutral1[1], // shade 10
    card: palette.system_accent2[2], // shade 50
    icon: palette.system_accent1[10], // shade 800
  };
  const dark: typeof light = {
    isDark: true,
    primary: palette.system_accent1[4], // shade 200
    text: palette.system_accent1[3], // shade 100
    textColored: palette.system_accent1[9], // shade 700
    background: palette.system_neutral1[11], // shade 900
    card: palette.system_accent2[10], // shade 800
    icon: palette.system_accent1[3], // shade 100
  };
  return { light, dark };
}

export const { ThemeProvider, useMaterialYouTheme } = MaterialYou.createThemeContext(generateTheme);

const USERNAME_STORAGE_KEY = 'broadcast_username';

interface AppState {
  inputText: string;
  receivedMessages: Array<{message: string, timestamp: string, sender: string}>;
  isListening: boolean;
  ownIpAddress: string | null;
  username: string;
  showSettings: boolean;
}

class App extends Component<{}, AppState> {
  state = {
    inputText: '',
    receivedMessages: [] as Array<{message: string, timestamp: string, sender: string}>,
    isListening: false,
    ownIpAddress: null as string | null,
    username: '' as string,
    showSettings: false,
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
      await broadcastListener.startListening((message: string, senderInfo: any) => {
        const newMessage = {
          message: message,
          timestamp: new Date().toLocaleTimeString(),
          sender: senderInfo.address || 'Unknown',
        };
        
        this.setState((prevState: any) => ({
          receivedMessages: [...prevState.receivedMessages, newMessage],
        }));
      });
      
      // Get the detected IP address
      const ownIp = broadcastListener.getDetectedIpAddress();
      
      this.setState({ 
        isListening: true,
        ownIpAddress: ownIp,
      });
      console.log('Broadcast listener started successfully');
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
    this.setState(prevState => ({ showSettings: !prevState.showSettings }));
  };

  saveUsername = (newUsername: string) => {
    this.setState({ username: newUsername });
    this.saveUsernameToStorage(newUsername);
  };

  onPress = async () => {
    if (this.state.inputText.trim()) {
      try {
        // Prepend username to message if username is set
        const messageToSend = this.state.username.trim() 
          ? `${this.state.username}: ${this.state.inputText}`
          : this.state.inputText;
          
        await broadcastListener.sendBroadcast(messageToSend);
        console.log('Message broadcasted successfully');
      } catch (error) {
        console.error('Failed to broadcast message:', error);
        Alert.alert('Error', 'Failed to send broadcast message');
      }
    }
    
    this.setState({
      inputText: '',
    });
  };

  onTextChange = (text: string) => {
    this.setState({
      inputText: text,
    });
  };

  render() {
    return (
      <PaperProvider>
        <ThemeProvider>
          <AppContent 
            inputText={this.state.inputText}
            onTextChange={this.onTextChange}
            onPress={this.onPress}
            receivedMessages={this.state.receivedMessages}
            isListening={this.state.isListening}
            onClearMessages={this.clearMessages}
            ownIpAddress={this.state.ownIpAddress}
            onOpenSettings={this.toggleSettings}
            username={this.state.username}
          />
          <SettingsModal
            visible={this.state.showSettings}
            username={this.state.username}
            onClose={this.toggleSettings}
            onSave={this.saveUsername}
          />
        </ThemeProvider>
      </PaperProvider>
    );
  }
}

const AppContent: React.FC<{
  inputText: string;
  onTextChange: (text: string) => void;
  onPress: () => void;
  receivedMessages: Array<{message: string, timestamp: string, sender: string}>;
  isListening: boolean;
  onClearMessages: () => void;
  ownIpAddress: string | null;
  onOpenSettings: () => void;
  username: string;
}> = ({ inputText, onTextChange, onPress, receivedMessages, isListening, onClearMessages, ownIpAddress, onOpenSettings, username }) => {
  const theme = useMaterialYouTheme();
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);

  React.useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 0,
      paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0,
      backgroundColor: theme.background,
    },
    input: {
      flex: 1,
      backgroundColor: theme.card,
    },
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
    statusInfo: {
      flex: 1,
    },
    buttonContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusText: {
      color: theme.text,
      fontSize: 14,
    },
    messageCard: {
      marginBottom: 8,
      backgroundColor: theme.card,
    },
    messageHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    messageText: {
      color: theme.text,
      fontSize: 16,
    },
    messageInfo: {
      color: theme.text,
      fontSize: 12,
      opacity: 0.7,
    },
    clearButton: {
      marginTop: 10,
      backgroundColor: theme.card,
    },
    clearButtonLabel: {
      color: theme.text,
    },
    ipText: {
      color: theme.text,
      fontSize: 12,
      opacity: 0.7,
    },
  });

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={keyboardVisible ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVisible ? (Platform.OS === 'ios' ? 0 : 0) : 0}
    >
      <View style={styles.messagesContainer}>
        <View style={styles.statusContainer}>
          <View style={styles.statusInfo}>
            <PaperText style={styles.statusText}>
              Status: {isListening ? 'Listening for broadcasts' : 'Not listening'}
            </PaperText>
            {ownIpAddress && (
              <PaperText style={styles.ipText}>
                Device IP: {ownIpAddress} (messages from this IP are filtered)
              </PaperText>
            )}
            {username && (
              <PaperText style={styles.ipText}>
                Username: {username}
              </PaperText>
            )}
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
        
        <ScrollView>
          {receivedMessages.length === 0 ? (
            <PaperText style={styles.statusText}>
              No broadcast messages received yet...
            </PaperText>
          ) : (
            receivedMessages.map((msg, index) => (
              <Card key={index} style={styles.messageCard}>
                <Card.Content>
                  <View style={styles.messageHeader}>
                    <PaperText style={styles.messageInfo}>
                      From: {msg.sender}
                    </PaperText>
                    <PaperText style={styles.messageInfo}>
                      {msg.timestamp}
                    </PaperText>
                  </View>
                  <PaperText style={styles.messageText}>
                    {msg.message}
                  </PaperText>
                </Card.Content>
              </Card>
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
          placeholder={username ? `${username}: Enter your message...` : 'Enter your message...'}
        />
        <IconButton
          icon="send"
          mode="contained"
          onPress={onPress}
          iconColor={theme.textColored}
          containerColor={theme.primary}
          disabled={!inputText.trim()}
          size={24}
        />
      </View>
    </KeyboardAvoidingView>
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

  // Update temp username when the modal opens or username changes
  React.useEffect(() => {
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
      // Ensure content can scroll if it grows too tall
      overflow: 'hidden',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    input: {
      marginBottom: 20,
      backgroundColor: theme.card,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
    },
    button: {
      flex: 1,
    },
    // content container style for ScrollView inside modal
    modalScrollContent: {
      paddingBottom: 8,
    },
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
                buttonColor={theme.primary}
                textColor={theme.textColored}
                style={modalStyles.button}
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
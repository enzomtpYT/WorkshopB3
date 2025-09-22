import React, {Component} from 'react';
import {View, StyleSheet, ScrollView, Alert} from 'react-native';
import {TextInput, Button, Card, Text as PaperText} from 'react-native-paper';

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

class App extends Component {
  state = {
    inputText: '',
    receivedMessages: [] as Array<{message: string, timestamp: string, sender: string}>,
    isListening: false,
  };

  componentDidMount() {
    this.startBroadcastListener();
  }

  componentWillUnmount() {
    broadcastListener.cleanup();
  }

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
      
      this.setState({ isListening: true });
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

  onPress = async () => {
    if (this.state.inputText.trim()) {
      try {
        await broadcastListener.sendBroadcast(this.state.inputText);
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
      <ThemeProvider>
        <AppContent 
          inputText={this.state.inputText}
          onTextChange={this.onTextChange}
          onPress={this.onPress}
          receivedMessages={this.state.receivedMessages}
          isListening={this.state.isListening}
          onClearMessages={this.clearMessages}
        />
      </ThemeProvider>
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
}> = ({ inputText, onTextChange, onPress, receivedMessages, isListening, onClearMessages }) => {
  const theme = useMaterialYouTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      backgroundColor: theme.background,
    },
    input: {
      marginBottom: 20,
      backgroundColor: theme.card,
    },
    messagesContainer: {
      flex: 1,
      marginTop: 20,
    },
    statusContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
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
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.messagesContainer}>
        <View style={styles.statusContainer}>
          <PaperText style={styles.statusText}>
            Status: {isListening ? 'Listening for broadcasts' : 'Not listening'}
          </PaperText>
          <Button 
            mode="outlined" 
            onPress={onClearMessages}
            style={styles.clearButton}
            disabled={receivedMessages.length === 0}
          >
            Clear
          </Button>
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
      <TextInput
        mode="outlined"
        label="Message"
        value={inputText}
        onChangeText={onTextChange}
        style={styles.input}
        textColor={theme.text}
        outlineColor={theme.primary}
        activeOutlineColor={theme.primary}
      />
      <Button 
        mode="contained" 
        onPress={onPress}
        buttonColor={theme.primary}
        textColor={theme.textColored}
        disabled={!inputText.trim()}
      >
        Broadcast Message
      </Button>
    </View>
  );
};

export default App;
import { Alert } from 'react-native';

export interface ToastConfig {
  message: string;
  duration?: number;
  type?: 'error' | 'success' | 'warning' | 'info';
  action?: {
    label: string;
    onPress: () => void;
  };
}

class ToastService {
  private toastHandler: ((config: ToastConfig) => void) | null = null;

  // Set the toast handler (will be called from the main App component)
  setToastHandler(handler: (config: ToastConfig) => void) {
    this.toastHandler = handler;
  }

  // Show error toast
  showError(message: string, duration?: number, action?: ToastConfig['action']) {
    if (this.toastHandler) {
      this.toastHandler({
        message,
        duration: duration || 4000,
        type: 'error',
        action
      });
    } else {
      // Fallback to Alert if toast handler is not available
      Alert.alert('Error', message);
    }
  }

  // Show success toast
  showSuccess(message: string, duration?: number, action?: ToastConfig['action']) {
    if (this.toastHandler) {
      this.toastHandler({
        message,
        duration: duration || 3000,
        type: 'success',
        action
      });
    } else {
      Alert.alert('Success', message);
    }
  }

  // Show warning toast
  showWarning(message: string, duration?: number, action?: ToastConfig['action']) {
    if (this.toastHandler) {
      this.toastHandler({
        message,
        duration: duration || 3500,
        type: 'warning',
        action
      });
    } else {
      Alert.alert('Warning', message);
    }
  }

  // Show info toast
  showInfo(message: string, duration?: number, action?: ToastConfig['action']) {
    if (this.toastHandler) {
      this.toastHandler({
        message,
        duration: duration || 3000,
        type: 'info',
        action
      });
    } else {
      Alert.alert('Info', message);
    }
  }

  // Generic show method
  show(config: ToastConfig) {
    if (this.toastHandler) {
      this.toastHandler(config);
    } else {
      const title = config.type ? config.type.charAt(0).toUpperCase() + config.type.slice(1) : 'Notification';
      Alert.alert(title, config.message);
    }
  }

  // Clear the toast handler
  clearHandler() {
    this.toastHandler = null;
  }
}

export const toastService = new ToastService();
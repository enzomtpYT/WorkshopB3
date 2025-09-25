import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { useMaterialYouTheme } from '../../App';
import { ToastConfig, toastService } from '../services/ToastService';

interface ToastState extends ToastConfig {
  visible: boolean;
}

const CustomToast: React.FC = () => {
  const theme = useMaterialYouTheme();
  const [toastState, setToastState] = useState<ToastState>({
    message: '',
    visible: false,
    duration: 3000,
    type: 'info'
  });

  useEffect(() => {
    // Register the toast handler with the service
    toastService.setToastHandler((config: ToastConfig) => {
      setToastState({
        ...config,
        visible: true
      });
    });

    // Cleanup on unmount
    return () => {
      toastService.clearHandler();
    };
  }, []);

  const hideToast = () => {
    setToastState(prev => ({ ...prev, visible: false }));
  };

  const getToastColors = () => {
    switch (toastState.type) {
      case 'error':
        return {
          backgroundColor: '#D32F2F', // Red
          textColor: '#FFFFFF'
        };
      case 'success':
        return {
          backgroundColor: '#388E3C', // Green
          textColor: '#FFFFFF'
        };
      case 'warning':
        return {
          backgroundColor: '#F57C00', // Orange
          textColor: '#FFFFFF'
        };
      case 'info':
      default:
        return {
          backgroundColor: theme.primary,
          textColor: theme.textColored
        };
    }
  };

  const colors = getToastColors();

  const getIcon = () => {
    switch (toastState.type) {
      case 'error':
        return '⚠️';
      case 'success':
        return '✅';
      case 'warning':
        return '🔔';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  return (
    <Snackbar
      visible={toastState.visible}
      onDismiss={hideToast}
      duration={toastState.duration}
      style={{
        backgroundColor: colors.backgroundColor,
      }}
      theme={{
        colors: {
          surface: colors.backgroundColor,
          onSurface: colors.textColor,
          primary: colors.textColor,
        }
      }}
      action={
        toastState.action
          ? {
              label: toastState.action.label,
              onPress: () => {
                toastState.action?.onPress();
                hideToast();
              },
              textColor: colors.textColor,
            }
          : undefined
      }
    >
      <Text style={{ color: colors.textColor }}>
        {getIcon()} {toastState.message}
      </Text>
    </Snackbar>
  );
};

export default CustomToast;
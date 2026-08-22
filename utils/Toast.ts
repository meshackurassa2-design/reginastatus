import { DeviceEventEmitter } from 'react-native';

export const Toast = {
  show: (message: string) => {
    DeviceEventEmitter.emit('showToast', message);
  }
};

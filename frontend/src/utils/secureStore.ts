import { Platform } from 'react-native';
import * as ExpoSecureStore from 'expo-secure-store';

const secureStore = {
  getItemAsync: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.warn('localStorage getItem failed', e);
        return null;
      }
    }
    return ExpoSecureStore.getItemAsync(key);
  },

  setItemAsync: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.warn('localStorage setItem failed', e);
      }
      return;
    }
    return ExpoSecureStore.setItemAsync(key, value);
  },

  deleteItemAsync: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn('localStorage removeItem failed', e);
      }
      return;
    }
    return ExpoSecureStore.deleteItemAsync(key);
  },
};

export default secureStore;

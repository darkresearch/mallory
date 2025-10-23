import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Cross-platform secure storage that works on web and mobile
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        // Use sessionStorage for better security on web
        // For auth tokens, consider using httpOnly cookies in production
        return sessionStorage.getItem(key);
      } else {
        // Use SecureStore on mobile
        return await SecureStore.getItemAsync(key);
      }
    } catch (error) {
      console.error('Error getting item from secure storage:', error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        // Use sessionStorage for better security on web
        sessionStorage.setItem(key, value);
      } else {
        // Use SecureStore on mobile
        await SecureStore.setItemAsync(key, value);
      }
    } catch (error) {
      console.error('Error setting item in secure storage:', error);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        // Use sessionStorage for better security on web
        sessionStorage.removeItem(key);
      } else {
        // Use SecureStore on mobile
        await SecureStore.deleteItemAsync(key);
      }
    } catch (error) {
      console.error('Error removing item from secure storage:', error);
    }
  },
};

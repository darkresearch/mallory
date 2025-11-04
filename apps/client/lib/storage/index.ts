import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Export storage keys for consistent usage across the app
export { SECURE_STORAGE_KEYS, SESSION_STORAGE_KEYS } from './keys';
export type { SecureStorageKey, SessionStorageKey } from './keys';

// Export draft message utilities
export { getDraftMessage, saveDraftMessage, clearDraftMessage, clearAllDraftMessages } from './draftMessages';
export type { DraftMessagesMap } from './draftMessages';

/**
 * Storage Provider Interface
 * Simple async key-value storage API
 */
interface StorageProvider {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Create a storage provider for a specific storage type
 * Handles cross-platform differences automatically
 */
function createStorageProvider(type: 'persistent' | 'session'): StorageProvider {
  return {
    async getItem(key: string): Promise<string | null> {
      try {
        if (Platform.OS === 'web') {
          // On web: use localStorage (persistent) or sessionStorage (session-only)
          const browserStorage = type === 'persistent' ? localStorage : sessionStorage;
          const value = browserStorage.getItem(key);
          
          // 🔍 DEBUG: Log storage access for troubleshooting
          if (value !== null) {
            console.log(`📦 [storage.${type}] GET "${key}":`, value.substring(0, 50) + (value.length > 50 ? '...' : ''));
          } else {
            console.log(`📦 [storage.${type}] GET "${key}": null (not found)`);
          }
          
          return value;
        } else {
          // On mobile: use SecureStore for both types
          // (mobile apps don't have the concept of "session" storage)
          const value = await SecureStore.getItemAsync(key);
          
          if (value !== null) {
            console.log(`📦 [storage.${type}/mobile] GET "${key}":`, value.substring(0, 50) + (value.length > 50 ? '...' : ''));
          } else {
            console.log(`📦 [storage.${type}/mobile] GET "${key}": null (not found)`);
          }
          
          return value;
        }
      } catch (error) {
        console.error(`❌ [storage.${type}] Error getting "${key}":`, error);
        return null;
      }
    },

    async setItem(key: string, value: string): Promise<void> {
      try {
        if (Platform.OS === 'web') {
          const browserStorage = type === 'persistent' ? localStorage : sessionStorage;
          browserStorage.setItem(key, value);
          
          // 🔍 DEBUG: Log storage writes for troubleshooting
          console.log(`💾 [storage.${type}] SET "${key}":`, value.substring(0, 50) + (value.length > 50 ? '...' : ''));
        } else {
          await SecureStore.setItemAsync(key, value);
          console.log(`💾 [storage.${type}/mobile] SET "${key}":`, value.substring(0, 50) + (value.length > 50 ? '...' : ''));
        }
      } catch (error) {
        console.error(`❌ [storage.${type}] Error setting "${key}":`, error);
      }
    },

    async removeItem(key: string): Promise<void> {
      try {
        if (Platform.OS === 'web') {
          const browserStorage = type === 'persistent' ? localStorage : sessionStorage;
          browserStorage.removeItem(key);
          
          // 🔍 DEBUG: Log storage deletions for troubleshooting
          console.log(`🗑️  [storage.${type}] REMOVE "${key}"`);
        } else {
          await SecureStore.deleteItemAsync(key);
          console.log(`🗑️  [storage.${type}/mobile] REMOVE "${key}"`);
        }
      } catch (error) {
        console.error(`❌ [storage.${type}] Error removing "${key}":`, error);
      }
    },
  };
}

/**
 * Cross-platform storage API
 * 
 * Usage:
 *   await storage.persistent.setItem(key, value)  // Survives app restart, browser sleep
 *   await storage.session.setItem(key, value)     // Cleared on tab close (web only)
 * 
 * Platform behavior:
 *   Web:    persistent = localStorage, session = sessionStorage
 *   Mobile: both use SecureStore (mobile apps don't distinguish session storage)
 */
export const storage = {
  /** Persistent storage - survives app restart and browser sleep */
  persistent: createStorageProvider('persistent'),
  
  /** Session storage - cleared on tab close (web only, uses SecureStore on mobile) */
  session: createStorageProvider('session'),
};

import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

/**
 * Generate UUID using platform-appropriate method
 * - Native (Android/iOS): Uses expo-crypto.randomUUID() (faster, no polyfill needed)
 * - Web: Falls back to uuid library (via crypto.getRandomValues polyfill)
 */
export function generateUUID(): string {
  if (Platform.OS !== 'web') {
    try {
      // Use expo-crypto.randomUUID() on native platforms
      return Crypto.randomUUID();
    } catch (error) {
      console.warn('⚠️ expo-crypto.randomUUID() failed, falling back to uuid library:', error);
      // Fall through to uuid library fallback
    }
  }

  // Fallback: Use uuid library (works on web and as fallback on native)
  // This uses crypto.getRandomValues() which is polyfilled in polyfills.js
  const { v4: uuidv4 } = require('uuid');
  return uuidv4();
}


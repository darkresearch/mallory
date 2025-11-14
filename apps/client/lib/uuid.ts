import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { v4 as uuidv4 } from 'uuid'; // Fallback for web or if expo-crypto fails

/**
 * Generates a UUID using expo-crypto.randomUUID on native platforms
 * and uuidv4 from the 'uuid' library on web or as a fallback.
 *
 * This centralizes UUID generation and ensures compatibility across platforms.
 */
export function generateUUID(): string {
  if (Platform.OS !== 'web') {
    try {
      return Crypto.randomUUID();
    } catch (error) {
      // Fallback to uuid library if expo-crypto fails
      console.warn('⚠️ expo-crypto.randomUUID() failed, falling back to uuid library');
      return uuidv4();
    }
  }
  // On web, use uuid library
  return uuidv4();
}


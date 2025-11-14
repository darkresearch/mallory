import { Platform } from 'react-native';
import structuredClone from '@ungap/structured-clone';
import { Buffer } from 'buffer';

// Polyfill Buffer globally for Solana libraries
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// Polyfill crypto.getRandomValues for React Native (required for uuidv4)
if (Platform.OS !== 'web') {
  try {
    // Try react-native-get-random-values first (more reliable)
    require('react-native-get-random-values');
  } catch (error) {
    // Fallback to expo-random if react-native-get-random-values is not available
    try {
      const { getRandomBytes } = require('expo-random');
      if (typeof global.crypto === 'undefined') {
        global.crypto = {};
      }
      if (typeof global.crypto.getRandomValues === 'undefined') {
        global.crypto.getRandomValues = (array) => {
          const randomBytes = getRandomBytes(array.length);
          for (let i = 0; i < array.length; i++) {
            array[i] = randomBytes[i];
          }
          return array;
        };
      }
    } catch (expoError) {
      console.warn('⚠️ Could not polyfill crypto.getRandomValues. UUID generation may fail.');
    }
  }
}

if (Platform.OS !== 'web') {
  const setupPolyfills = async () => {
    const { polyfillGlobal } = await import(
      'react-native/Libraries/Utilities/PolyfillFunctions'
    );

    const { TextEncoderStream, TextDecoderStream } = await import(
      '@stardazed/streams-text-encoding'
    );

    if (!('structuredClone' in global)) {
      polyfillGlobal('structuredClone', () => structuredClone);
    }

    polyfillGlobal('TextEncoderStream', () => TextEncoderStream);
    polyfillGlobal('TextDecoderStream', () => TextDecoderStream);
  };

  setupPolyfills();
}

export {};

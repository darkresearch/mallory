import { Platform } from 'react-native';
import structuredClone from '@ungap/structured-clone';
import { Buffer } from 'buffer';
import * as Crypto from 'expo-crypto';

// Polyfill Buffer globally for Solana libraries
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

if (Platform.OS !== 'web') {
  // Polyfill crypto.getRandomValues for Grid SDK and other crypto libraries
  // Grid SDK needs this for generateSessionSecrets() keypair generation
  if (typeof global.crypto === 'undefined') {
    global.crypto = {};
  }
  
  if (!global.crypto.getRandomValues) {
    // Use expo-crypto for getRandomValues polyfill
    global.crypto.getRandomValues = (array) => {
      // Generate random bytes using expo-crypto
      const randomBytes = Crypto.getRandomBytes(array.length);
      array.set(randomBytes);
      return array;
    };
  }

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

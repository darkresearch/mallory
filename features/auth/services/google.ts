import { Platform } from 'react-native';
import { config } from '../../../lib';

// Conditionally import Google Sign-In only on native platforms
let GoogleSignin: any;
if (Platform.OS !== 'web') {
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
}

// Configure Google Sign-In
export const configureGoogleSignIn = () => {
  if (!GoogleSignin) return; // Skip on web
  
  GoogleSignin.configure({
    // Get this from Google Cloud Console
    iosClientId: config.googleIosClientId,
    // For Android (if needed)
    webClientId: config.googleWebClientId,
    // Scopes
    scopes: ['profile', 'email'],
    // Offline access for refresh tokens
    offlineAccess: true,
    // Force account selection and don't use nonce
    forceCodeForRefreshToken: false,
  });
};

export const signInWithGoogle = async () => {
  if (!GoogleSignin) {
    throw new Error('Google Sign-In is not available on web');
  }
  
  try {
    // Check if device supports Google Play
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    
    // Sign in
    const userInfo = await GoogleSignin.signIn();
    
    // Get the ID token
    const { idToken } = await GoogleSignin.getTokens();
    
    return {
      idToken,
      user: userInfo.user,
    };
  } catch (error) {
    console.error('Google Sign-In error:', error);
    throw error;
  }
};

export const signOutFromGoogle = async () => {
  if (!GoogleSignin) return; // Skip on web
  
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    console.error('Google Sign-Out error:', error);
  }
};

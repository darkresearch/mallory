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
  
  if (!config.googleAndroidClientId) {
    console.error('❌ Google Android Client ID is not configured');
    return;
  }
  
  console.log('🔐 Configuring Google Sign-In:', {
    webClientId: config.googleAndroidClientId,
    hasIosClientId: !!config.googleIosClientId,
    platform: Platform.OS,
  });
  
  GoogleSignin.configure({
    // Get this from Google Cloud Console
    iosClientId: config.googleIosClientId,
    // For Android: Use Web Client ID (OAuth 2.0 client ID)
    // Note: You also need an Android Client ID registered in Google Cloud Console
    // with SHA-1 fingerprint and package name (com.yourcompany.mallory)
    webClientId: config.googleAndroidClientId,
    // Scopes
    scopes: ['profile', 'email'],
    // Offline access for refresh tokens
    offlineAccess: true,
    // Force account selection and don't use nonce
    forceCodeForRefreshToken: false,
  });
  
  console.log('✅ Google Sign-In configured');
};

export const signInWithGoogle = async () => {
  if (!GoogleSignin) {
    throw new Error('Google Sign-In is not available on web');
  }
  
  try {
    // Check if device supports Google Play
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    
    console.log('🔐 Starting Google Sign-In...');
    
    // Sign in
    const userInfo = await GoogleSignin.signIn();
    console.log('🔐 Google Sign-In response:', JSON.stringify(userInfo, null, 2));
    
    // Handle different response structures
    // The response might be userInfo.data or userInfo.user or just userInfo
    const user = userInfo.data?.user || userInfo.user || userInfo;
    const email = user?.email || userInfo.data?.user?.email;
    
    if (!email) {
      console.error('❌ No email found in Google Sign-In response:', userInfo);
      throw new Error('Failed to get user email from Google Sign-In');
    }
    
    console.log('✅ Google Sign-In successful:', { email });
    
    // Get the ID token
    const { idToken } = await GoogleSignin.getTokens();
    
    if (!idToken) {
      throw new Error('Failed to get ID token from Google Sign-In');
    }
    
    return {
      idToken,
      user: user || { email },
    };
  } catch (error: any) {
    console.error('❌ Google Sign-In error:', error);
    
    // Provide helpful error messages for common issues
    if (error.code === 10) {
      // DEVELOPER_ERROR
      console.error('🔴 DEVELOPER_ERROR (code 10): This usually means:');
      console.error('   1. SHA-1 fingerprint not registered in Google Cloud Console');
      console.error('   2. Package name mismatch (expected: com.yourcompany.mallory)');
      console.error('   3. Android Client ID not properly configured');
      console.error('   SHA-1 (debug): 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25');
      console.error('   Android Client ID: 374299905413-j09ks14jil018g9s0g529l8u5u2urth6.apps.googleusercontent.com');
      console.error('   Web Client ID (for webClientId): 374299905413-i029jp98crlc1c8ak8qug7ntrump0be3.apps.googleusercontent.com');
    }
    
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

import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Platform-aware URL helper: converts localhost/127.0.0.1 to 10.0.2.2 on Android
 * Android emulator uses 10.0.2.2 as an alias for the host machine's localhost
 */
function getPlatformAwareUrl(url: string): string {
  if (Platform.OS === 'android' && (url.includes('localhost') || url.includes('127.0.0.1'))) {
    return url.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2');
  }
  return url;
}

/**
 * Runtime configuration values
 * Tries Constants.expoConfig.extra first (works on native), 
 * falls back to process.env (works on web with Metro)
 */
const rawConfig = {
  webOAuthRedirectUrl: (Constants.expoConfig?.extra?.webOAuthRedirectUrl || process.env.EXPO_PUBLIC_WEB_OAUTH_REDIRECT_URL) as string,
  backendApiUrl: (Constants.expoConfig?.extra?.backendApiUrl || process.env.EXPO_PUBLIC_BACKEND_API_URL) as string,
  solanaRpcUrl: (Constants.expoConfig?.extra?.solanaRpcUrl || process.env.EXPO_PUBLIC_SOLANA_RPC_URL) as string,
  supabaseUrl: (Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL) as string,
  supabaseAnonKey: (Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) as string,
  gridApiKey: (Constants.expoConfig?.extra?.gridApiKey || process.env.EXPO_PUBLIC_GRID_API_KEY) as string,
  gridEnv: (Constants.expoConfig?.extra?.gridEnv || process.env.EXPO_PUBLIC_GRID_ENV || 'sandbox') as 'sandbox' | 'production',
  googleAndroidClientId: (Constants.expoConfig?.extra?.googleAndroidClientId || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) as string,
  googleIosClientId: (Constants.expoConfig?.extra?.googleIosClientId || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) as string,
  termsUrl: (Constants.expoConfig?.extra?.termsUrl || process.env.EXPO_PUBLIC_TERMS_URL) as string,
  privacyUrl: (Constants.expoConfig?.extra?.privacyUrl || process.env.EXPO_PUBLIC_PRIVACY_URL) as string,
  // Development mode detection
  isDevelopment: __DEV__,
};

// Apply platform-aware URL transformation for backendApiUrl
// Also handle dev mode default (localhost:3001)
const processedBackendApiUrl = rawConfig.backendApiUrl 
  ? getPlatformAwareUrl(rawConfig.backendApiUrl)
  : (__DEV__ ? getPlatformAwareUrl('http://localhost:3001') : rawConfig.backendApiUrl);

export const config = {
  ...rawConfig,
  backendApiUrl: processedBackendApiUrl,
};

// Debug log on load
console.log('📋 Config loaded:', {
  webOAuthRedirectUrl: config.webOAuthRedirectUrl,
  backendApiUrl: config.backendApiUrl,
  supabaseUrl: config.supabaseUrl,
  supabaseAnonKey: config.supabaseAnonKey ? 'loaded' : 'missing',
  gridApiKey: config.gridApiKey ? 'loaded' : 'missing',
  gridEnv: config.gridEnv,
  googleAndroidClientId: config.googleAndroidClientId ? 'loaded' : 'missing',
  googleIosClientId: config.googleIosClientId ? 'loaded' : 'missing',
  termsUrl: config.termsUrl ? 'loaded' : 'missing',
  privacyUrl: config.privacyUrl ? 'loaded' : 'missing',
});


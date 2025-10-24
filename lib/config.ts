import Constants from 'expo-constants';

/**
 * Runtime configuration values from app.config.js
 * These work consistently across all platforms (web, iOS, Android)
 */
export const config = {
  webOAuthRedirectUrl: Constants.expoConfig?.extra?.webOAuthRedirectUrl as string,
  backendApiUrl: Constants.expoConfig?.extra?.backendApiUrl as string,
  solanaRpcUrl: Constants.expoConfig?.extra?.solanaRpcUrl as string,
  supabaseUrl: Constants.expoConfig?.extra?.supabaseUrl as string,
  supabaseAnonKey: Constants.expoConfig?.extra?.supabaseAnonKey as string,
  googleAndroidClientId: Constants.expoConfig?.extra?.googleAndroidClientId as string,
  googleIosClientId: Constants.expoConfig?.extra?.googleIosClientId as string,
};

// Debug log on load
console.log('📋 Config loaded:', {
  webOAuthRedirectUrl: config.webOAuthRedirectUrl,
  backendApiUrl: config.backendApiUrl,
  supabaseUrl: config.supabaseUrl,
  supabaseAnonKey: config.supabaseAnonKey ? 'loaded' : 'missing',
  googleAndroidClientId: config.googleAndroidClientId ? 'loaded' : 'missing',
  googleIosClientId: config.googleIosClientId ? 'loaded' : 'missing',
});


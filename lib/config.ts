import Constants from 'expo-constants';

/**
 * Runtime configuration values from app.config.js
 * These work consistently across all platforms (web, iOS, Android)
 */
export const config = {
  authRedirectUrl: Constants.expoConfig?.extra?.authRedirectUrl as string,
  apiUrl: Constants.expoConfig?.extra?.apiUrl as string,
  solanaRpcUrl: Constants.expoConfig?.extra?.solanaRpcUrl as string,
  supabaseUrl: Constants.expoConfig?.extra?.supabaseUrl as string,
  supabaseAnonKey: Constants.expoConfig?.extra?.supabaseAnonKey as string,
  googleWebClientId: Constants.expoConfig?.extra?.googleWebClientId as string,
  googleIosClientId: Constants.expoConfig?.extra?.googleIosClientId as string,
};

// Debug log on load
console.log('📋 Config loaded:', {
  authRedirectUrl: config.authRedirectUrl,
  apiUrl: config.apiUrl,
  supabaseUrl: config.supabaseUrl,
  supabaseAnonKey: config.supabaseAnonKey ? 'loaded' : 'missing',
  googleWebClientId: config.googleWebClientId ? 'loaded' : 'missing',
  googleIosClientId: config.googleIosClientId ? 'loaded' : 'missing',
});


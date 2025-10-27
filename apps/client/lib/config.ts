import Constants from 'expo-constants';

/**
 * Runtime configuration values
 * Tries Constants.expoConfig.extra first (works on native), 
 * falls back to process.env (works on web with Metro)
 */
export const config = {
  webOAuthRedirectUrl: (Constants.expoConfig?.extra?.webOAuthRedirectUrl || process.env.EXPO_PUBLIC_WEB_OAUTH_REDIRECT_URL) as string,
  backendApiUrl: (Constants.expoConfig?.extra?.backendApiUrl || process.env.EXPO_PUBLIC_BACKEND_API_URL) as string,
  solanaRpcUrl: (Constants.expoConfig?.extra?.solanaRpcUrl || process.env.EXPO_PUBLIC_SOLANA_RPC_URL) as string,
  supabaseUrl: (Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL) as string,
  supabaseAnonKey: (Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) as string,
  googleAndroidClientId: (Constants.expoConfig?.extra?.googleAndroidClientId || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) as string,
  googleIosClientId: (Constants.expoConfig?.extra?.googleIosClientId || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) as string,
  termsUrl: (Constants.expoConfig?.extra?.termsUrl || process.env.EXPO_PUBLIC_TERMS_URL) as string,
  privacyUrl: (Constants.expoConfig?.extra?.privacyUrl || process.env.EXPO_PUBLIC_PRIVACY_URL) as string,
  gridApiKey: (Constants.expoConfig?.extra?.gridApiKey || process.env.EXPO_PUBLIC_GRID_API_KEY) as string,
  gridEnv: (Constants.expoConfig?.extra?.gridEnv || process.env.EXPO_PUBLIC_GRID_ENV) as string,
};

// Debug log on load
console.log('📋 Config loaded:', {
  webOAuthRedirectUrl: config.webOAuthRedirectUrl,
  backendApiUrl: config.backendApiUrl,
  supabaseUrl: config.supabaseUrl,
  supabaseAnonKey: config.supabaseAnonKey ? 'loaded' : 'missing',
  googleAndroidClientId: config.googleAndroidClientId ? 'loaded' : 'missing',
  googleIosClientId: config.googleIosClientId ? 'loaded' : 'missing',
  termsUrl: config.termsUrl ? 'loaded' : 'missing',
  privacyUrl: config.privacyUrl ? 'loaded' : 'missing',
  gridApiKey: config.gridApiKey ? 'loaded' : 'missing',
  gridEnv: config.gridEnv || 'sandbox',
});


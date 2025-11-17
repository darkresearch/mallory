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
  gridApiKey: (Constants.expoConfig?.extra?.gridApiKey || process.env.EXPO_PUBLIC_GRID_API_KEY) as string,
  gridEnv: (Constants.expoConfig?.extra?.gridEnv || process.env.EXPO_PUBLIC_GRID_ENV || 'sandbox') as 'sandbox' | 'production',
  googleAndroidClientId: (Constants.expoConfig?.extra?.googleAndroidClientId || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) as string,
  googleIosClientId: (Constants.expoConfig?.extra?.googleIosClientId || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) as string,
  termsUrl: (Constants.expoConfig?.extra?.termsUrl || process.env.EXPO_PUBLIC_TERMS_URL) as string,
  privacyUrl: (Constants.expoConfig?.extra?.privacyUrl || process.env.EXPO_PUBLIC_PRIVACY_URL) as string,
  // Development mode detection
  isDevelopment: __DEV__,
};

/**
 * Gas Abstraction Feature Flags
 * 
 * Controls gas abstraction feature availability and behavior.
 * Requirements: 1.4, 1.5, 1.6, 9.1
 */
export const FEATURES = {
  /**
   * Master feature flag - enables/disables all gas abstraction features
   * Default: false (feature disabled by default)
   */
  GAS_ABSTRACTION_ENABLED: (Constants.expoConfig?.extra?.gasAbstractionEnabled || 
    process.env.EXPO_PUBLIC_GAS_ABSTRACTION_ENABLED === 'true') as boolean,
  
  /**
   * Whether gasless mode should be enabled by default for new users
   * Default: false (opt-in by default)
   */
  GAS_ABSTRACTION_DEFAULT_ENABLED: (Constants.expoConfig?.extra?.gasAbstractionDefaultEnabled || 
    process.env.EXPO_PUBLIC_GAS_ABSTRACTION_DEFAULT_ENABLED === 'true') as boolean,
  
  /**
   * Low balance threshold in USDC
   * When balance falls below this, show low balance warning
   * Default: 0.1 USDC
   */
  GAS_ABSTRACTION_LOW_BALANCE_THRESHOLD: parseFloat(
    Constants.expoConfig?.extra?.gasAbstractionLowBalanceThreshold || 
    process.env.EXPO_PUBLIC_GAS_ABSTRACTION_LOW_BALANCE_THRESHOLD || 
    '0.1'
  ),
  
  /**
   * Suggested top-up amount in USDC
   * Default: 5.0 USDC
   */
  GAS_ABSTRACTION_SUGGESTED_TOPUP: parseFloat(
    Constants.expoConfig?.extra?.gasAbstractionSuggestedTopup || 
    process.env.EXPO_PUBLIC_GAS_ABSTRACTION_SUGGESTED_TOPUP || 
    '5.0'
  ),
  
  /**
   * Minimum top-up amount in USDC
   * Default: 0.5 USDC
   */
  GAS_ABSTRACTION_MIN_TOPUP: parseFloat(
    Constants.expoConfig?.extra?.gasAbstractionMinTopup || 
    process.env.EXPO_PUBLIC_GAS_ABSTRACTION_MIN_TOPUP || 
    '0.5'
  ),
  
  /**
   * Maximum top-up amount in USDC
   * Default: 100.0 USDC
   */
  GAS_ABSTRACTION_MAX_TOPUP: parseFloat(
    Constants.expoConfig?.extra?.gasAbstractionMaxTopup || 
    process.env.EXPO_PUBLIC_GAS_ABSTRACTION_MAX_TOPUP || 
    '100.0'
  ),
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


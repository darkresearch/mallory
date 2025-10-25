import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { config } from '../config';

const supabaseUrl = config.supabaseUrl;
const supabaseAnonKey = config.supabaseAnonKey;

// Debug environment variables
console.log('Supabase Config:', {
  url: supabaseUrl,
  anonKey: supabaseAnonKey ? 'loaded' : 'missing',
  anonKeyLength: supabaseAnonKey?.length || 0
});

// Validate required environment variables
if (!supabaseUrl) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL is required');
}

if (!supabaseAnonKey) {
  throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY is required');
}

// Create Supabase client with React Native async storage and realtime support
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Detect session in URL for web OAuth redirects, but not for mobile
    detectSessionInUrl: Platform.OS === 'web',
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    },
    heartbeatIntervalMs: 30000, // 30 second heartbeat
    timeout: 10000 // 10 second timeout
  }
});

// Add debugging for realtime connection
console.log('🔴 [SUPABASE] Realtime client created');
console.log('🔴 [SUPABASE] Realtime config:', {
  url: supabaseUrl,
  heartbeatIntervalMs: 30000,
  timeout: 10000,
  eventsPerSecond: 10
});

// Log realtime client details (without invalid method calls)
console.log('🔴 [SUPABASE] Realtime client details:', {
  isConnected: supabase.realtime.isConnected?.() || 'unknown',
  channels: supabase.realtime.channels?.length || 0,
  accessToken: !!supabase.realtime.accessToken
});

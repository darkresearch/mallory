/**
 * Test-specific Supabase Client
 * 
 * Same as production client but without React Native dependencies
 */

import { createClient } from '@supabase/supabase-js';

// Load env if not already loaded
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL is required');
}

if (!supabaseAnonKey) {
  throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY is required');
}

console.log('Supabase Test Client Config:', {
  url: supabaseUrl,
  anonKey: supabaseAnonKey ? 'loaded' : 'missing',
});

// Create Supabase client for tests (no React Native dependencies)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false, // Don't persist in tests
    detectSessionInUrl: false,
  },
});

console.log('✅ Supabase test client created');


import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load .env file only if it exists (won't override existing env vars from CI/GitHub Actions)
// In CI, environment variables come from GitHub Actions secrets via workflow env: block
dotenv.config({ override: false });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  const missing = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  const errorMessage = isCI
    ? `Missing Supabase environment variables: ${missing.join(', ')}\n` +
      `This is running in CI. Please ensure these GitHub secrets are configured:\n` +
      `  - EXPO_PUBLIC_SUPABASE_URL (mapped to SUPABASE_URL)\n` +
      `  - SUPABASE_SERVICE_ROLE_KEY\n` +
      `See .github/workflows/test.yml and GITHUB_ACTIONS_SECRETS_CHECKLIST.md for setup instructions.`
    : `Missing Supabase environment variables: ${missing.join(', ')}\n` +
      `Please create a .env file in apps/server/ with the required variables.\n` +
      `See README.md for setup instructions.`;
  
  throw new Error(errorMessage);
}

/**
 * Supabase client with service role key
 * Used for server-side operations and auth validation
 */
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('✅ Supabase client initialized');


/**
 * Test Helpers
 * 
 * Minimal wrappers around production code for test-specific needs
 * Philosophy: Import production code, add ONLY test-specific orchestration
 */

// MUST import env FIRST
import './test-env';

// ============================================
// TEST-SPECIFIC IMPORTS (avoid React Native)
// ============================================
import { supabase } from './supabase-test-client';  // Test client without React Native
import { gridTestClient } from './grid-test-client';  // Test client without React Native
import { waitForOTP } from './mailosaur';
import { testStorage } from './test-storage';

// ============================================
// PRODUCTION CODE IMPORTS (will add as needed)
// ============================================
// NOTE: Using test-specific clients above to avoid React Native dependencies

// ============================================
// MINIMAL TEST ADAPTERS
// ============================================

/**
 * Authenticate test user with email/password
 * ONE LINE difference from production (email/password vs Google OAuth)
 */
export async function authenticateTestUser(): Promise<{
  userId: string;
  email: string;
  accessToken: string;
}> {
  const email = process.env.TEST_SUPABASE_EMAIL;
  const password = process.env.TEST_SUPABASE_PASSWORD;

  if (!email || !password) {
    throw new Error('TEST_SUPABASE_EMAIL or TEST_SUPABASE_PASSWORD not set');
  }

  console.log('🔐 Authenticating test user:', email);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }

  if (!data.user || !data.session) {
    throw new Error('No user or session returned from Supabase');
  }

  console.log('✅ Authenticated successfully');
  console.log('   User ID:', data.user.id);
  console.log('   Email:', data.user.email);

  return {
    userId: data.user.id,
    email: data.user.email!,
    accessToken: data.session.access_token,
  };
}

/**
 * Create test user account
 * Used by setup script only
 */
export async function createTestUser(): Promise<{
  userId: string;
  email: string;
}> {
  const email = process.env.TEST_SUPABASE_EMAIL;
  const password = process.env.TEST_SUPABASE_PASSWORD;

  if (!email || !password) {
    throw new Error('TEST_SUPABASE_EMAIL or TEST_SUPABASE_PASSWORD not set');
  }

  console.log('👤 Creating test user:', email);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: undefined, // No email confirmation needed for tests
    },
  });

  if (error) {
    // If user already exists, that's okay
    if (error.message.includes('already registered')) {
      console.log('ℹ️  User already exists, will use existing account');
      const signInResult = await authenticateTestUser();
      return {
        userId: signInResult.userId,
        email: signInResult.email,
      };
    }
    throw new Error(`User creation failed: ${error.message}`);
  }

  if (!data.user) {
    throw new Error('No user returned from Supabase');
  }

  console.log('✅ User created successfully');
  console.log('   User ID:', data.user.id);

  return {
    userId: data.user.id,
    email: data.user.email!,
  };
}

// ============================================
// GRID SESSION MANAGEMENT
// ============================================

export interface GridSession {
  address: string;
  authentication: any;
  sessionSecrets: any;
}

/**
 * Create Grid account (SETUP SCRIPT ONLY - run once)
 * Orchestrates production gridTestClient + Mailosaur for OTP
 */
export async function createAndCacheGridAccount(email: string): Promise<GridSession> {
  console.log('🏦 Creating Grid account (this should only run once)...');
  
  // Use test Grid client
  const { user, sessionSecrets } = await gridTestClient.createAccount(email);
  console.log('✅ Grid account creation initiated, OTP email sent');
  
  // Get OTP via Mailosaur (TEST-LAYER only)
  const serverId = process.env.MAILOSAUR_SERVER_ID;
  if (!serverId) {
    throw new Error('MAILOSAUR_SERVER_ID not set');
  }
  
  const otp = await waitForOTP(serverId, email);
  console.log('✅ OTP received:', otp);
  
  // Verify using test Grid client
  const result = await gridTestClient.verifyAccount(user, otp);
  
  if (!result.success || !result.data) {
    throw new Error('Grid account verification failed');
  }
  
  console.log('✅ Grid account verified');
  console.log('   Address:', result.data.address);
  
  // Cache for reuse
  const gridSession: GridSession = {
    address: result.data.address,
    authentication: result.data.authentication,
    sessionSecrets: sessionSecrets,
  };
  
  // Save to cache for easy access
  await testStorage.setItem('grid_session_cache', JSON.stringify(gridSession));
  
  return gridSession;
}

/**
 * Load Grid session (TESTS - every run)
 * Tests ONLY load cached session, never create new accounts
 */
export async function loadGridSession(): Promise<GridSession> {
  // Try our cache first
  const cached = await testStorage.getItem('grid_session_cache');
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Try grid storage
  const account = await gridTestClient.getAccount();
  if (account) {
    const sessionSecretsJson = await testStorage.getItem('grid_session_secrets');
    if (sessionSecretsJson) {
      const gridSession: GridSession = {
        address: account.address,
        authentication: account.authentication,
        sessionSecrets: JSON.parse(sessionSecretsJson),
      };
      // Cache it
      await testStorage.setItem('grid_session_cache', JSON.stringify(gridSession));
      return gridSession;
    }
  }
  
  throw new Error(
    'Grid session not found. Run setup script first: bun run test:setup'
  );
}

// ============================================
// DIRECT EXPORTS
// ============================================
export { gridTestClient };  // Grid client for tests


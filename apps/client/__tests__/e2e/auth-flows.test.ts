/**
 * E2E Tests - Complete Authentication Flows
 * 
 * Tests complete user authentication flows through the application
 * These tests simulate real user journeys
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setupTestUserSession, supabase, gridTestClient, cleanupTestData } from '../integration/setup';
import { signupNewUser, completeGridSignupProduction } from '../setup/test-helpers';
import { generateTestEmail, generateTestPassword } from '../utils/mailosaur-helpers';

describe('E2E Auth Flows', () => {
  describe('Existing User Login Flow', () => {
    let testSession: {
      userId: string;
      email: string;
      accessToken: string;
      gridSession: any;
    };

    beforeAll(async () => {
      console.log('🔧 Setting up test session for existing user flow...');
      testSession = await setupTestUserSession();
    });

    test('should complete full login flow for existing user', async () => {
      console.log('🚀 Testing existing user login flow\n');

      // Step 1: Verify we can authenticate
      const { data: session, error: authError } = await supabase.auth.getSession();
      
      expect(authError).toBe(null);
      expect(session.session).not.toBe(null);
      expect(session.session?.user.id).toBe(testSession.userId);
      console.log('✅ Step 1: Supabase session valid');

      // Step 2: Verify Grid account is loaded
      const gridAccount = await gridTestClient.getAccount();
      
      expect(gridAccount).not.toBe(null);
      expect(gridAccount?.address).toBe(testSession.gridSession.address);
      console.log('✅ Step 2: Grid account loaded');

      // Step 3: Verify user data in database
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', testSession.userId)
        .single();

      expect(userError).toBe(null);
      expect(userData).not.toBe(null);
      console.log('✅ Step 3: User data fetched from database');

      // Step 4: Verify Grid data in database
      const { data: gridData, error: gridError } = await supabase
        .from('users_grid')
        .select('*')
        .eq('id', testSession.userId)
        .single();

      expect(gridError).toBe(null);
      expect(gridData?.solana_wallet_address).toBe(testSession.gridSession.address);
      expect(gridData?.grid_account_status).toBe('active');
      console.log('✅ Step 4: Grid data synced in database');

      console.log('✅ Complete: Existing user login flow successful\n');
    });

    test('should maintain session across page refresh', async () => {
      console.log('🚀 Testing session persistence across refresh\n');

      // Simulate page refresh by getting session again
      const { data: session1 } = await supabase.auth.getSession();
      expect(session1.session).not.toBe(null);
      console.log('✅ Session 1 valid');

      await new Promise(resolve => setTimeout(resolve, 100));

      const { data: session2 } = await supabase.auth.getSession();
      expect(session2.session).not.toBe(null);
      expect(session2.session?.user.id).toBe(session1.session?.user.id);
      console.log('✅ Session 2 valid and matches');

      console.log('✅ Complete: Session persists across refresh\n');
    });

    test('should handle concurrent operations', async () => {
      console.log('🚀 Testing concurrent operations\n');

      // Simulate multiple operations happening simultaneously
      const [session, userData, gridData, gridAccount] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from('users').select('*').eq('id', testSession.userId).single(),
        supabase.from('users_grid').select('*').eq('id', testSession.userId).single(),
        gridTestClient.getAccount(),
      ]);

      expect(session.data.session).not.toBe(null);
      expect(userData.data).not.toBe(null);
      expect(gridData.data).not.toBe(null);
      expect(gridAccount).not.toBe(null);

      console.log('✅ All concurrent operations completed successfully\n');
    });
  });

  describe('New User Signup Flow (Production Path)', () => {
    test('should complete full signup flow via backend API', async () => {
      console.log('🚀 Testing new user signup flow (PRODUCTION PATH)\n');
      
      // Generate unique credentials
      const email = generateTestEmail();
      const password = generateTestPassword();
      
      console.log('Step 1: Creating Supabase account...');
      console.log('  Email:', email);

      // Step 1: Create Supabase account
      const supabaseResult = await signupNewUser(email, password);
      
      expect(supabaseResult.userId).toBeDefined();
      expect(supabaseResult.email).toBe(email);
      expect(supabaseResult.session).toBeDefined();
      console.log('✅ Supabase account created:', supabaseResult.userId);

      // Step 2: Create Grid wallet via production backend
      console.log('\nStep 2: Creating Grid wallet via backend API...');
      console.log('  (This may take 60-90 seconds - waiting for OTP email)');
      
      const gridSession = await completeGridSignupProduction(
        email,
        supabaseResult.session.access_token
      );

      expect(gridSession.address).toBeDefined();
      expect(gridSession.address.length).toBeGreaterThan(0);
      expect(gridSession.authentication).toBeDefined();
      console.log('✅ Grid wallet created:', gridSession.address);

      // Step 3: Verify data is in database
      console.log('\nStep 3: Verifying database sync...');
      
      const { data: gridData } = await supabase
        .from('users_grid')
        .select('*')
        .eq('id', supabaseResult.userId)
        .single();

      expect(gridData).not.toBe(null);
      expect(gridData?.solana_wallet_address).toBe(gridSession.address);
      console.log('✅ Grid data synced to database');

      console.log('\n✅ Complete: New user signup successful');
      console.log('   User ID:', supabaseResult.userId);
      console.log('   Grid Address:', gridSession.address);
      console.log('   Account left in place for potential manual testing\n');
    }, 120000); // 2 minute timeout for full flow
  });

  describe('Session Recovery Scenarios', () => {
    let testSession: {
      userId: string;
      email: string;
      accessToken: string;
      gridSession: any;
    };

    beforeAll(async () => {
      testSession = await setupTestUserSession();
    });

    test('should recover from app crash (cold start)', async () => {
      console.log('🚀 Testing recovery from app crash\n');

      // Simulate cold start by fetching everything fresh
      const [session, gridAccount, userData, gridData] = await Promise.all([
        supabase.auth.getSession(),
        gridTestClient.getAccount(),
        supabase.from('users').select('*').eq('id', testSession.userId).single(),
        supabase.from('users_grid').select('*').eq('id', testSession.userId).single(),
      ]);

      // All data should be recoverable
      expect(session.data.session).not.toBe(null);
      expect(gridAccount).not.toBe(null);
      expect(userData.data).not.toBe(null);
      expect(gridData.data).not.toBe(null);

      // Data should match expected values
      expect(session.data.session?.user.id).toBe(testSession.userId);
      expect(gridAccount?.address).toBe(testSession.gridSession.address);

      console.log('✅ All data recovered successfully after simulated crash\n');
    });

    test('should handle network interruption gracefully', async () => {
      console.log('🚀 Testing network interruption handling\n');

      // Get session before "interruption"
      const { data: before } = await supabase.auth.getSession();
      expect(before.session).not.toBe(null);

      // Simulate network interruption with brief delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get session after "reconnection"
      const { data: after } = await supabase.auth.getSession();
      expect(after.session).not.toBe(null);
      expect(after.session?.user.id).toBe(before.session?.user.id);

      console.log('✅ Session maintained through network interruption\n');
    });

    test('should handle multiple rapid session checks', async () => {
      console.log('🚀 Testing rapid session checks\n');

      // Simulate multiple components checking auth simultaneously
      const promises = Array(20).fill(null).map(() => 
        supabase.auth.getSession()
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(({ data, error }) => {
        expect(error).toBe(null);
        expect(data.session).not.toBe(null);
        expect(data.session?.user.id).toBe(testSession.userId);
      });

      console.log('✅ All rapid session checks passed\n');
    });
  });

  describe('Database Operations', () => {
    let testSession: {
      userId: string;
      email: string;
      accessToken: string;
      gridSession: any;
    };

    beforeAll(async () => {
      testSession = await setupTestUserSession();
    });

    test('should create and fetch conversations', async () => {
      console.log('🚀 Testing conversation CRUD operations\n');

      // Create conversation
      const { data: created, error: createError } = await supabase
        .from('conversations')
        .insert({
          user_id: testSession.userId,
          title: 'Test: E2E Auth Test Conversation',
        })
        .select()
        .single();

      expect(createError).toBe(null);
      expect(created).not.toBe(null);
      expect(created?.user_id).toBe(testSession.userId);
      console.log('✅ Conversation created:', created?.id);

      // Fetch conversations
      const { data: conversations, error: fetchError } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', testSession.userId);

      expect(fetchError).toBe(null);
      expect(Array.isArray(conversations)).toBe(true);
      expect(conversations?.length).toBeGreaterThan(0);
      console.log('✅ Conversations fetched:', conversations?.length);

      // Cleanup
      await supabase
        .from('conversations')
        .delete()
        .eq('id', created?.id);
      console.log('✅ Test conversation cleaned up\n');
    });

    test('should handle concurrent database operations', async () => {
      console.log('🚀 Testing concurrent database operations\n');

      const operations = [
        supabase.from('users').select('*').eq('id', testSession.userId).single(),
        supabase.from('users_grid').select('*').eq('id', testSession.userId).single(),
        supabase.from('conversations').select('*').eq('user_id', testSession.userId),
        supabase.from('users').select('id').eq('id', testSession.userId).single(),
      ];

      const results = await Promise.all(operations);

      results.forEach(({ error }) => {
        expect(error).toBe(null);
      });

      console.log('✅ All concurrent database operations succeeded\n');
    });
  });

  describe('Error Scenarios', () => {
    test('should handle invalid session gracefully', async () => {
      console.log('🚀 Testing invalid session handling\n');

      // Try to fetch with invalid user ID
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', 'invalid-user-id')
        .single();

      expect(data).toBe(null);
      expect(error).not.toBe(null);
      console.log('✅ Invalid session handled correctly\n');
    });

    test('should handle missing Grid account gracefully', async () => {
      console.log('🚀 Testing missing Grid account handling\n');

      // Try to fetch Grid data for non-existent user
      const { data, error } = await supabase
        .from('users_grid')
        .select('*')
        .eq('id', 'non-existent-user')
        .single();

      expect(data).toBe(null);
      expect(error).not.toBe(null);
      console.log('✅ Missing Grid account handled correctly\n');
    });
  });
});


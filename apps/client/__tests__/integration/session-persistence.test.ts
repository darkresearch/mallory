/**
 * Integration Tests - Session Persistence
 * 
 * Tests session restoration scenarios with real services
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import './setup';
import { setupTestUserSession, supabase, gridTestClient } from './setup';

describe('Session Persistence Integration Tests', () => {
  let testSession: {
    userId: string;
    email: string;
    accessToken: string;
    gridSession: any;
  };

  beforeAll(async () => {
    testSession = await setupTestUserSession();
  });

  afterAll(async () => {
    // Sign out from Supabase to stop auth refresh timers
    try {
      await Promise.race([
        (async () => {
          await supabase.auth.signOut();
          console.log('✅ Signed out from Supabase');
        })(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Cleanup timeout')), 30000)
        )
      ]);
    } catch (error) {
      console.warn('Error signing out:', error);
    }
  });

  describe('App Restart Simulation', () => {
    test('should restore both Supabase and Grid sessions after restart', async () => {
      // Simulate app restart by re-fetching everything
      const supabaseSession = await supabase.auth.getSession();
      const gridAccount = await gridTestClient.getAccount();

      expect(supabaseSession.data.session).not.toBe(null);
      expect(supabaseSession.data.session?.user.id).toBe(testSession.userId);
      expect(gridAccount).not.toBe(null);
      expect(gridAccount?.address).toBe(testSession.gridSession.address);
    }, 180000); // 3 min timeout for Grid operations

    test('should restore user data from database', async () => {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', testSession.userId)
        .single();

      expect(userData).not.toBe(null);
      expect(userData?.id).toBe(testSession.userId);
      // Note: email is in auth.users, not public.users
    });

    test('should restore Grid wallet from secure storage', async () => {
      // Note: Grid data now comes from secure storage, not database
      const account = await gridTestClient.getAccount();

      expect(account).not.toBe(null);
      expect(account?.address).toBe(testSession.gridSession.address);
    }, 180000); // 3 min timeout for Grid operations
  });

  describe('Page Refresh Simulation', () => {
    test('should handle page refresh while authenticated', async () => {
      // Simulate page refresh by clearing in-memory state but keeping storage
      
      // Step 1: Verify session exists
      const { data: beforeRefresh } = await supabase.auth.getSession();
      expect(beforeRefresh.session).not.toBe(null);

      // Step 2: Simulate "refresh" by getting session again
      const { data: afterRefresh } = await supabase.auth.getSession();
      expect(afterRefresh.session).not.toBe(null);
      expect(afterRefresh.session?.user.id).toBe(beforeRefresh.session?.user.id);

      // Step 3: Verify Grid account still accessible
      const gridAccount = await gridTestClient.getAccount();
      expect(gridAccount).not.toBe(null);
    });

    test('should maintain session across multiple refreshes', async () => {
      const sessions = [];

      // Simulate 5 page refreshes
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase.auth.getSession();
        sessions.push(data.session);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // All sessions should be valid and for the same user
      sessions.forEach(session => {
        expect(session).not.toBe(null);
        expect(session?.user.id).toBe(testSession.userId);
      });
    });
  });

  describe('Browser Tab Scenarios', () => {
    test('should handle multiple concurrent session checks', async () => {
      // Simulate multiple tabs checking session simultaneously
      const promises = Array(10).fill(null).map(() => 
        supabase.auth.getSession()
      );

      const results = await Promise.all(promises);

      results.forEach(({ data, error }) => {
        expect(error).toBe(null);
        expect(data.session).not.toBe(null);
        expect(data.session?.user.id).toBe(testSession.userId);
      });
    });

    test('should handle Grid account access from multiple sources', async () => {
      // Simulate multiple tabs accessing Grid account
      const promises = Array(5).fill(null).map(() => 
        gridTestClient.getAccount()
      );

      const accounts = await Promise.all(promises);

      accounts.forEach(account => {
        expect(account).not.toBe(null);
        expect(account?.address).toBe(testSession.gridSession.address);
      });
    }, 180000); // 3 min timeout for Grid operations
  });

  describe('Long-Running Session', () => {
    test('should maintain session validity over time', async () => {
      // Check session at different intervals
      const checks = [];

      for (let i = 0; i < 3; i++) {
        const { data } = await supabase.auth.getSession();
        checks.push({
          iteration: i,
          isValid: data.session !== null,
          userId: data.session?.user.id,
        });
        
        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        }
      }

      // All checks should be valid
      checks.forEach(check => {
        expect(check.isValid).toBe(true);
        expect(check.userId).toBe(testSession.userId);
      });
    });

    test('should keep Grid account accessible over time', async () => {
      const checks = [];

      for (let i = 0; i < 3; i++) {
        const account = await gridTestClient.getAccount();
        checks.push({
          iteration: i,
          hasAccount: account !== null,
          address: account?.address,
        });
        
        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      checks.forEach(check => {
        expect(check.hasAccount).toBe(true);
        expect(check.address).toBe(testSession.gridSession.address);
      });
    }, 180000); // 3 min timeout for Grid operations
  });

  describe('Offline/Online Transitions', () => {
    test('should restore session after brief offline period', async () => {
      // Get session while "online"
      const { data: beforeOffline } = await supabase.auth.getSession();
      expect(beforeOffline.session).not.toBe(null);

      // Simulate brief offline period (just wait)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get session after coming back "online"
      const { data: afterOnline } = await supabase.auth.getSession();
      expect(afterOnline.session).not.toBe(null);
      expect(afterOnline.session?.user.id).toBe(testSession.userId);
    });
  });

  describe('Cold Start Scenarios', () => {
    test('should handle cold start with existing session', async () => {
      // Simulate cold start by fetching everything from scratch
      const [supabaseResult, gridAccount, userData] = await Promise.all([
        supabase.auth.getSession(),
        gridTestClient.getAccount(),
        supabase.from('users').select('*').eq('id', testSession.userId).single(),
      ]);

      // All data should load successfully
      expect(supabaseResult.data.session).not.toBe(null);
      expect(gridAccount).not.toBe(null);
      expect(userData.data).not.toBe(null);

      // Data should match
      expect(supabaseResult.data.session?.user.id).toBe(testSession.userId);
      expect(gridAccount?.address).toBe(testSession.gridSession.address);
      expect(userData.data?.id).toBe(testSession.userId);
      // Note: users_grid no longer used - Grid data comes from secure storage
    }, 180000); // 3 min timeout for Grid operations
  });
});


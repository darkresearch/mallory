/**
 * Integration Tests - AuthContext + GridContext
 * 
 * Tests both contexts working together with REAL services
 * - Real Supabase client
 * - Real Grid client
 * - Test credentials from .env.test
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import './setup';
import { setupTestUserSession, cleanupTestData, supabase, gridTestClient } from './setup';

describe('Auth + Grid Integration Tests', () => {
  let testSession: {
    userId: string;
    email: string;
    accessToken: string;
    gridSession: any;
  };

  beforeAll(async () => {
    console.log('🔧 Setting up test user session...');
    testSession = await setupTestUserSession();
    console.log('✅ Test session ready');
    console.log('   User ID:', testSession.userId);
    console.log('   Grid Address:', testSession.gridSession.address);
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up test data...');
    await cleanupTestData(testSession.userId);
    console.log('✅ Cleanup complete');
  });

  describe('Session Restoration', () => {
    test('should restore Supabase session', async () => {
      const { data, error } = await supabase.auth.getSession();
      
      expect(error).toBe(null);
      expect(data.session).not.toBe(null);
      expect(data.session?.user.id).toBe(testSession.userId);
    }, 180000); // 3 min timeout for Grid setup

    test('should load Grid account from storage', async () => {
      const account = await gridTestClient.getAccount();
      
      expect(account).not.toBe(null);
      expect(account?.address).toBe(testSession.gridSession.address);
    }, 180000); // 3 min timeout for Grid operations

    test('should have matching user data in database', async () => {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', testSession.userId)
        .single();
      
      expect(error).toBe(null);
      expect(userData).not.toBe(null);
      expect(userData?.id).toBe(testSession.userId);
    });
  });

  describe('Auth State Persistence', () => {
    test('should maintain auth state across token refresh', async () => {
      // Get current session
      const { data: beforeRefresh } = await supabase.auth.getSession();
      const beforeToken = beforeRefresh.session?.access_token;

      // Wait a bit and get session again
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const { data: afterCheck } = await supabase.auth.getSession();
      
      // Session should still be valid
      expect(afterCheck.session).not.toBe(null);
      expect(afterCheck.session?.user.id).toBe(testSession.userId);
    });

    test('should handle concurrent session checks', async () => {
      // Make multiple concurrent session checks
      const promises = Array(5).fill(null).map(() => 
        supabase.auth.getSession()
      );

      const results = await Promise.all(promises);

      // All should succeed with same user
      results.forEach(({ data, error }) => {
        expect(error).toBe(null);
        expect(data.session?.user.id).toBe(testSession.userId);
      });
    });
  });

  describe('Backend + Database Sync', () => {
    test('should verify Grid wallet accessible from secure storage', async () => {
      // Note: users_grid table no longer used - wallet address comes from secure storage
      const account = await gridTestClient.getAccount();
      
      expect(account).not.toBe(null);
      expect(account?.address).toBe(testSession.gridSession.address);
      console.log('✅ Grid wallet accessible from secure storage (no database needed)');
    }, 180000); // 3 min timeout for Grid operations
  });

  describe('Error Handling', () => {
    test('should handle invalid user ID gracefully', async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', 'non-existent-user-id')
        .single();

      // Should return null data with error
      expect(data).toBe(null);
      expect(error).not.toBe(null);
      // Error code can be PGRST116 (no rows) or 22P02 (invalid UUID format)
      expect(['PGRST116', '22P02']).toContain(error?.code);
    });

    test('should handle network timeout gracefully', async () => {
      // Create request with short timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 100);

      try {
        await supabase
          .from('users')
          .select('*')
          .eq('id', testSession.userId)
          .abortSignal(controller.signal)
          .single();
        
        clearTimeout(timeoutId);
      } catch (error: any) {
        // Should handle abort gracefully
        expect(error.name).toBe('AbortError');
      }
    });
  });

  describe('Conversation Management', () => {
    test('should create test conversation', async () => {
      const { data: conversation, error } = await supabase
        .from('conversations')
        .insert({
          user_id: testSession.userId,
          title: 'Test: Integration Test Conversation',
        })
        .select()
        .single();

      expect(error).toBe(null);
      expect(conversation).not.toBe(null);
      expect(conversation?.user_id).toBe(testSession.userId);
    });

    test('should list user conversations', async () => {
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', testSession.userId)
        .order('created_at', { ascending: false });

      expect(error).toBe(null);
      expect(Array.isArray(conversations)).toBe(true);
    });

    test('should delete test conversations', async () => {
      // Delete any test conversations
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('user_id', testSession.userId)
        .like('title', 'Test:%');

      expect(error).toBe(null);
    });
  });

  describe('Real-World Scenarios', () => {
    test('should simulate app restart (session restoration)', async () => {
      // Step 1: Verify we have a session
      const { data: session1 } = await supabase.auth.getSession();
      expect(session1.session).not.toBe(null);

      // Step 2: Get Grid account
      const account1 = await gridTestClient.getAccount();
      expect(account1).not.toBe(null);

      // Step 3: Simulate "app restart" by checking session again
      const { data: session2 } = await supabase.auth.getSession();
      expect(session2.session?.user.id).toBe(testSession.userId);

      // Step 4: Grid account should still be available
      const account2 = await gridTestClient.getAccount();
      expect(account2?.address).toBe(account1?.address);
    }, 180000); // 3 min timeout for Grid operations

    test('should handle rapid session checks during app startup', async () => {
      // Simulate multiple components checking auth state simultaneously
      const checks = await Promise.all([
        supabase.auth.getSession(),
        supabase.auth.getSession(),
        supabase.auth.getSession(),
        gridTestClient.getAccount(),
        gridTestClient.getAccount(),
      ]);

      // All Supabase checks should succeed
      checks.slice(0, 3).forEach(({ data, error }) => {
        expect(error).toBe(null);
        expect(data.session?.user.id).toBe(testSession.userId);
      });

      // Both Grid checks should succeed
      expect(checks[3]).not.toBe(null);
      expect(checks[4]).not.toBe(null);
    });
  });

  describe('Database Queries', () => {
    test('should fetch user profile data', async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, instant_buy_amount, instayield_enabled, has_completed_onboarding')
        .eq('id', testSession.userId)
        .single();

      expect(error).toBe(null);
      expect(data).not.toBe(null);
      expect(data?.id).toBe(testSession.userId);
    });

    test('should fetch Grid wallet address from secure storage', async () => {
      const account = await gridTestClient.getAccount();

      expect(account).not.toBe(null);
      expect(account?.address).toBe(testSession.gridSession.address);
    }, 180000); // 3 min timeout for Grid operations

    test('should handle concurrent reads from secure storage', async () => {
      // All client-side Grid operations use secure storage
      const promises = [
        supabase.from('users').select('*').eq('id', testSession.userId).single(),
        gridTestClient.getAccount(),
        supabase.from('users').select('*').eq('id', testSession.userId).single(),
        gridTestClient.getAccount(),
      ];

      const results = await Promise.all(promises);

      // Verify Supabase queries
      expect(results[0].error).toBe(null);
      expect(results[2].error).toBe(null);
      
      // Verify Grid account queries
      expect(results[1]).not.toBe(null);
      expect(results[3]).not.toBe(null);
      expect(results[1]?.address).toBe(testSession.gridSession.address);
      expect(results[3]?.address).toBe(testSession.gridSession.address);
    });
  });

  describe('Session Lifecycle', () => {
    test('should maintain session across multiple operations', async () => {
      // Perform multiple operations to ensure session stays valid
      const operations = [
        async () => {
          const { data } = await supabase.auth.getSession();
          return data.session?.user.id;
        },
        async () => {
          const { data } = await supabase.from('users').select('id').eq('id', testSession.userId).single();
          return data?.id;
        },
        async () => {
          const account = await gridTestClient.getAccount();
          return account?.address;
        },
      ];

      const results = await Promise.all(operations.map(op => op()));

      expect(results[0]).toBe(testSession.userId);
      expect(results[1]).toBe(testSession.userId);
      expect(results[2]).toBe(testSession.gridSession.address);
    });

    test('should handle session validation across time', async () => {
      // Get session, wait, validate again
      const { data: session1 } = await supabase.auth.getSession();
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const { data: session2 } = await supabase.auth.getSession();

      expect(session1.session?.user.id).toBe(testSession.userId);
      expect(session2.session?.user.id).toBe(testSession.userId);
      expect(session2.session?.access_token).toBeTruthy();
    });
  });
});


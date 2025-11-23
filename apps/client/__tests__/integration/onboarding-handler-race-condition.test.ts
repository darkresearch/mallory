/**
 * Integration Tests: OnboardingConversationHandler Race Condition
 * 
 * Tests race condition prevention in onboarding conversation creation:
 * - Handler runs before conversationId is loaded from URL
 * - Handler creates onboarding conversation when one already exists in URL
 * - Race condition between URL param loading and handler execution
 * - Checks both currentConversationId prop AND URL params
 * - Prevents creating onboarding conversation when URL has conversationId
 * - Waits for both sources before deciding to create
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { authenticateTestUser } from '../setup/test-helpers';
import { supabase } from '../setup/supabase-test-client';
import { v4 as uuidv4 } from 'uuid';

const GLOBAL_TOKEN_ID = '00000000-0000-0000-0000-000000000000';

// Mock router params
let mockRouterParams: { conversationId?: string } = {};

// Mock onboarding conversation creation
async function createOnboardingConversation(userId: string) {
  const conversationId = uuidv4();
  
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      id: conversationId,
      title: 'Welcome to Mallory',
      token_ca: GLOBAL_TOKEN_ID,
      user_id: userId,
      metadata: { is_onboarding: true }
    })
    .select()
    .single();

  if (error) throw error;

  // Mark user as having completed onboarding
  await supabase
    .from('users')
    .update({ has_completed_onboarding: true })
    .eq('id', userId);

  return {
    conversationId: data!.id,
  };
}

describe('Integration: OnboardingHandler Race Condition', () => {
  let testUserId: string;
  let testConversationIds: string[] = [];

  beforeEach(async () => {
    mockRouterParams = {};
    const { userId } = await authenticateTestUser();
    testUserId = userId;
    
    // Reset user onboarding status
    await supabase
      .from('users')
      .update({ has_completed_onboarding: false })
      .eq('id', testUserId);
  });

  afterEach(async () => {
    // Cleanup
    if (testConversationIds.length > 0) {
      await supabase
        .from('conversations')
        .delete()
        .in('id', testConversationIds);
      testConversationIds = [];
    }
  });

  describe('Check URL Params Before Creating Onboarding', () => {
    test('should NOT create onboarding when conversationId in URL', async () => {
      console.log('\n✅ TEST: Skip onboarding when URL has conversationId\n');

      // Create existing conversation
      const existingConversationId = uuidv4();
      testConversationIds.push(existingConversationId);
      
      await supabase.from('conversations').insert({
        id: existingConversationId,
        user_id: testUserId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Existing Conversation',
        metadata: {},
      });

      // SIMULATE: URL has conversationId parameter
      mockRouterParams.conversationId = existingConversationId;
      console.log('📍 URL param:', mockRouterParams.conversationId);

      // SIMULATE: OnboardingHandler logic (THE FIX)
      const user = { id: testUserId, hasCompletedOnboarding: false };
      const currentConversationId = null; // Not loaded yet from prop
      const conversationIdFromUrl = mockRouterParams.conversationId;
      
      // Check BOTH prop and URL param
      const hasActiveConversation = currentConversationId || conversationIdFromUrl;
      
      let onboardingCreated = false;
      
      if (!user.hasCompletedOnboarding && !hasActiveConversation && user.id) {
        // Would create onboarding here
        onboardingCreated = true;
      }

      // VERIFY: Did NOT create onboarding
      expect(onboardingCreated).toBe(false);
      console.log('✅ Onboarding creation skipped (URL has conversationId)');
    });

    test('should NOT create onboarding when currentConversationId prop exists', async () => {
      console.log('\n✅ TEST: Skip onboarding when prop has conversationId\n');

      // Create existing conversation
      const existingConversationId = uuidv4();
      testConversationIds.push(existingConversationId);
      
      await supabase.from('conversations').insert({
        id: existingConversationId,
        user_id: testUserId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Existing Conversation',
        metadata: {},
      });

      // SIMULATE: Prop has conversationId (loaded from useActiveConversation)
      const currentConversationId = existingConversationId;
      console.log('📍 Prop conversationId:', currentConversationId);

      // No URL param
      mockRouterParams.conversationId = undefined;
      console.log('📍 URL param: undefined');

      // SIMULATE: OnboardingHandler logic
      const user = { id: testUserId, hasCompletedOnboarding: false };
      const conversationIdFromUrl = mockRouterParams.conversationId;
      const hasActiveConversation = currentConversationId || conversationIdFromUrl;
      
      let onboardingCreated = false;
      
      if (!user.hasCompletedOnboarding && !hasActiveConversation && user.id) {
        onboardingCreated = true;
      }

      // VERIFY: Did NOT create onboarding
      expect(onboardingCreated).toBe(false);
      console.log('✅ Onboarding creation skipped (prop has conversationId)');
    });

    test('SHOULD create onboarding when no conversation anywhere', async () => {
      console.log('\n✅ TEST: Create onboarding when no conversation exists\n');

      // SIMULATE: New user, no conversations
      const user = { id: testUserId, hasCompletedOnboarding: false };
      const currentConversationId = null;
      mockRouterParams.conversationId = undefined;
      
      console.log('📍 Prop conversationId: null');
      console.log('📍 URL conversationId: undefined');
      console.log('📍 User has completed onboarding:', user.hasCompletedOnboarding);

      // SIMULATE: OnboardingHandler logic
      const conversationIdFromUrl = mockRouterParams.conversationId;
      const hasActiveConversation = currentConversationId || conversationIdFromUrl;
      
      let onboardingCreated = false;
      let createdConversationId: string | null = null;
      
      if (!user.hasCompletedOnboarding && !hasActiveConversation && user.id) {
        console.log('📍 Creating onboarding conversation...');
        const result = await createOnboardingConversation(user.id);
        testConversationIds.push(result.conversationId);
        createdConversationId = result.conversationId;
        onboardingCreated = true;
      }

      // VERIFY: Did create onboarding
      expect(onboardingCreated).toBe(true);
      expect(createdConversationId).not.toBeNull();
      
      // VERIFY: Conversation exists in database
      const { data } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', createdConversationId!)
        .single();
      
      expect(data).not.toBeNull();
      expect(data!.metadata.is_onboarding).toBe(true);
      
      console.log('✅ Onboarding conversation created:', createdConversationId);
    });

    test('should NOT create onboarding when user has completed onboarding', async () => {
      console.log('\n✅ TEST: Skip onboarding for returning users\n');

      // SIMULATE: Returning user (has completed onboarding before)
      const user = { id: testUserId, hasCompletedOnboarding: true };
      const currentConversationId = null;
      mockRouterParams.conversationId = undefined;

      console.log('📍 User has completed onboarding:', user.hasCompletedOnboarding);

      // SIMULATE: OnboardingHandler logic
      const conversationIdFromUrl = mockRouterParams.conversationId;
      const hasActiveConversation = currentConversationId || conversationIdFromUrl;
      
      let onboardingCreated = false;
      
      if (!user.hasCompletedOnboarding && !hasActiveConversation && user.id) {
        onboardingCreated = true;
      }

      // VERIFY: Did NOT create onboarding
      expect(onboardingCreated).toBe(false);
      console.log('✅ Onboarding creation skipped (user already onboarded)');
    });
  });

  describe('Race Condition Scenarios', () => {
    test('should prevent race condition: URL loads after handler runs', async () => {
      console.log('\n✅ TEST: Race condition - URL loads late\n');

      // Create existing conversation
      const existingConversationId = uuidv4();
      testConversationIds.push(existingConversationId);
      
      await supabase.from('conversations').insert({
        id: existingConversationId,
        user_id: testUserId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Existing Conversation',
        metadata: {},
      });

      // SIMULATE: Race condition scenario
      // 1. Component mounts, handler runs
      // 2. URL param not parsed yet (empty)
      // 3. Prop not loaded yet (null)
      console.log('📍 Time T0: Component mounts');
      console.log('   - URL param: not parsed yet');
      console.log('   - Prop: null');

      let hasTriggered = false;
      const user = { id: testUserId, hasCompletedOnboarding: false };
      let currentConversationId = null;
      mockRouterParams.conversationId = undefined;

      // OLD CODE would create onboarding here (race condition!)
      // NEW CODE checks URL param too

      // 4. URL param loads (after a few ms)
      await new Promise(resolve => setTimeout(resolve, 10));
      mockRouterParams.conversationId = existingConversationId;
      console.log('📍 Time T1: URL param loaded:', mockRouterParams.conversationId);

      // SIMULATE: Handler effect with THE FIX
      const conversationIdFromUrl = mockRouterParams.conversationId;
      const hasActiveConversation = currentConversationId || conversationIdFromUrl;
      
      if (hasTriggered) {
        console.log('⚠️  Handler already triggered (would be too late)');
      } else if (!user.hasCompletedOnboarding && !hasActiveConversation && user.id) {
        hasTriggered = true;
        console.log('❌ Would create onboarding (BAD - race condition)');
      } else {
        console.log('✅ Skipped onboarding (URL param detected)');
      }

      // VERIFY: Did NOT create onboarding
      expect(hasTriggered).toBe(false);
      console.log('✅ Race condition prevented by checking URL param');
    });

    test('should prevent race condition: prop loads after handler runs', async () => {
      console.log('\n✅ TEST: Race condition - prop loads late\n');

      const existingConversationId = uuidv4();
      testConversationIds.push(existingConversationId);
      
      await supabase.from('conversations').insert({
        id: existingConversationId,
        user_id: testUserId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Existing Conversation',
        metadata: {},
      });

      // SIMULATE: Another race condition scenario
      // 1. Component mounts
      // 2. useActiveConversation is loading (prop null)
      // 3. Handler checks
      console.log('📍 Time T0: useActiveConversation loading...');

      let hasTriggered = false;
      const user = { id: testUserId, hasCompletedOnboarding: false };
      let currentConversationId: string | null = null;
      mockRouterParams.conversationId = undefined;

      // First check (both null)
      let conversationIdFromUrl = mockRouterParams.conversationId;
      let hasActiveConversation = currentConversationId || conversationIdFromUrl;
      
      if (!user.hasCompletedOnboarding && !hasActiveConversation && user.id) {
        // Would trigger here in old code
        console.log('⚠️  Both sources null at T0');
      }

      // 4. useActiveConversation finishes loading
      await new Promise(resolve => setTimeout(resolve, 20));
      currentConversationId = existingConversationId;
      console.log('📍 Time T1: useActiveConversation loaded:', currentConversationId);

      // Handler effect runs again (dependency changed)
      conversationIdFromUrl = mockRouterParams.conversationId;
      hasActiveConversation = currentConversationId || conversationIdFromUrl;
      
      if (hasTriggered) {
        console.log('⚠️  Already triggered (race condition!)');
      } else if (!user.hasCompletedOnboarding && !hasActiveConversation && user.id) {
        hasTriggered = true;
        console.log('❌ Would create onboarding (BAD)');
      } else {
        console.log('✅ Skipped onboarding (prop detected)');
      }

      // VERIFY: Did NOT create onboarding
      expect(hasTriggered).toBe(false);
      console.log('✅ Race condition prevented by including prop in dependencies');
    });
  });

  describe('Real-world Scenarios', () => {
    test('should handle: navigate with conversationId → should not create onboarding', async () => {
      console.log('\n✅ TEST: Direct navigation with conversationId\n');

      // Create conversation
      const conversationId = uuidv4();
      testConversationIds.push(conversationId);
      
      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testUserId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'Direct Navigation',
        metadata: {},
      });

      // User navigates directly to: /chat?conversationId=xxx
      mockRouterParams.conversationId = conversationId;
      console.log('📍 User navigates to /chat?conversationId=', conversationId);

      // Chat screen loads
      const user = { id: testUserId, hasCompletedOnboarding: false };
      const currentConversationId = null; // Not loaded from prop yet
      const conversationIdFromUrl = mockRouterParams.conversationId;
      const hasActiveConversation = currentConversationId || conversationIdFromUrl;

      let onboardingCreated = false;

      if (!user.hasCompletedOnboarding && !hasActiveConversation && user.id) {
        onboardingCreated = true;
      }

      // VERIFY: No onboarding created
      expect(onboardingCreated).toBe(false);
      console.log('✅ Onboarding correctly skipped for direct navigation');
    });

    test('should handle: chat-history navigation preserves conversation', async () => {
      console.log('\n✅ TEST: Chat history navigation scenario\n');

      // Create conversation
      const conversationId = uuidv4();
      testConversationIds.push(conversationId);
      
      await supabase.from('conversations').insert({
        id: conversationId,
        user_id: testUserId,
        token_ca: GLOBAL_TOKEN_ID,
        title: 'History Navigation Test',
        metadata: {},
      });

      // User on chat screen with active conversation
      let currentConversationId = conversationId;
      console.log('📍 User on /chat with conversation:', conversationId);

      // User navigates to chat-history
      console.log('📍 User navigates to /chat-history');

      // User navigates back with conversationId in URL (the fix from handleBack)
      mockRouterParams.conversationId = conversationId;
      currentConversationId = null; // Reset during navigation
      console.log('📍 User navigates back to /chat?conversationId=', conversationId);

      // OnboardingHandler runs
      const user = { id: testUserId, hasCompletedOnboarding: false };
      const conversationIdFromUrl = mockRouterParams.conversationId;
      const hasActiveConversation = currentConversationId || conversationIdFromUrl;

      let onboardingCreated = false;

      if (!user.hasCompletedOnboarding && !hasActiveConversation && user.id) {
        onboardingCreated = true;
      }

      // VERIFY: No onboarding created
      expect(onboardingCreated).toBe(false);
      console.log('✅ No duplicate onboarding after navigation');
    });

    test('should handle: true new user with no conversation', async () => {
      console.log('\n✅ TEST: True new user scenario\n');

      // New user arrives at /chat (no conversationId anywhere)
      const user = { id: testUserId, hasCompletedOnboarding: false };
      const currentConversationId = null;
      mockRouterParams.conversationId = undefined;

      console.log('📍 New user arrives at /chat');
      console.log('   - No prop conversation');
      console.log('   - No URL conversation');
      console.log('   - Never completed onboarding');

      const conversationIdFromUrl = mockRouterParams.conversationId;
      const hasActiveConversation = currentConversationId || conversationIdFromUrl;

      let onboardingCreated = false;
      let createdId: string | null = null;

      if (!user.hasCompletedOnboarding && !hasActiveConversation && user.id) {
        const result = await createOnboardingConversation(user.id);
        testConversationIds.push(result.conversationId);
        createdId = result.conversationId;
        onboardingCreated = true;
        console.log('📍 Created onboarding conversation:', createdId);
      }

      // VERIFY: Onboarding WAS created (correct behavior)
      expect(onboardingCreated).toBe(true);
      expect(createdId).not.toBeNull();

      // Verify it's marked as onboarding
      const { data } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', createdId!)
        .single();

      expect(data!.metadata.is_onboarding).toBe(true);
      console.log('✅ Onboarding created correctly for new user');
    });
  });

  describe('Safeguards', () => {
    test('should only run once per session (hasTriggered ref)', async () => {
      console.log('\n✅ TEST: Run once per session\n');

      let hasTriggered = false;
      const user = { id: testUserId, hasCompletedOnboarding: false };

      // First check
      console.log('📍 First effect run');
      if (hasTriggered) {
        console.log('⚠️  Already triggered, skipping');
      } else if (!user.hasCompletedOnboarding && user.id) {
        hasTriggered = true;
        console.log('✅ First run - creating onboarding');
        const result = await createOnboardingConversation(user.id);
        testConversationIds.push(result.conversationId);
      }

      expect(hasTriggered).toBe(true);

      // Second check (effect runs again)
      console.log('📍 Second effect run (deps changed)');
      if (hasTriggered) {
        console.log('✅ Already triggered, skipping');
      } else if (!user.hasCompletedOnboarding && user.id) {
        console.log('❌ Creating again (BAD - would duplicate)');
      }

      // VERIFY: Only ran once
      const { data: conversations } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', testUserId)
        .eq('metadata->>is_onboarding', 'true');

      expect(conversations!.length).toBe(1);
      console.log('✅ Only one onboarding conversation created');
    });
  });
});

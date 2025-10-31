/**
 * E2E Tests: Chat History User Journeys
 * 
 * Tests complete user flows for chat history:
 * - Opening chat history page
 * - Viewing conversation list
 * - Searching conversations
 * - Opening conversations
 * - Real-time updates
 * - Creating new chats
 * 
 * REQUIREMENTS:
 * - Backend server running
 * - Test user with Grid wallet
 */

import { describe, test, expect } from 'bun:test';
import { authenticateTestUser, loadGridSession } from '../setup/test-helpers';
import { supabase } from '../setup/supabase-test-client';
import { secureStorage, SECURE_STORAGE_KEYS } from '../../lib/storage';
import { createNewConversation } from '../../features/chat';

const BACKEND_URL = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
const GLOBAL_TOKEN_ID = '00000000-0000-0000-0000-000000000000';

describe('Chat History E2E Tests', () => {
  describe('JOURNEY: User opens chat history → views conversations → opens conversation', () => {
    test('should display conversation list with messages', async () => {
      console.log('\n📋 E2E: Chat History Display Test\n');

      const { userId, accessToken } = await authenticateTestUser();

      // Create multiple conversations with messages
      const conversations = [];
      for (let i = 0; i < 3; i++) {
        const { data: conv } = await supabase
          .from('conversations')
          .insert({
            user_id: userId,
            token_ca: GLOBAL_TOKEN_ID,
            title: `E2E: Conversation ${i + 1}`,
          })
          .select()
          .single();

        // Add messages to each conversation
        await supabase.from('messages').insert([
          {
            conversation_id: conv!.id,
            role: 'user',
            content: `Question ${i + 1}`,
            metadata: { parts: [{ type: 'text', text: `Question ${i + 1}` }] },
            created_at: new Date(2024, 0, 1, i).toISOString(),
          },
          {
            conversation_id: conv!.id,
            role: 'assistant',
            content: `Answer ${i + 1}`,
            metadata: { parts: [{ type: 'text', text: `Answer ${i + 1}` }] },
            created_at: new Date(2024, 0, 1, i, 1).toISOString(),
          },
        ]);

        conversations.push(conv!);
      }

      console.log('✅ Created 3 test conversations with messages');

      // Simulate loading conversations (what chat-history page does)
      const { data: loadedConversations, error } = await supabase
        .from('conversations')
        .select('id, title, token_ca, created_at, updated_at, metadata')
        .eq('user_id', userId)
        .eq('token_ca', GLOBAL_TOKEN_ID)
        .order('updated_at', { ascending: false });

      expect(error).toBe(null);
      expect(loadedConversations).not.toBe(null);
      expect(loadedConversations!.length >= 3).toBe(true);

      console.log('✅ Loaded conversations:', loadedConversations!.length);

      // Load messages for each conversation
      const conversationIds = loadedConversations!.map(c => c.id);
      const { data: allMessages } = await supabase
        .from('messages')
        .select('id, conversation_id, content, role, created_at, metadata')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false });

      expect(allMessages).not.toBe(null);
      expect(allMessages!.length >= 6).toBe(true); // 3 conversations * 2 messages each

      console.log('✅ Loaded messages:', allMessages!.length);

      // Verify each conversation has messages
      for (const conv of conversations) {
        const convMessages = allMessages!.filter(m => m.conversation_id === conv.id);
        expect(convMessages.length).toBeGreaterThan(0);
      }

      console.log('✅ All conversations have messages');

      // Cleanup
      for (const conv of conversations) {
        await supabase.from('messages').delete().eq('conversation_id', conv.id);
        await supabase.from('conversations').delete().eq('id', conv.id);
      }

      console.log('✅ E2E test complete\n');
    }, 60000);

    test('JOURNEY: User searches conversations → finds matching results', async () => {
      console.log('\n📋 E2E: Chat History Search Test\n');

      const { userId } = await authenticateTestUser();

      // Create conversations with different content
      const conversations = [];
      const messages = [
        { content: 'What is TypeScript?', searchTerm: 'TypeScript' },
        { content: 'How do I use React hooks?', searchTerm: 'React' },
        { content: 'Explain quantum computing', searchTerm: 'quantum' },
      ];

      for (let i = 0; i < messages.length; i++) {
        const { data: conv } = await supabase
          .from('conversations')
          .insert({
            user_id: userId,
            token_ca: GLOBAL_TOKEN_ID,
            title: `E2E: Search Test ${i + 1}`,
          })
          .select()
          .single();

        await supabase.from('messages').insert({
          conversation_id: conv!.id,
          role: 'user',
          content: messages[i].content,
          metadata: { parts: [{ type: 'text', text: messages[i].content }] },
          created_at: new Date().toISOString(),
        });

        conversations.push(conv!);
      }

      console.log('✅ Created conversations with searchable content');

      // Simulate search functionality (what chat-history page does)
      const searchQuery = 'TypeScript';
      const lowerQuery = searchQuery.toLowerCase();

      // Load all conversations and messages
      const conversationIds = conversations.map(c => c.id);
      const { data: allMessages } = await supabase
        .from('messages')
        .select('id, conversation_id, content, role, created_at')
        .in('conversation_id', conversationIds);

      // Filter conversations that have matching messages
      const matchingConversations = conversations.filter(conv => {
        const convMessages = allMessages!.filter(m => m.conversation_id === conv.id);
        return convMessages.some(msg => msg.content.toLowerCase().includes(lowerQuery));
      });

      expect(matchingConversations.length).toBe(1);
      expect(matchingConversations[0].id).toBe(conversations[0].id);

      console.log('✅ Search found matching conversation');

      // Cleanup
      for (const conv of conversations) {
        await supabase.from('messages').delete().eq('conversation_id', conv.id);
        await supabase.from('conversations').delete().eq('id', conv.id);
      }

      console.log('✅ E2E search test complete\n');
    }, 60000);

    test('JOURNEY: User opens conversation from history → messages load correctly', async () => {
      console.log('\n📋 E2E: Open Conversation from History Test\n');

      const { userId, accessToken } = await authenticateTestUser();
      const gridSession = await loadGridSession();

      // Create conversation with message history
      const { data: conversation } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: 'E2E: History Load Test',
        })
        .select()
        .single();

      // Add multiple messages
      const messageHistory = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'First response' },
        { role: 'user', content: 'Second message' },
        { role: 'assistant', content: 'Second response' },
      ];

      for (let i = 0; i < messageHistory.length; i++) {
        await supabase.from('messages').insert({
          conversation_id: conversation!.id,
          role: messageHistory[i].role,
          content: messageHistory[i].content,
          metadata: {
            parts: [{ type: 'text', text: messageHistory[i].content }],
          },
          created_at: new Date(2024, 0, 1, 0, i).toISOString(),
        });
      }

      console.log('✅ Created conversation with message history');

      // Simulate user opening conversation (what chat screen does)
      // 1. Store as active conversation
      await secureStorage.setItem(
        SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID,
        conversation!.id
      );

      console.log('✅ Set as active conversation');

      // 2. Load messages for conversation
      const { data: loadedMessages, error } = await supabase
        .from('messages')
        .select('id, role, content, metadata, created_at')
        .eq('conversation_id', conversation!.id)
        .order('created_at', { ascending: true });

      expect(error).toBe(null);
      expect(loadedMessages).not.toBe(null);
      expect(loadedMessages!.length).toBe(4);

      // Verify message order
      expect(loadedMessages![0].role).toBe('user');
      expect((loadedMessages![0] as any).content).toBe('First message');
      expect(loadedMessages![1].role).toBe('assistant');
      expect((loadedMessages![1] as any).content).toBe('First response');
      expect(loadedMessages![2].role).toBe('user');
      expect((loadedMessages![2] as any).content).toBe('Second message');
      expect(loadedMessages![3].role).toBe('assistant');
      expect((loadedMessages![3] as any).content).toBe('Second response');

      console.log('✅ Messages loaded in correct order');

      // Cleanup
      await supabase.from('messages').delete().eq('conversation_id', conversation!.id);
      await supabase.from('conversations').delete().eq('id', conversation!.id);
      await secureStorage.removeItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);

      console.log('✅ E2E conversation load test complete\n');
    }, 60000);

    test('JOURNEY: User creates new chat → appears in history → can open it', async () => {
      console.log('\n📋 E2E: New Chat Creation Test\n');

      const { userId } = await authenticateTestUser();

      // Create new conversation
      const conversationData = await createNewConversation(userId);

      console.log('✅ Created new conversation:', conversationData.conversationId);

      // Verify it appears in conversation list
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, title, updated_at')
        .eq('user_id', userId)
        .eq('token_ca', GLOBAL_TOKEN_ID)
        .order('updated_at', { ascending: false })
        .limit(1);

      expect(conversations).not.toBe(null);
      expect(conversations!.length).toBeGreaterThan(0);
      expect(conversations![0].id).toBe(conversationData.conversationId);

      console.log('✅ Conversation appears in history');

      // Verify active conversation is stored
      const storedId = await secureStorage.getItem(
        SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID
      );
      expect(storedId).toBe(conversationData.conversationId);

      console.log('✅ Active conversation stored correctly');

      // Cleanup
      await supabase.from('conversations').delete().eq('id', conversationData.conversationId);
      await secureStorage.removeItem(SECURE_STORAGE_KEYS.CURRENT_CONVERSATION_ID);

      console.log('✅ E2E new chat test complete\n');
    }, 60000);

    test('JOURNEY: User has many conversations → history loads efficiently', async () => {
      console.log('\n📋 E2E: Large Conversation History Test\n');

      const { userId } = await authenticateTestUser();

      // Create 20 conversations
      const conversations = [];
      for (let i = 0; i < 20; i++) {
        const { data: conv } = await supabase
          .from('conversations')
          .insert({
            user_id: userId,
            token_ca: GLOBAL_TOKEN_ID,
            title: `E2E: Bulk Test ${i + 1}`,
            created_at: new Date(2024, 0, 1, i).toISOString(),
            updated_at: new Date(2024, 0, 1, i).toISOString(),
          })
          .select()
          .single();
        conversations.push(conv!);
      }

      console.log('✅ Created 20 conversations');

      // Load all conversations (simulating chat-history page load)
      const startTime = Date.now();
      const { data: loadedConversations, error } = await supabase
        .from('conversations')
        .select('id, title, token_ca, created_at, updated_at, metadata')
        .eq('user_id', userId)
        .eq('token_ca', GLOBAL_TOKEN_ID)
        .order('updated_at', { ascending: false });

      const loadTime = Date.now() - startTime;

      expect(error).toBe(null);
      expect(loadedConversations).not.toBe(null);
      expect(loadedConversations!.length >= 20).toBe(true);

      console.log(`✅ Loaded ${loadedConversations!.length} conversations in ${loadTime}ms`);

      // Load messages for all conversations
      const conversationIds = loadedConversations!.map(c => c.id);
      const messageStartTime = Date.now();
      const { data: allMessages } = await supabase
        .from('messages')
        .select('id, conversation_id, content, role, created_at')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false });

      const messageLoadTime = Date.now() - messageStartTime;

      expect(allMessages).not.toBe(null);
      console.log(`✅ Loaded messages in ${messageLoadTime}ms`);

      // Cleanup
      for (const conv of conversations) {
        await supabase.from('messages').delete().eq('conversation_id', conv.id);
        await supabase.from('conversations').delete().eq('id', conv.id);
      }

      console.log('✅ E2E bulk load test complete\n');
    }, 120000);

    test('JOURNEY: User sees real-time updates when new message arrives', async () => {
      console.log('\n📋 E2E: Real-time Updates Test\n');

      const { userId, accessToken } = await authenticateTestUser();
      const gridSession = await loadGridSession();

      // Create conversation
      const { data: conversation } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          token_ca: GLOBAL_TOKEN_ID,
          title: 'E2E: Real-time Test',
        })
        .select()
        .single();

      console.log('✅ Created conversation');

      // Initial load
      const { data: initialMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation!.id)
        .order('created_at', { ascending: true });

      expect(initialMessages!.length).toBe(0);

      // Send a message (simulating real-time update)
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'Test real-time update',
              parts: [{ type: 'text', text: 'Test real-time update' }],
            },
          ],
          conversationId: conversation!.id,
          gridSessionSecrets: gridSession.sessionSecrets,
          gridSession: {
            address: gridSession.address,
            authentication: gridSession.authentication,
          },
        }),
      });

      expect(response.ok).toBe(true);

      // Read stream
      if (response.body) {
        const reader = response.body.getReader();
        try {
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        } finally {
          reader.releaseLock();
        }
      }

      // Wait for persistence
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Reload messages (simulating real-time update)
      const { data: updatedMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation!.id)
        .order('created_at', { ascending: true });

      expect(updatedMessages!.length).toBeGreaterThan(0);
      expect(updatedMessages!.some(m => m.role === 'user')).toBe(true);

      console.log('✅ Real-time update received');

      // Cleanup
      await supabase.from('messages').delete().eq('conversation_id', conversation!.id);
      await supabase.from('conversations').delete().eq('id', conversation!.id);

      console.log('✅ E2E real-time test complete\n');
    }, 90000);
  });
});

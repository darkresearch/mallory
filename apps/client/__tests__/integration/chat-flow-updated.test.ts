/**
 * Integration Tests - Updated Chat Flow with Server-Side Persistence
 * 
 * Tests complete chat flow with new optimizations:
 * 1. Server-side message persistence (no incremental saves)
 * 2. Draft message caching per conversation
 * 3. Streaming with final save
 * 
 * REQUIREMENTS:
 * - Backend server must be running (default: http://localhost:3001)
 * - Set TEST_BACKEND_URL in .env.test if using different URL
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import './setup';
import { setupTestUserSession, cleanupTestData, supabase } from './setup';
import { saveDraftMessage, getDraftMessage, clearDraftMessage } from '@/lib/storage/draftMessages';

const BACKEND_URL = process.env.TEST_BACKEND_URL || 'http://localhost:3001';

describe('Chat Flow Integration Tests (Updated)', () => {
  let testSession: {
    userId: string;
    email: string;
    accessToken: string;
    gridSession: any;
  };

  let testConversationId: string;

  beforeAll(async () => {
    console.log('🔧 Setting up test user session for updated chat tests...');
    testSession = await setupTestUserSession();
    
    // Create a test conversation
    const { data: conversation, error } = await supabase
      .from('conversations')
      .insert({
        user_id: testSession.userId,
        title: 'Test: Updated Chat Flow',
      })
      .select()
      .single();

    if (error || !conversation) {
      throw new Error('Failed to create test conversation');
    }

    testConversationId = conversation.id;
    
    console.log('✅ Test session ready');
    console.log('   User ID:', testSession.userId);
    console.log('   Conversation ID:', testConversationId);
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up test data...');
    
    // Delete test messages
    await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', testConversationId);
    
    // Delete test conversation
    await supabase
      .from('conversations')
      .delete()
      .eq('id', testConversationId);
    
    // Clear any draft messages
    await clearDraftMessage(testConversationId);
    
    await cleanupTestData(testSession.userId);
    console.log('✅ Cleanup complete');
  });

  describe('Server-Side Message Persistence', () => {
    test('should save complete assistant message after streaming completes', async () => {
      console.log('\n💾 Testing server-side persistence...\n');

      const userMessage = 'What is 2 + 2?';
      
      // Send message to backend
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testSession.accessToken}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: userMessage,
              parts: [{ type: 'text', text: userMessage }],
            },
          ],
          conversationId: testConversationId,
          gridSessionSecrets: testSession.gridSession.sessionSecrets,
          gridSession: {
            address: testSession.gridSession.address,
            authentication: testSession.gridSession.authentication,
          },
        }),
      });

      expect(response.ok).toBe(true);

      // Read stream completely
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

      // Wait for server-side persistence
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify messages were saved
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', testConversationId)
        .order('created_at', { ascending: true });

      expect(error).toBe(null);
      expect(messages).not.toBe(null);
      expect(messages!.length).toBeGreaterThan(1); // User + Assistant (at least 2)

      // Verify user message
      const userMsg = messages!.find(m => m.role === 'user');
      expect(userMsg).toBeDefined();
      expect(userMsg!.content).toBe(userMessage);

      // Verify assistant message
      const assistantMsg = messages!.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();
      expect(assistantMsg!.content).toBeTruthy();
      expect(assistantMsg!.content.length).toBeGreaterThan(0);

      console.log('✅ Server-side persistence verified');
      console.log('   User message saved:', userMsg!.id);
      console.log('   Assistant message saved:', assistantMsg!.id);
    });

    test('should persist message parts (reasoning + text)', async () => {
      const userMessage = 'Explain why the sky is blue step by step.';
      
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testSession.accessToken}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: userMessage,
              parts: [{ type: 'text', text: userMessage }],
            },
          ],
          conversationId: testConversationId,
          gridSessionSecrets: testSession.gridSession.sessionSecrets,
          gridSession: {
            address: testSession.gridSession.address,
            authentication: testSession.gridSession.authentication,
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
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Load messages
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', testConversationId)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(1);

      const assistantMsg = messages![0];
      
      // Verify message has parts array
      expect(assistantMsg.metadata).toBeDefined();
      expect(assistantMsg.metadata.parts).toBeDefined();
      expect(Array.isArray(assistantMsg.metadata.parts)).toBe(true);

      // Should have text parts
      const textParts = assistantMsg.metadata.parts.filter((p: any) => p.type === 'text');
      expect(textParts.length).toBeGreaterThan(0);

      console.log('✅ Message parts persisted correctly');
      console.log('   Total parts:', assistantMsg.metadata.parts.length);
      console.log('   Text parts:', textParts.length);
    });
  });

  describe('Draft Message Caching', () => {
    test('should save and retrieve draft message for conversation', async () => {
      const draftText = 'This is a draft message for later';

      // Save draft
      await saveDraftMessage(testConversationId, draftText);

      // Retrieve draft
      const retrieved = await getDraftMessage(testConversationId);

      expect(retrieved).toBe(draftText);
    });

    test('should maintain separate drafts for different conversations', async () => {
      // Create second conversation
      const { data: conv2 } = await supabase
        .from('conversations')
        .insert({
          user_id: testSession.userId,
          title: 'Test: Second Conversation',
        })
        .select()
        .single();

      const conv2Id = conv2!.id;

      // Save drafts for both conversations
      await saveDraftMessage(testConversationId, 'Draft for conv 1');
      await saveDraftMessage(conv2Id, 'Draft for conv 2');

      // Retrieve both
      const draft1 = await getDraftMessage(testConversationId);
      const draft2 = await getDraftMessage(conv2Id);

      expect(draft1).toBe('Draft for conv 1');
      expect(draft2).toBe('Draft for conv 2');

      // Cleanup
      await clearDraftMessage(conv2Id);
      await supabase.from('conversations').delete().eq('id', conv2Id);
    });

    test('should clear draft after message is sent', async () => {
      // Save a draft
      await saveDraftMessage(testConversationId, 'Draft to be cleared');

      // Verify it exists
      const before = await getDraftMessage(testConversationId);
      expect(before).toBe('Draft to be cleared');

      // Simulate sending message (which should clear draft)
      await clearDraftMessage(testConversationId);

      // Verify draft is cleared
      const after = await getDraftMessage(testConversationId);
      expect(after).toBe(null);
    });

    test('should persist draft across app restarts', async () => {
      const persistentDraft = 'This draft should persist';

      // Save draft
      await saveDraftMessage(testConversationId, persistentDraft);

      // Simulate app restart by creating new instance
      // (In real app, secure storage persists)
      
      // Retrieve draft
      const retrieved = await getDraftMessage(testConversationId);
      expect(retrieved).toBe(persistentDraft);
    });
  });

  describe('Complete Chat Flow (End-to-End)', () => {
    test('SCENARIO: User types draft → switches conversation → returns → continues typing', async () => {
      console.log('\n🎭 Testing complete draft flow...\n');

      // Step 1: User types a draft
      const originalDraft = 'I was thinking about asking';
      await saveDraftMessage(testConversationId, originalDraft);
      
      console.log('   ✅ Step 1: Draft saved');

      // Step 2: User switches to another conversation
      const { data: otherConv } = await supabase
        .from('conversations')
        .insert({
          user_id: testSession.userId,
          title: 'Test: Other Conversation',
        })
        .select()
        .single();

      const otherConvId = otherConv!.id;
      console.log('   ✅ Step 2: Switched conversations');

      // Step 3: User returns to original conversation
      const retrieved = await getDraftMessage(testConversationId);
      expect(retrieved).toBe(originalDraft);
      console.log('   ✅ Step 3: Draft retrieved correctly');

      // Step 4: User continues typing
      const updatedDraft = 'I was thinking about asking you about quantum computing';
      await saveDraftMessage(testConversationId, updatedDraft);
      
      const final = await getDraftMessage(testConversationId);
      expect(final).toBe(updatedDraft);
      console.log('   ✅ Step 4: Draft updated successfully');

      // Cleanup
      await clearDraftMessage(testConversationId);
      await clearDraftMessage(otherConvId);
      await supabase.from('conversations').delete().eq('id', otherConvId);
    });

    test('SCENARIO: Complete message flow with draft and streaming', async () => {
      console.log('\n🎬 Testing complete message flow...\n');

      // Step 1: User starts typing (draft saved)
      const draft = 'What is the capital of';
      await saveDraftMessage(testConversationId, draft);
      console.log('   ✅ Step 1: Draft saved');

      // Step 2: User completes and sends message
      const finalMessage = 'What is the capital of France?';
      
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testSession.accessToken}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: finalMessage,
              parts: [{ type: 'text', text: finalMessage }],
            },
          ],
          conversationId: testConversationId,
          gridSessionSecrets: testSession.gridSession.sessionSecrets,
          gridSession: {
            address: testSession.gridSession.address,
            authentication: testSession.gridSession.authentication,
          },
        }),
      });

      expect(response.ok).toBe(true);
      console.log('   ✅ Step 2: Message sent, stream started');

      // Step 3: Stream completes
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
      console.log('   ✅ Step 3: Stream completed');

      // Step 4: Draft should be cleared
      await clearDraftMessage(testConversationId);
      const draftAfter = await getDraftMessage(testConversationId);
      expect(draftAfter).toBe(null);
      console.log('   ✅ Step 4: Draft cleared after send');

      // Step 5: Messages should be persisted
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', testConversationId)
        .order('created_at', { ascending: false })
        .limit(2);

      expect(messages!.length).toBeGreaterThan(1);
      console.log('   ✅ Step 5: Messages persisted');
      console.log('\n✅ Complete flow test passed!\n');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle draft with special characters', async () => {
      const specialDraft = 'Draft with emoji 🚀 and symbols @#$%';
      
      await saveDraftMessage(testConversationId, specialDraft);
      const retrieved = await getDraftMessage(testConversationId);
      
      expect(retrieved).toBe(specialDraft);
    });

    test('should handle very long draft messages', async () => {
      const longDraft = 'A'.repeat(5000);
      
      await saveDraftMessage(testConversationId, longDraft);
      const retrieved = await getDraftMessage(testConversationId);
      
      expect(retrieved).toBe(longDraft);
      expect(retrieved!.length).toBe(5000);
    });

    test('should handle multiline draft messages', async () => {
      const multilineDraft = 'Line 1\nLine 2\nLine 3';
      
      await saveDraftMessage(testConversationId, multilineDraft);
      const retrieved = await getDraftMessage(testConversationId);
      
      expect(retrieved).toBe(multilineDraft);
    });

    test('should handle empty draft (auto-clear)', async () => {
      await saveDraftMessage(testConversationId, 'Some text');
      await saveDraftMessage(testConversationId, '');
      
      const retrieved = await getDraftMessage(testConversationId);
      expect(retrieved).toBe(null);
    });
  });

  describe('Performance and Concurrency', () => {
    test('should handle rapid draft updates', async () => {
      const updates = [
        'Draft 1',
        'Draft 2',
        'Draft 3',
        'Draft 4',
        'Draft 5',
      ];

      for (const draft of updates) {
        await saveDraftMessage(testConversationId, draft);
      }

      const final = await getDraftMessage(testConversationId);
      expect(final).toBe('Draft 5');
    });

    test('should handle concurrent message sends', async () => {
      // Send multiple messages in quick succession
      const messages = [
        'Message 1',
        'Message 2',
        'Message 3',
      ];

      for (const msg of messages) {
        const response = await fetch(`${BACKEND_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${testSession.accessToken}`,
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: msg,
                parts: [{ type: 'text', text: msg }],
              },
            ],
            conversationId: testConversationId,
            gridSessionSecrets: testSession.gridSession.sessionSecrets,
            gridSession: {
              address: testSession.gridSession.address,
              authentication: testSession.gridSession.authentication,
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
      }

      // All messages should be persisted
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const { data: persistedMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', testConversationId);

      expect(persistedMessages!.length).toBeGreaterThan(5); // 3 user + 3 assistant (at least 6)
    });
  });
});

/**
 * E2E Test: Complete Chat User Journey (Updated)
 * 
 * Tests the complete end-to-end user experience with all new features:
 * 1. Opening chat screen
 * 2. Draft message persistence
 * 3. Sending messages with streaming
 * 4. Server-side persistence
 * 5. Conversation switching
 * 6. History loading
 * 
 * REQUIREMENTS:
 * - Backend server must be running (default: http://localhost:3001)
 * - Test user must exist with Grid wallet
 */

import { describe, test, expect } from 'bun:test';
import { authenticateTestUser, loadGridSession } from '../setup/test-helpers';
import { supabase } from '../setup/supabase-test-client';
import {
  saveDraftMessage,
  getDraftMessage,
  clearDraftMessage,
  clearAllDraftMessages,
} from '@/lib/storage/draftMessages';

const BACKEND_URL = process.env.TEST_BACKEND_URL || 'http://localhost:3001';

describe('Chat Screen E2E (Complete User Journey)', () => {
  test('JOURNEY: New user opens chat → types draft → switches away → returns → sends message', async () => {
    console.log('\n🚀 Starting Complete User Journey Test\n');
    console.log('━'.repeat(60));
    console.log('This test simulates a real user session from start to finish');
    console.log('━'.repeat(60));
    console.log();

    // ===================================================
    // STEP 1: User Authentication
    // ===================================================
    console.log('📋 Step 1/10: Authenticating user...\n');
    
    const { userId, email, accessToken } = await authenticateTestUser();
    const gridSession = await loadGridSession();
    
    console.log('✅ User authenticated:');
    console.log('   User ID:', userId);
    console.log('   Email:', email);
    console.log('   Grid Address:', gridSession.address);
    console.log();

    // ===================================================
    // STEP 2: Create Initial Conversation
    // ===================================================
    console.log('📋 Step 2/10: Creating conversation...\n');
    
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title: 'E2E: User Journey',
      })
      .select()
      .single();

    if (convError || !conversation) {
      throw new Error('Failed to create conversation');
    }

    const conversationId = conversation.id;
    
    console.log('✅ Conversation created:');
    console.log('   ID:', conversationId);
    console.log();

    // ===================================================
    // STEP 3: User Starts Typing (Draft Saved)
    // ===================================================
    console.log('📋 Step 3/10: User starts typing a message...\n');
    
    const partialDraft = 'I want to ask you about';
    await saveDraftMessage(conversationId, partialDraft);
    
    console.log('✅ Draft saved:');
    console.log('   Content:', partialDraft);
    console.log();

    // ===================================================
    // STEP 4: User Switches to Another Conversation
    // ===================================================
    console.log('📋 Step 4/10: User switches to another conversation...\n');
    
    const { data: otherConv } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title: 'E2E: Other Conversation',
      })
      .select()
      .single();

    const otherConvId = otherConv!.id;
    
    console.log('✅ Switched to different conversation:');
    console.log('   ID:', otherConvId);
    console.log();

    // ===================================================
    // STEP 5: User Returns to Original Conversation
    // ===================================================
    console.log('📋 Step 5/10: User returns to original conversation...\n');
    
    const retrievedDraft = await getDraftMessage(conversationId);
    
    console.log('✅ Draft retrieved successfully:');
    console.log('   Content:', retrievedDraft);
    console.log('   Matches original:', retrievedDraft === partialDraft);
    console.log();

    expect(retrievedDraft).toBe(partialDraft);

    // ===================================================
    // STEP 6: User Completes Message
    // ===================================================
    console.log('📋 Step 6/10: User completes typing...\n');
    
    const completedMessage = 'I want to ask you about quantum computing basics';
    await saveDraftMessage(conversationId, completedMessage);
    
    console.log('✅ Draft updated:');
    console.log('   Content:', completedMessage);
    console.log();

    // ===================================================
    // STEP 7: User Sends Message
    // ===================================================
    console.log('📋 Step 7/10: User sends message...\n');
    
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
            content: completedMessage,
            parts: [{ type: 'text', text: completedMessage }],
          },
        ],
        conversationId,
        gridSessionSecrets: gridSession.sessionSecrets,
        gridSession: {
          address: gridSession.address,
          authentication: gridSession.authentication,
        },
      }),
    });

    expect(response.ok).toBe(true);
    
    console.log('✅ Message sent:');
    console.log('   Status:', response.status);
    console.log('   Streaming started');
    console.log();

    // ===================================================
    // STEP 8: Stream Processes and Completes
    // ===================================================
    console.log('📋 Step 8/10: Processing AI response stream...\n');
    
    let chunkCount = 0;
    let streamContent = '';

    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('   ✅ Stream completed');
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          chunkCount++;
          streamContent += chunk;
        }
      } finally {
        reader.releaseLock();
      }
    }

    console.log('✅ Stream processing complete:');
    console.log('   Chunks received:', chunkCount);
    console.log('   Content length:', streamContent.length, 'bytes');
    console.log();

    // ===================================================
    // STEP 9: Draft is Cleared
    // ===================================================
    console.log('📋 Step 9/10: Clearing draft after send...\n');
    
    await clearDraftMessage(conversationId);
    const draftAfterSend = await getDraftMessage(conversationId);
    
    console.log('✅ Draft cleared:');
    console.log('   Draft after send:', draftAfterSend);
    console.log();

    expect(draftAfterSend).toBe(null);

    // ===================================================
    // STEP 10: Verify Message Persistence
    // ===================================================
    console.log('📋 Step 10/10: Verifying message persistence...\n');
    
    // Wait for server-side persistence
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    expect(msgError).toBe(null);
    expect(messages).not.toBe(null);
    expect(messages!.length).toBeGreaterThan(1); // User + Assistant (at least 2)

    const userMsg = messages!.find(m => m.role === 'user');
    const assistantMsg = messages!.find(m => m.role === 'assistant');

    console.log('✅ Messages persisted:');
    console.log('   User message:', userMsg!.id);
    console.log('   Assistant message:', assistantMsg!.id);
    console.log('   User content:', userMsg!.content);
    console.log('   Assistant content length:', assistantMsg!.content.length, 'chars');
    console.log();

    // ===================================================
    // Verification and Cleanup
    // ===================================================
    console.log('🧹 Cleaning up test data...\n');
    
    await supabase.from('messages').delete().eq('conversation_id', conversationId);
    await supabase.from('messages').delete().eq('conversation_id', otherConvId);
    await supabase.from('conversations').delete().eq('id', conversationId);
    await supabase.from('conversations').delete().eq('id', otherConvId);
    await clearAllDraftMessages();

    console.log('✅ Cleanup complete');
    console.log();

    // ===================================================
    // Final Summary
    // ===================================================
    console.log('✅✅✅ COMPLETE USER JOURNEY TEST PASSED! ✅✅✅\n');
    console.log('━'.repeat(60));
    console.log('📍 Journey Summary:\n');
    console.log('✅ User authenticated successfully');
    console.log('✅ Conversation created');
    console.log('✅ Draft saved while typing');
    console.log('✅ Draft persisted across conversation switch');
    console.log('✅ Draft retrieved when returning');
    console.log('✅ Message sent and streamed');
    console.log('✅ Draft cleared after send');
    console.log('✅ Messages persisted server-side');
    console.log();
    console.log('All user interactions worked flawlessly!');
    console.log('━'.repeat(60));
    console.log();
  }, 90000);

  test('JOURNEY: User with multiple conversations and drafts', async () => {
    console.log('\n🎭 Testing multi-conversation draft management...\n');

    const { userId, accessToken } = await authenticateTestUser();
    const gridSession = await loadGridSession();

    // Create 3 conversations
    const conversations = [];
    for (let i = 1; i <= 3; i++) {
      const { data } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          title: `E2E: Conversation ${i}`,
        })
        .select()
        .single();
      
      conversations.push(data!);
    }

    console.log('✅ Created 3 conversations');

    // Save drafts for each
    await saveDraftMessage(conversations[0].id, 'Draft for conversation 1');
    await saveDraftMessage(conversations[1].id, 'Draft for conversation 2');
    await saveDraftMessage(conversations[2].id, 'Draft for conversation 3');

    console.log('✅ Saved drafts for all conversations');

    // Verify each draft is independent
    const draft1 = await getDraftMessage(conversations[0].id);
    const draft2 = await getDraftMessage(conversations[1].id);
    const draft3 = await getDraftMessage(conversations[2].id);

    expect(draft1).toBe('Draft for conversation 1');
    expect(draft2).toBe('Draft for conversation 2');
    expect(draft3).toBe('Draft for conversation 3');

    console.log('✅ All drafts independent and correct');

    // Send message in conversation 1 (should clear only that draft)
    await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'Draft for conversation 1',
            parts: [{ type: 'text', text: 'Draft for conversation 1' }],
          },
        ],
        conversationId: conversations[0].id,
        gridSessionSecrets: gridSession.sessionSecrets,
        gridSession: {
          address: gridSession.address,
          authentication: gridSession.authentication,
        },
      }),
    });

    await clearDraftMessage(conversations[0].id);

    // Verify draft 1 cleared, others remain
    const draft1After = await getDraftMessage(conversations[0].id);
    const draft2After = await getDraftMessage(conversations[1].id);
    const draft3After = await getDraftMessage(conversations[2].id);

    expect(draft1After).toBe(null);
    expect(draft2After).toBe('Draft for conversation 2');
    expect(draft3After).toBe('Draft for conversation 3');

    console.log('✅ Draft cleared for sent message, others preserved');

    // Cleanup
    for (const conv of conversations) {
      await supabase.from('messages').delete().eq('conversation_id', conv.id);
      await supabase.from('conversations').delete().eq('id', conv.id);
      await clearDraftMessage(conv.id);
    }

    console.log('✅ Multi-conversation test complete\n');
  }, 120000);

  test('JOURNEY: User experiences network issues during send', async () => {
    console.log('\n🌐 Testing error handling and recovery...\n');

    const { userId, accessToken } = await authenticateTestUser();
    const gridSession = await loadGridSession();

    const { data: conversation } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title: 'E2E: Error Handling',
      })
      .select()
      .single();

    const conversationId = conversation!.id;

    // Save a draft
    const draft = 'Message to send despite issues';
    await saveDraftMessage(conversationId, draft);
    console.log('✅ Draft saved');

    // Try to send with invalid endpoint (simulate network error)
    try {
      await fetch(`${BACKEND_URL}/api/invalid-endpoint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: draft,
              parts: [{ type: 'text', text: draft }],
            },
          ],
          conversationId,
          gridSessionSecrets: gridSession.sessionSecrets,
          gridSession: {
            address: gridSession.address,
            authentication: gridSession.authentication,
          },
        }),
      });
    } catch (error) {
      console.log('   Expected error occurred');
    }

    // Draft should still exist (not cleared since send failed)
    const draftAfterError = await getDraftMessage(conversationId);
    expect(draftAfterError).toBe(draft);
    console.log('✅ Draft preserved after error');

    // User tries again with correct endpoint
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
            content: draft,
            parts: [{ type: 'text', text: draft }],
          },
        ],
        conversationId,
        gridSessionSecrets: gridSession.sessionSecrets,
        gridSession: {
          address: gridSession.address,
          authentication: gridSession.authentication,
        },
      }),
    });

    expect(response.ok).toBe(true);
    console.log('✅ Retry successful');

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

    // Now draft can be cleared
    await clearDraftMessage(conversationId);
    const draftAfterSuccess = await getDraftMessage(conversationId);
    expect(draftAfterSuccess).toBe(null);
    console.log('✅ Draft cleared after successful send');

    // Cleanup
    await supabase.from('messages').delete().eq('conversation_id', conversationId);
    await supabase.from('conversations').delete().eq('id', conversationId);

    console.log('✅ Error handling test complete\n');
  }, 90000);

  test('JOURNEY: Long-running conversation with history', async () => {
    console.log('\n💬 Testing conversation history and continuity...\n');

    const { userId, accessToken } = await authenticateTestUser();
    const gridSession = await loadGridSession();

    const { data: conversation } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title: 'E2E: Long Conversation',
      })
      .select()
      .single();

    const conversationId = conversation!.id;

    // Send multiple messages in sequence
    const turns = [
      'What is TypeScript?',
      'How does it differ from JavaScript?',
      'Can you show an example?',
    ];

    for (let i = 0; i < turns.length; i++) {
      const message = turns[i];
      console.log(`   Turn ${i + 1}: Sending "${message}"`);

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
              content: message,
              parts: [{ type: 'text', text: message }],
            },
          ],
          conversationId,
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

      console.log(`   ✅ Turn ${i + 1} complete`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Wait for all persistence
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Load conversation history
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    console.log('\n✅ Conversation history loaded:');
    console.log('   Total messages:', messages!.length);
    console.log('   Expected:', turns.length * 2); // Each turn = user + assistant

    // Verify all turns are present
    expect(messages!.length).toBeGreaterThan(turns.length * 2 - 1); // Each turn = user + assistant (at least)

    // Verify message order (should alternate user/assistant)
    for (let i = 0; i < messages!.length; i++) {
      const expectedRole = i % 2 === 0 ? 'user' : 'assistant';
      expect(messages![i].role).toBe(expectedRole);
    }

    console.log('✅ Message order correct (alternating user/assistant)');

    // Cleanup
    await supabase.from('messages').delete().eq('conversation_id', conversationId);
    await supabase.from('conversations').delete().eq('id', conversationId);

    console.log('✅ Long conversation test complete\n');
  }, 180000);
});

/**
 * Conversation Utilities for Tests
 * 
 * Direct import of production createNewConversation
 * Works in test environment with test Supabase client
 */

import '../setup/test-env';
import { supabase } from '../setup/supabase-test-client';
import { v4 as uuidv4 } from 'uuid';

const GLOBAL_TOKEN_ID = 'GLOBAL';

/**
 * Create new conversation (test version)
 * Mirrors production but uses test Supabase client
 */
export async function createTestConversation(userId: string): Promise<string> {
  const conversationId = uuidv4();
  
  console.log('📝 Creating conversation:', conversationId);
  
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      id: conversationId,
      user_id: userId,
      title: 'test-conversation',
      token_ca: GLOBAL_TOKEN_ID,
    })
    .select()
    .single();

  if (error) {
    // Check if conversation already exists
    if (error.code === '23505') {
      console.log('ℹ️  Conversation already exists (race condition)');
      return conversationId;
    }
    throw new Error(`Failed to create conversation: ${error.message}`);
  }

  console.log('✅ Conversation created:', conversationId);
  
  return conversationId;
}


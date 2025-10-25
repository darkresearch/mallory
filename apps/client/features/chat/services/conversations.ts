import { secureStorage } from '../../../lib/storage';
import { supabase } from '../../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

const LAST_CONVERSATION_KEY = 'last_conversation_timestamp';
const CURRENT_CONVERSATION_KEY = 'current_conversation_id';
const GLOBAL_TOKEN_ID = '00000000-0000-0000-0000-000000000000'; // All zeros UUID for global conversations

export interface ConversationData {
  conversationId: string;
  shouldGreet: boolean;
  userName?: string;
}

// Create conversation via client-side Supabase (with RLS protection)
async function createConversationDirectly(conversationId: string, userId?: string): Promise<boolean> {
  try {
    console.log('[createConversation] Starting with conversationId:', conversationId);
    
    // First, let's check the current auth state
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('[createConversation] Current session state:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      isExpired: session && session.expires_at ? new Date() > new Date(session.expires_at * 1000) : 'no session',
      sessionError
    });
    
    // Test if we can read from conversations table (to verify RLS is working)
    if (session?.user?.id) {
      console.log('[createConversation] Testing SELECT permission on conversations table...');
      const { data: testData, error: testError } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1);
      
      console.log('[createConversation] SELECT test result:', {
        canRead: !testError,
        testError: testError?.message,
        testErrorCode: testError?.code,
        foundConversations: testData?.length || 0
      });
    }
    
    // Use provided userId if available, otherwise get from Supabase auth
    let authUser;
    if (userId) {
      console.log('[createConversation] Using provided userId:', userId);
      authUser = { id: userId };
    } else {
      console.log('[createConversation] Getting authenticated user from Supabase...');
      
      // Try with a timeout to avoid hanging
      const authPromise = supabase.auth.getUser();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Auth timeout')), 5000)
      );
      
      try {
        const { data: { user } } = await Promise.race([authPromise, timeoutPromise]) as any;
        authUser = user;
        console.log('[createConversation] Auth user result:', authUser ? 'found' : 'not found');
      } catch (error) {
        console.error('[createConversation] Auth error or timeout:', error);
        
        // Try alternative: get session instead
        console.log('[createConversation] Trying getSession as fallback...');
        try {
          const { data: { session } } = await supabase.auth.getSession();
          authUser = session?.user;
          console.log('[createConversation] Session user result:', authUser ? 'found' : 'not found');
        } catch (sessionError) {
          console.error('[createConversation] Session error:', sessionError);
          return false;
        }
      }
    }
    
    if (!authUser?.id) {
      console.error('[createConversation] No authenticated user found after all attempts');
      return false;
    }
    
    // Skip existence check since UUIDs are unique and INSERT will handle conflicts gracefully
    console.log('[createConversation] Creating conversation directly (no existence check needed with UUIDs)');
    
    // Create new conversation with explicit user_id
    console.log('[createConversation] Attempting to insert conversation:', {
      id: conversationId,
      title: 'scout-global',
      token_ca: GLOBAL_TOKEN_ID,
      user_id: authUser.id,
      authUserObject: authUser
    });
    
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        id: conversationId,
        title: 'mallory-global',
        token_ca: GLOBAL_TOKEN_ID,
        user_id: authUser.id, // Explicitly set user_id
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {}
      })
      .select(); // Add select to get the inserted data back
    
    if (error) {
      // If it's a duplicate key error, that's fine - conversation exists
      if (error.code === '23505') {
        console.log('[createConversation] Conversation already exists (race condition)');
        return true;
      }
      console.error('[createConversation] Failed to create conversation:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return false;
    }
    
    console.log('[createConversation] Successfully created conversation:', {
      conversationId,
      insertedData: data
    });
    
    console.log('[createConversation] Successfully created conversation:', conversationId);
    return true;
  } catch (error) {
    console.error('Error creating conversation directly:', error);
    return false;
  }
}

// Create conversation via client-side Supabase with custom metadata
async function createConversationWithMetadata(conversationId: string, userId: string, metadata: Record<string, any>): Promise<boolean> {
  try {
    console.log('[createConversationWithMetadata] Creating conversation with metadata:', {
      conversationId,
      userId,
      metadata
    });

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        id: conversationId,
        title: 'mallory-global',
        token_ca: GLOBAL_TOKEN_ID,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: metadata
      })
      .select();
    
    if (error) {
      if (error.code === '23505') {
        console.log('[createConversationWithMetadata] Conversation already exists (race condition)');
        return true;
      }
      console.error('[createConversationWithMetadata] Failed to create conversation:', error);
      return false;
    }
    
    console.log('[createConversationWithMetadata] Successfully created conversation with metadata');
    return true;
  } catch (error) {
    console.error('Error creating conversation with metadata:', error);
    return false;
  }
}

// Explicitly create a new conversation (when user clicks "New chat")
export async function createNewConversation(userId?: string, metadata?: Record<string, any>): Promise<ConversationData> {
  try {
    const newConversationId = uuidv4();
    const now = Date.now();
    
    // Store in local storage as the current conversation
    await secureStorage.setItem(CURRENT_CONVERSATION_KEY, newConversationId);
    await secureStorage.setItem(LAST_CONVERSATION_KEY, now.toString());
    
    // Get userId if not provided
    let authUserId = userId;
    if (!authUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      authUserId = user?.id;
    }

    if (!authUserId) {
      throw new Error('No user ID available for conversation creation');
    }
    
    // Create conversation record in Supabase
    console.log('📝 Creating conversation in Supabase:', newConversationId);
    let success;
    
    if (metadata) {
      // Create with custom metadata (e.g., onboarding)
      success = await createConversationWithMetadata(newConversationId, authUserId, metadata);
    } else {
      // Create with default flow
      success = await createConversationDirectly(newConversationId, authUserId);
    }
    
    if (success) {
      console.log('✅ Successfully created conversation in Supabase');
    } else {
      console.warn('⚠️ Failed to create conversation in Supabase, but continuing with local conversation');
    }
    
    return {
      conversationId: newConversationId,
      shouldGreet: true,
      userName: 'Edgar', // TODO: Get from user profile
    };
  } catch (error) {
    console.error('Error creating new conversation:', error);
    // Fallback: create new conversation on error
    const fallbackId = uuidv4();
    return {
      conversationId: fallbackId,
      shouldGreet: true,
      userName: 'Edgar',
    };
  }
}

// Get current conversation or load most recent from history (only auto-create if no history exists)
export async function getCurrentOrCreateConversation(
  userId?: string,
  existingConversations?: Array<{ id: string; updated_at: string }>
): Promise<ConversationData> {
  try {
    const currentConversationId = await secureStorage.getItem(CURRENT_CONVERSATION_KEY);
    const now = Date.now();
    
    if (currentConversationId) {
      // Use existing current conversation
      await secureStorage.setItem(LAST_CONVERSATION_KEY, now.toString());
      
      return {
        conversationId: currentConversationId,
        shouldGreet: false,
      };
    } else {
      // No current conversation - check if user has any conversation history
      console.log('📱 No current conversation, checking conversation history...');
      
      if (existingConversations && existingConversations.length > 0) {
        // User has conversation history - use the most recent one (already sorted by updated_at DESC)
        const mostRecentConversation = existingConversations[0];
        console.log('📱 Found existing conversations (from context), loading most recent:', mostRecentConversation.id);
        
        // Set as current conversation
        await secureStorage.setItem(CURRENT_CONVERSATION_KEY, mostRecentConversation.id);
        await secureStorage.setItem(LAST_CONVERSATION_KEY, now.toString());
        
        return {
          conversationId: mostRecentConversation.id,
          shouldGreet: false,
        };
      } else {
        // No conversation history provided - fallback to database query
        console.log('📱 No conversation history provided, querying database as fallback...');
        
        // Get user ID for database query
        let authUserId = userId;
        if (!authUserId) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            authUserId = user?.id;
          } catch (error) {
            console.error('Error getting auth user for conversation check:', error);
          }
        }
        
        if (!authUserId) {
          console.error('No user ID available for conversation history check');
          return await createNewConversation(userId);
        }
        
        // Query for existing conversations as fallback
        const { data: existingConversationsFromDB, error } = await supabase
          .from('conversations')
          .select('id, updated_at')
          .eq('user_id', authUserId)
          .eq('token_ca', GLOBAL_TOKEN_ID)
          .order('updated_at', { ascending: false })
          .limit(1);
          
        if (error) {
          console.error('Error checking conversation history:', error);
          // On error, create new conversation as fallback
          return await createNewConversation(userId);
        }
        
        if (existingConversationsFromDB && existingConversationsFromDB.length > 0) {
          // User has conversation history - use the most recent one
          const mostRecentConversation = existingConversationsFromDB[0];
          console.log('📱 Found existing conversations (from DB), loading most recent:', mostRecentConversation.id);
          
          // Set as current conversation
          await secureStorage.setItem(CURRENT_CONVERSATION_KEY, mostRecentConversation.id);
          await secureStorage.setItem(LAST_CONVERSATION_KEY, now.toString());
          
          return {
            conversationId: mostRecentConversation.id,
            shouldGreet: false,
          };
        } else {
          // User has no conversation history - create their first conversation
          console.log('📱 No conversation history found, creating first conversation for user');
          return await createNewConversation(userId);
        }
      }
    }
  } catch (error) {
    console.error('Error getting current conversation:', error);
    // Fallback: create new conversation on error
    return await createNewConversation(userId);
  }
}

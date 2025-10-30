import { useState, useEffect, useMemo, useRef } from 'react';
import { useAIChat } from './useAIChat';
import { useTransactionGuard } from './useTransactionGuard';
import { supabase } from '../lib';

interface UseChatStateProps {
  currentConversationId: string | null;
  userId: string | undefined; // Required for Supermemory
  walletBalance?: {
    sol?: number;
    usdc?: number;
    totalUsd?: number;
  };
  userHasCompletedOnboarding?: boolean; // To check if user has already received intro message
}

/**
 * StreamState - Single discriminated union for all streaming states
 * Replaces 5+ boolean flags with explicit state machine
 */
type StreamState = 
  | { status: 'idle' }
  | { status: 'waiting'; startTime: number }
  | { status: 'reasoning'; startTime: number }
  | { status: 'responding'; startTime: number }

/**
 * Mark user as having completed onboarding
 * This is a one-time flag to prevent infinite loops of intro messages
 */
async function markUserOnboardingComplete(userId: string): Promise<boolean> {
  try {
    console.log('🎯 [Onboarding] Marking user onboarding as complete for userId:', userId);
    
    const { error } = await supabase
      .from('users')
      .update({ has_completed_onboarding: true })
      .eq('id', userId);
    
    if (error) {
      console.error('❌ [Onboarding] Failed to update has_completed_onboarding:', error);
      return false;
    }
    
    console.log('✅ [Onboarding] Successfully marked onboarding as complete');
    return true;
  } catch (err) {
    console.error('❌ [Onboarding] Exception updating onboarding flag:', err);
    return false;
  }
}

export function useChatState({ currentConversationId, userId, walletBalance, userHasCompletedOnboarding }: UseChatStateProps) {
  // Transaction guard for Grid session validation
  const { ensureGridSession } = useTransactionGuard();
  
  // State machine for streaming states
  const [streamState, setStreamState] = useState<StreamState>({ status: 'idle' });
  
  // Supporting state for UI
  const [liveReasoningText, setLiveReasoningText] = useState('');
  const [pendingMessage, setPendingMessage] = useState<string | null>(null); // Preserve message during OTP
  const hasTriggeredProactiveMessage = useRef(false);

  // AI Chat using Vercel's useChat hook
  const aiChatResult = useAIChat({
    conversationId: currentConversationId || 'temp-loading',
    userId: userId || 'unknown', // Pass userId for Supermemory
    walletBalance: walletBalance, // Pass wallet balance for x402 threshold checking
  });
  
  // Only use results when we have a real conversation ID
  const rawMessages = currentConversationId ? aiChatResult.messages : [];
  const sendAIMessage = currentConversationId ? aiChatResult.sendMessage : undefined;
  const regenerateMessage = currentConversationId ? aiChatResult.regenerate : undefined;
  const aiError = currentConversationId ? aiChatResult.error : null;
  const aiStatus = currentConversationId ? aiChatResult.status : 'ready';
  const isLoadingHistory = currentConversationId ? aiChatResult.isLoadingHistory : false;
  const stopStreaming = currentConversationId ? aiChatResult.stop : undefined;

  // Create enhanced messages with placeholder when in waiting state
  // Filter out system messages (they're triggers, never displayed)
  const aiMessages = useMemo(() => {
    console.log('🔍 aiMessages useMemo triggered:', {
      streamStatus: streamState.status,
      rawMessagesLength: rawMessages.length,
      rawMessagesRoles: rawMessages.map(m => m.role),
      rawMessagesIds: rawMessages.map(m => m.id),
    });

    // Filter out system messages (triggers only, not for display)
    const displayMessages = rawMessages.filter(msg => msg.role !== 'system');
    console.log('🎭 Filtered out system messages:', {
      before: rawMessages.length,
      after: displayMessages.length,
      systemMessagesFiltered: rawMessages.length - displayMessages.length
    });

    // In waiting state, show placeholder after user's last message
    if (streamState.status === 'waiting') {
      const lastMessage = displayMessages[displayMessages.length - 1];
      const lastMessageIsUser = lastMessage && lastMessage.role === 'user';
      
      if (lastMessageIsUser) {
        // Create placeholder assistant message immediately after user message
        const placeholderMessage = {
          id: 'placeholder-reasoning',
          role: 'assistant' as const,
          parts: [
            {
              type: 'reasoning',
              text: '',
              id: 'initial-reasoning'
            }
          ],
          content: '',
          createdAt: new Date(),
        };
        
        console.log('🎯 Creating placeholder assistant message in waiting state');
        return [...displayMessages, placeholderMessage];
      }
    }
    
    console.log('✅ Returning filtered messages as-is');
    return displayMessages;
  }, [rawMessages, streamState.status]);

  // State machine: Transition states based on aiStatus and message content
  useEffect(() => {
    if (aiStatus === 'streaming') {
      console.log('⚡ Status changed to streaming - analyzing content type');
      
      // Determine if we're reasoning or responding based on message content
      if (aiMessages.length > 0) {
        const lastMessage = aiMessages[aiMessages.length - 1];
        
        if (lastMessage.role === 'assistant') {
          const hasReasoningParts = lastMessage.parts?.some((p: any) => p.type === 'reasoning');
          const messageContent = (lastMessage as any).content;
          const hasTextContent = messageContent && typeof messageContent === 'string' && messageContent.trim().length > 0;
          
          // Transition from 'waiting' to first active state
          if (streamState.status === 'waiting') {
            if (hasReasoningParts) {
              console.log('🧠 First content is reasoning - transitioning to reasoning state');
              setStreamState({ status: 'reasoning', startTime: streamState.startTime });
            } else if (hasTextContent) {
              console.log('💬 First content is text - transitioning to responding state');
              setStreamState({ status: 'responding', startTime: streamState.startTime });
            }
          }
          // Handle alternating between reasoning and responding
          else if (streamState.status === 'reasoning' && hasTextContent && !hasReasoningParts) {
            console.log('💬 AI started responding - transitioning from reasoning to responding');
            setStreamState({ status: 'responding', startTime: streamState.startTime });
          }
          else if (streamState.status === 'responding' && hasReasoningParts) {
            console.log('🧠 AI reasoning again - transitioning from responding to reasoning');
            setStreamState({ status: 'reasoning', startTime: streamState.startTime });
          }
        }
      }
    } else if (aiStatus === 'ready') {
      // Stream completed - transition back to idle
      if (streamState.status !== 'idle') {
        const duration = Date.now() - streamState.startTime;
        console.log(`✅ Stream completed - transitioning to idle (duration: ${duration}ms)`);
        setStreamState({ status: 'idle' });
      }
    }
  }, [aiStatus, aiMessages, streamState]);

  // Extract live reasoning text from streaming messages
  useEffect(() => {
    if (aiStatus === 'streaming' && aiMessages.length > 0) {
      const lastMessage = aiMessages[aiMessages.length - 1];
      if (lastMessage.role === 'assistant') {
        // Extract reasoning parts as they arrive
        const reasoningParts = lastMessage.parts?.filter((p: any) => p.type === 'reasoning') || [];
        
        if (reasoningParts.length > 0) {
          const allReasoningText = reasoningParts.map((p: any) => p.text || '').join('\n\n');
          if (allReasoningText !== liveReasoningText) {
            console.log('🧠 Live reasoning update:', allReasoningText.length, 'chars');
            setLiveReasoningText(allReasoningText);
          }
        }
      }
    } else if (aiStatus === 'ready') {
      // Clear reasoning text when stream completes
      setLiveReasoningText('');
    }
  }, [aiMessages, aiStatus, liveReasoningText]);

  // Trigger proactive message for empty onboarding conversations
  // SAFEGUARDS AGAINST INFINITE LOOPS:
  // 1. Check userHasCompletedOnboarding flag (persistent across sessions)
  // 2. Check hasTriggeredProactiveMessage ref (prevents multiple triggers in same session)
  // 3. Check conversation has no messages (rawMessages.length === 0)
  // 4. Mark onboarding complete BEFORE sending message (fail-safe)
  // 
  // NOTE: Onboarding conversation creation is now handled by OnboardingConversationHandler component
  // This effect only triggers the greeting message for existing onboarding conversations
  // 
  // DISABLED: Proactive message is currently disabled
  useEffect(() => {
    const triggerProactiveMessage = async () => {
      // DISABLED: Proactive message from Mallory is disabled
      console.log('🤖 [Proactive] Proactive message is disabled');
      return;
      
      // SAFEGUARD #1: User has already received intro message - NEVER send again
      if (userHasCompletedOnboarding) {
        console.log('🤖 [Proactive] User has already completed onboarding - skipping intro message');
        return;
      }
      
      // Only run once per conversation, after history is loaded, when ready
      if (
        isLoadingHistory || 
        hasTriggeredProactiveMessage.current || 
        !currentConversationId || 
        !sendAIMessage ||
        !userId || // Need userId to mark onboarding complete
        aiStatus !== 'ready' ||
        rawMessages.length > 0 // SAFEGUARD #3: Conversation must be empty
      ) {
        return;
      }

      console.log('🤖 [Proactive] Checking for onboarding conversation...');
      
      // Load conversation metadata to check for onboarding flag
      const { data: conversation, error } = await supabase
        .from('conversations')
        .select('metadata')
        .eq('id', currentConversationId)
        .single();
      
      if (error) {
        console.error('🤖 [Proactive] Error loading conversation metadata:', error);
        return;
      }
      
      // If this is an onboarding conversation, trigger Mallory's greeting
      if (conversation?.metadata?.is_onboarding) {
        console.log('🤖 [Proactive] Detected onboarding conversation - preparing greeting');
        
        // SAFEGUARD #2: Mark as triggered immediately (session-level protection)
        hasTriggeredProactiveMessage.current = true;
        
        // SAFEGUARD #4: Mark onboarding complete BEFORE sending message
        // This is the CRITICAL safeguard - even if message fails, we won't retry
        console.log('🎯 [Proactive] Marking user onboarding complete BEFORE sending intro message');
        const success = await markUserOnboardingComplete(userId);
        
        if (!success) {
          console.error('❌ [Proactive] Failed to mark onboarding complete - ABORTING intro message to prevent loops');
          return;
        }
        
        console.log('✅ [Proactive] Onboarding marked complete - safe to send intro message');
        
        // Transition to waiting state for proactive message
        const startTime = Date.now();
        setStreamState({ status: 'waiting', startTime });
        setLiveReasoningText('');
        
        // Send system message to trigger Mallory's streaming greeting
        sendAIMessage({
          role: 'system',
          content: 'onboarding_greeting',
        } as any);
        
        console.log('🚀 [Proactive] Intro message sent - user will only see this ONCE ever');
      }
    };

    triggerProactiveMessage();
  }, [isLoadingHistory, rawMessages.length, currentConversationId, sendAIMessage, aiStatus, userHasCompletedOnboarding, userId]);

  const handleSendMessage = async (message: string) => {
    if (!sendAIMessage) return;
    
    console.log('📤 [ChatState] Sending message to AI:', message);
    
    // Check Grid session before sending (all messages, can't predict x402 usage)
    const canProceed = await ensureGridSession(
      'send message',
      '/(main)/chat',
      '#FFEFE3', // Chat screen background
      '#000000'  // Black text on cream background
    );
    
    if (!canProceed) {
      // User being redirected to OTP, save message for after
      console.log('💬 [ChatState] Grid session required, saving pending message');
      setPendingMessage(message);
      return;
    }
    
    // Transition to waiting state
    const startTime = Date.now();
    setStreamState({ status: 'waiting', startTime });
    setLiveReasoningText('');
    
    // Server handles all storage and processing
    sendAIMessage({ text: message });
  };

  return {
    // State machine - single source of truth
    streamState,
    
    // Supporting state
    liveReasoningText,
    isLoadingHistory,
    pendingMessage,
    
    // AI Chat results
    aiMessages,
    aiError,
    aiStatus,
    regenerateMessage,
    
    // Actions
    handleSendMessage,
    stopStreaming,
    clearPendingMessage: () => setPendingMessage(null),
  };
}

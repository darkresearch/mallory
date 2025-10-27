import { useState, useEffect, useMemo, useRef } from 'react';
import { useAIChat } from './useAIChat';
import { supabase } from '../lib';

interface UseChatStateProps {
  currentConversationId: string | null;
  userId: string | undefined; // Required for Supermemory
  walletBalance?: {
    sol?: number;
    usdc?: number;
    totalUsd?: number;
  };
}

export function useChatState({ currentConversationId, userId, walletBalance }: UseChatStateProps) {
  // State for immediate reasoning feedback
  const [showImmediateReasoning, setShowImmediateReasoning] = useState(false);
  const [liveReasoningText, setLiveReasoningText] = useState('');
  const [hasInitialReasoning, setHasInitialReasoning] = useState(false);
  const [thinkingDuration, setThinkingDuration] = useState<number>(0);
  const [isThinking, setIsThinking] = useState(false); // Simple flag: true from send to done
  const [hasStreamStarted, setHasStreamStarted] = useState(false); // True when first stream data arrives
  const [isOnboardingGreeting, setIsOnboardingGreeting] = useState(false); // Track if showing onboarding greeting
  const thinkingStartTime = useRef<number | null>(null);
  const hasTriggeredProactiveMessage = useRef(false);

  // AI Chat using Vercel's useChat hook - with immediate feedback
  const aiChatResult = useAIChat({
    conversationId: currentConversationId || 'temp-loading',
    userId: userId || 'unknown', // Pass userId for Supermemory
    walletBalance: walletBalance, // Pass wallet balance for x402 threshold checking
    onImmediateReasoning: (text) => {
      console.log('⚡ IMMEDIATE reasoning callback triggered');
      setShowImmediateReasoning(true);
    },
    onImmediateToolCall: (toolName) => {
      console.log('⚡ IMMEDIATE tool call callback triggered');
    },
  });
  
  // Only use results when we have a real conversation ID
  const rawMessages = currentConversationId ? aiChatResult.messages : [];
  const sendAIMessage = currentConversationId ? aiChatResult.sendMessage : undefined;
  const regenerateMessage = currentConversationId ? aiChatResult.regenerate : undefined;
  const aiError = currentConversationId ? aiChatResult.error : null;
  const aiStatus = currentConversationId ? aiChatResult.status : 'ready';
  const isLoadingHistory = currentConversationId ? aiChatResult.isLoadingHistory : false;
  const stopStreaming = currentConversationId ? aiChatResult.stop : undefined;

  // Create enhanced messages with placeholder when reasoning starts
  // Filter out system messages (they're triggers, never displayed)
  const aiMessages = useMemo(() => {
    console.log('🔍 aiMessages useMemo triggered:', {
      hasInitialReasoning,
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

    if (!hasInitialReasoning) {
      console.log('📤 No initial reasoning yet - returning filtered messages');
      return displayMessages;
    }

    // We have reasoning - check if the last message is from the user
    const lastMessage = displayMessages[displayMessages.length - 1];
    const lastMessageIsUser = lastMessage && lastMessage.role === 'user';
    console.log('🤖 Last message check:', { 
      hasLastMessage: !!lastMessage, 
      lastMessageRole: lastMessage?.role,
      lastMessageIsUser 
    });
    
    if (lastMessageIsUser) {
      // Create placeholder assistant message immediately after user message
      // Include an initial reasoning part so Chain of Thought renders immediately
      const placeholderMessage = {
        id: 'placeholder-reasoning',
        role: 'assistant' as const,
        parts: [
          {
            type: 'reasoning',
            text: '', // Empty reasoning text initially
            id: 'initial-reasoning'
          }
        ],
        content: '', // Required by useChat interface
        createdAt: new Date(),
      };
      
      console.log('🎯 Creating placeholder assistant message for immediate reasoning display');
      console.log('📋 Final aiMessages array will have:', displayMessages.length + 1, 'messages');
      return [...displayMessages, placeholderMessage];
    }
    
    console.log('✅ Last message is assistant - returning filtered messages as-is');
    return displayMessages;
  }, [rawMessages, hasInitialReasoning]);

  // Show immediate reasoning indicator as soon as streaming starts
  useEffect(() => {
    if (aiStatus === 'streaming') {
      console.log('⚡ Status changed to streaming - first stream data arrived');
      if (thinkingStartTime.current === null) {
        thinkingStartTime.current = Date.now();
      }
      setHasStreamStarted(true); // First stream data - hide placeholder
      setShowImmediateReasoning(true);
    } else if (aiStatus === 'ready') {
      // Calculate final thinking duration
      if (thinkingStartTime.current !== null) {
        const duration = Date.now() - thinkingStartTime.current;
        console.log(`⏱️ Thinking duration: ${duration}ms`);
        setThinkingDuration(duration);
        thinkingStartTime.current = null;
      }
      console.log('✅ Status changed to ready - hiding thinking indicator and resetting state');
      setIsThinking(false); // Stop showing thinking
      setHasStreamStarted(false); // Reset for next message
      setShowImmediateReasoning(false);
      setHasInitialReasoning(false); // Reset for next message
      setIsOnboardingGreeting(false); // Clear onboarding greeting flag
    }
  }, [aiStatus]);

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
    }
  }, [aiMessages, aiStatus, liveReasoningText]);

  // Track when we first get reasoning to show persistent block
  useEffect(() => {
    if (liveReasoningText && !hasInitialReasoning) {
      console.log('🎯 First reasoning detected - enabling persistent reasoning block');
      setHasInitialReasoning(true);
    }
  }, [liveReasoningText, hasInitialReasoning]);

  // Trigger proactive message for empty onboarding conversations
  useEffect(() => {
    const triggerProactiveMessage = async () => {
      // TEMPORARILY DISABLED: Proactive welcome message causing infinite loop
      // TODO: Re-enable after investigating the issue
      return;
      
      // Only run once per conversation, after history is loaded, when ready
      if (
        isLoadingHistory || 
        hasTriggeredProactiveMessage.current || 
        !currentConversationId || 
        !sendAIMessage ||
        aiStatus !== 'ready' ||
        rawMessages.length > 0
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
      
      // If this is an onboarding conversation, trigger Scout's greeting
      if (conversation?.metadata?.is_onboarding) {
        console.log('🤖 [Proactive] Detected onboarding conversation - triggering greeting');
        hasTriggeredProactiveMessage.current = true;
        
        // Show placeholder immediately (just like when user sends a message)
        setLiveReasoningText('');
        setThinkingDuration(0);
        setHasStreamStarted(false);
        thinkingStartTime.current = Date.now();
        setIsThinking(true);
        setShowImmediateReasoning(true);
        setHasInitialReasoning(true); // Create placeholder immediately
        setIsOnboardingGreeting(true); // Track that this is onboarding greeting
        
        // Send system message to trigger Scout's streaming greeting
        sendAIMessage({
          role: 'system',
          content: 'onboarding_greeting',
        } as any);
      }
    };

    triggerProactiveMessage();
  }, [isLoadingHistory, rawMessages.length, currentConversationId, sendAIMessage, aiStatus]);

  const handleSendMessage = (message: string) => {
    if (!sendAIMessage) return;
    
    console.log('📤 Sending message to AI:', message);
    // Clear previous reasoning state
    setLiveReasoningText('');
    setThinkingDuration(0); // Reset duration for new message
    setHasStreamStarted(false); // Reset - no stream data yet
    thinkingStartTime.current = Date.now(); // Start timer immediately
    // IMMEDIATELY show thinking - no conditions, no delays
    setIsThinking(true);
    setShowImmediateReasoning(true);
    setHasInitialReasoning(true); // Create placeholder immediately
    // Server handles all storage and processing
    sendAIMessage({ text: message });
  };

  return {
    // State
    showImmediateReasoning,
    liveReasoningText,
    hasInitialReasoning,
    isLoadingHistory,
    thinkingDuration,
    isThinking, // Simple flag for immediate UI
    hasStreamStarted, // True when first stream data arrives
    isOnboardingGreeting, // True when showing onboarding greeting message
    
    // AI Chat results
    aiMessages,
    aiError,
    aiStatus,
    regenerateMessage,
    
    // Actions
    handleSendMessage,
    stopStreaming,
  };
}

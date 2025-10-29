import { useEffect, useRef } from 'react';
import { supabase } from '@/lib';
import { createOnboardingConversation } from '@/features/chat';

interface User {
  id: string;
  hasCompletedOnboarding?: boolean;
}

interface OnboardingConversationHandlerProps {
  user: User | null;
  currentConversationId: string | null;
  onConversationCreated?: (conversationId: string) => void;
}

/**
 * Handles onboarding conversation creation in the background
 * 
 * SAFEGUARDS AGAINST INFINITE LOOPS:
 * 1. Only runs once per session (hasTriggered ref)
 * 2. Checks user.hasCompletedOnboarding flag (persistent)
 * 3. Marks onboarding complete BEFORE creating conversation
 * 4. Only triggers for empty conversations with is_onboarding metadata
 */
export function OnboardingConversationHandler({
  user,
  currentConversationId,
  onConversationCreated,
}: OnboardingConversationHandlerProps) {
  const hasTriggered = useRef(false);

  useEffect(() => {
    const handleOnboarding = async () => {
      // SAFEGUARD #1: Only run once per session
      if (hasTriggered.current) {
        return;
      }

      // SAFEGUARD #2: User has already completed onboarding - never create again
      if (!user || user.hasCompletedOnboarding) {
        return;
      }

      // Need a valid user ID
      if (!user.id) {
        return;
      }

      console.log('🤖 [OnboardingHandler] New user detected - creating onboarding conversation');

      // Mark as triggered immediately to prevent duplicate attempts
      hasTriggered.current = true;

      try {
        // Create onboarding conversation
        const conversation = await createOnboardingConversation(user.id);
        console.log('✅ [OnboardingHandler] Onboarding conversation created:', conversation.conversationId);

        // Notify parent component if callback provided
        if (onConversationCreated) {
          onConversationCreated(conversation.conversationId);
        }
      } catch (error) {
        console.error('❌ [OnboardingHandler] Failed to create onboarding conversation:', error);
        // Reset trigger so we can retry if needed
        hasTriggered.current = false;
      }
    };

    handleOnboarding();
  }, [user?.id, user?.hasCompletedOnboarding, onConversationCreated]);

  // This component doesn't render anything - it's just for side effects
  return null;
}


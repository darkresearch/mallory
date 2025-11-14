import { useEffect, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
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

export function OnboardingConversationHandler({
  user,
  currentConversationId,
  onConversationCreated,
}: OnboardingConversationHandlerProps) {
  const hasTriggered = useRef(false);
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleOnboarding = async () => {
      if (hasTriggered.current) {
        return;
      }

      if (!user || user.hasCompletedOnboarding) {
        return;
      }

      const conversationIdFromUrl = params.conversationId as string | undefined;
      const hasActiveConversation = currentConversationId || conversationIdFromUrl;
      
      if (hasActiveConversation) {
        return;
      }

      if (!user.id) {
        return;
      }

      hasTriggered.current = true;

      try {
        const conversation = await createOnboardingConversation(user.id);
        if (onConversationCreated) {
          onConversationCreated(conversation.conversationId);
        }
      } catch (error) {
        console.error('Failed to create onboarding conversation:', error);
        hasTriggered.current = false;
      }
    };

    handleOnboarding();
  }, [user?.id, user?.hasCompletedOnboarding, currentConversationId, params.conversationId, onConversationCreated]);

  return null;
}


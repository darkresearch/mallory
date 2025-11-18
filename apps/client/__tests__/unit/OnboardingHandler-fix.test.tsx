// @ts-nocheck - Bun-specific test with advanced mocking features
/**
 * Unit Tests for OnboardingConversationHandler
 * 
 * Tests race condition prevention:
 * - Verifies handler checks URL params before creating onboarding conversations
 * - Prevents duplicate conversations when users navigate back from chat history
 * - Ensures handler respects existing conversation state from props and URL
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { render, waitFor } from '@testing-library/react';
import '../setup/test-env';

// Mock dependencies
const mockCreateOnboardingConversation = mock(async (userId: string) => ({
  conversationId: `onboarding-${userId}`,
}));

const mockLocalSearchParams = {
  conversationId: undefined as string | undefined,
};

// Mock expo-router
mock.module('expo-router', () => ({
  useLocalSearchParams: () => mockLocalSearchParams,
}));

// Mock features/chat
mock.module('@/features/chat', () => ({
  createOnboardingConversation: mockCreateOnboardingConversation,
}));

// Mock lib (supabase not needed for this test)
mock.module('@/lib', () => ({
  supabase: {},
}));

// Import after mocking
const { OnboardingConversationHandler } = await import(
  '@/components/chat/OnboardingConversationHandler'
);

describe('OnboardingConversationHandler - Race Condition Prevention', () => {
  beforeEach(() => {
    mockCreateOnboardingConversation.mockClear();
    mockLocalSearchParams.conversationId = undefined;
  });

  describe('Checks URL params before creating onboarding', () => {
    test('does NOT create onboarding when URL has conversationId', async () => {
      // Setup - URL has conversationId (user navigating to existing conversation)
      mockLocalSearchParams.conversationId = 'existing-from-url-123';

      const user = {
        id: 'test-user-id',
        hasCompletedOnboarding: false,
      };

      // Execute - Render component
      render(
        <OnboardingConversationHandler
          user={user}
          currentConversationId={null}
        />
      );

      // Assert - Should NOT create onboarding conversation
      await waitFor(
        () => {
          expect(mockCreateOnboardingConversation).not.toHaveBeenCalled();
        },
        { timeout: 100 }
      );
    });

    test('does NOT create onboarding when prop has conversationId', async () => {
      // Setup - Prop has conversationId (loaded from useActiveConversation)
      mockLocalSearchParams.conversationId = undefined;

      const user = {
        id: 'test-user-id',
        hasCompletedOnboarding: false,
      };

      // Execute
      render(
        <OnboardingConversationHandler
          user={user}
          currentConversationId="existing-from-prop-456"
        />
      );

      // Assert
      await waitFor(
        () => {
          expect(mockCreateOnboardingConversation).not.toHaveBeenCalled();
        },
        { timeout: 100 }
      );
    });

    test('DOES create onboarding when both URL and prop are null', async () => {
      // Setup - No conversation exists anywhere
      mockLocalSearchParams.conversationId = undefined;

      const user = {
        id: 'test-user-id',
        hasCompletedOnboarding: false,
      };

      // Execute
      render(
        <OnboardingConversationHandler
          user={user}
          currentConversationId={null}
        />
      );

      // Assert - Should create onboarding
      await waitFor(
        () => {
          expect(mockCreateOnboardingConversation).toHaveBeenCalledWith(
            'test-user-id'
          );
        },
        { timeout: 100 }
      );
    });

    test('URL param takes precedence even if prop is loading', async () => {
      // Setup - URL has param, prop is null (race condition scenario)
      mockLocalSearchParams.conversationId = 'url-wins-789';

      const user = {
        id: 'test-user-id',
        hasCompletedOnboarding: false,
      };

      // Execute - currentConversationId is null because it's still loading
      render(
        <OnboardingConversationHandler
          user={user}
          currentConversationId={null}
        />
      );

      // Assert - Should NOT create because URL param exists
      await waitFor(
        () => {
          expect(mockCreateOnboardingConversation).not.toHaveBeenCalled();
        },
        { timeout: 100 }
      );
    });
  });

  describe('Effect dependencies include URL params', () => {
    test('re-evaluates when currentConversationId prop changes', async () => {
      // Setup
      mockLocalSearchParams.conversationId = undefined;

      const user = {
        id: 'test-user-id',
        hasCompletedOnboarding: false,
      };

      // Initial render - no conversation
      const { rerender } = render(
        <OnboardingConversationHandler
          user={user}
          currentConversationId={null}
        />
      );

      // Should attempt to create
      await waitFor(() => {
        expect(mockCreateOnboardingConversation).toHaveBeenCalledTimes(1);
      });

      mockCreateOnboardingConversation.mockClear();

      // Re-render with conversationId now loaded
      rerender(
        <OnboardingConversationHandler
          user={user}
          currentConversationId="now-loaded-123"
        />
      );

      // Should NOT create again (hasTriggered ref prevents it)
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockCreateOnboardingConversation).not.toHaveBeenCalled();
    });

    test('does not create duplicate when URL param loads after mount', async () => {
      // Setup - Simulate URL param not available initially
      mockLocalSearchParams.conversationId = undefined;

      const user = {
        id: 'test-user-id',
        hasCompletedOnboarding: false,
      };

      // Initial render
      const { rerender } = render(
        <OnboardingConversationHandler
          user={user}
          currentConversationId={null}
        />
      );

      // Onboarding gets created
      await waitFor(() => {
        expect(mockCreateOnboardingConversation).toHaveBeenCalledTimes(1);
      });

      mockCreateOnboardingConversation.mockClear();

      // Simulate URL param loading late (race condition)
      mockLocalSearchParams.conversationId = 'late-loaded-456';

      rerender(
        <OnboardingConversationHandler
          user={user}
          currentConversationId={null}
        />
      );

      // Should NOT create again (hasTriggered prevents it)
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockCreateOnboardingConversation).not.toHaveBeenCalled();
    });
  });

  describe('Existing behavior still works', () => {
    test('respects hasCompletedOnboarding flag', async () => {
      // Setup
      mockLocalSearchParams.conversationId = undefined;

      const user = {
        id: 'test-user-id',
        hasCompletedOnboarding: true, // Already completed
      };

      // Execute
      render(
        <OnboardingConversationHandler
          user={user}
          currentConversationId={null}
        />
      );

      // Assert - Should NOT create
      await waitFor(
        () => {
          expect(mockCreateOnboardingConversation).not.toHaveBeenCalled();
        },
        { timeout: 100 }
      );
    });

    test('does not create when user is null', async () => {
      // Setup
      mockLocalSearchParams.conversationId = undefined;

      // Execute
      render(
        <OnboardingConversationHandler
          user={null}
          currentConversationId={null}
        />
      );

      // Assert
      await waitFor(
        () => {
          expect(mockCreateOnboardingConversation).not.toHaveBeenCalled();
        },
        { timeout: 100 }
      );
    });

    test('calls onConversationCreated callback when provided', async () => {
      // Setup
      mockLocalSearchParams.conversationId = undefined;
      const mockCallback = mock();

      const user = {
        id: 'test-user-id',
        hasCompletedOnboarding: false,
      };

      // Execute
      render(
        <OnboardingConversationHandler
          user={user}
          currentConversationId={null}
          onConversationCreated={mockCallback}
        />
      );

      // Assert
      await waitFor(() => {
        expect(mockCallback).toHaveBeenCalledWith('onboarding-test-user-id');
      });
    });
  });
});


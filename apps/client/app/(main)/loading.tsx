import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { createOnboardingConversation } from '@/features/chat';

export default function LoadingScreen() {
  const router = useRouter();
  const { isLoading, isAuthenticated, isCheckingReauth, isSigningIn, user } = useAuth();

  console.log('📱 [LoadingScreen] State:', { 
    isLoading, 
    isAuthenticated, 
    isCheckingReauth,
    isSigningIn, // Now tracking sign-in state
    hasCompletedOnboarding: user?.hasCompletedOnboarding
  });

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      // Once AuthProvider finishes loading and re-auth checking, redirect based on auth state
      // BUT: Don't redirect if user is still signing in (e.g., on OTP screen)
      if (!isLoading && !isCheckingReauth && !isSigningIn) {
        console.log('📱 [LoadingScreen] Redirecting...', { 
          isAuthenticated,
          hasCompletedOnboarding: user?.hasCompletedOnboarding
        });
        
        if (isAuthenticated) {
          // Check if this is a first-time user who needs onboarding
          if (!user?.hasCompletedOnboarding) {
            console.log('📱 [LoadingScreen] New user detected - creating onboarding conversation');
            try {
              const conversation = await createOnboardingConversation(user?.id);
              console.log('✅ [LoadingScreen] Onboarding conversation created:', conversation.conversationId);
              // Navigate directly to chat - useChatState will detect onboarding conversation
              router.replace('/(main)/chat');
            } catch (error) {
              console.error('❌ [LoadingScreen] Failed to create onboarding conversation:', error);
              // Fallback to regular chat if onboarding creation fails
              router.replace('/(main)/chat');
            }
          } else {
            // Returning user - go directly to regular chat
            console.log('📱 [LoadingScreen] Returning user → main chat');
            router.replace('/(main)/chat');
          }
        } else {
          router.replace('/(auth)/login');
        }
      } else if (isSigningIn) {
        console.log('📱 [LoadingScreen] Sign-in in progress, waiting...');
      }
    };

    checkAuthAndRedirect();
  }, [isLoading, isAuthenticated, isCheckingReauth, isSigningIn, user?.hasCompletedOnboarding]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.text}>
          {isCheckingReauth ? 'Verifying wallet access...' : 'Loading...'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E67B25', // Match login/OTP screen orange
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    color: '#FFFFFF', // White text on orange background
    fontSize: 16,
    marginTop: 16,
    fontFamily: 'Satoshi',
  },
});

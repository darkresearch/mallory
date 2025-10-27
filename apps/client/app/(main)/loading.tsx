import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { createOnboardingConversation } from '@/features/chat';

export default function LoadingScreen() {
  const router = useRouter();
  const { isLoading, isAuthenticated, isCheckingReauth, user } = useAuth();

  console.log('📱 [LoadingScreen] State:', { 
    isLoading, 
    isAuthenticated, 
    isCheckingReauth,
    hasCompletedOnboarding: user?.hasCompletedOnboarding
  });

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      // Once AuthProvider finishes loading and re-auth checking, redirect based on auth state
      if (!isLoading && !isCheckingReauth) {
        console.log('📱 [LoadingScreen] Redirecting...', { 
          isAuthenticated,
          hasCompletedOnboarding: user?.hasCompletedOnboarding
        });
        
        if (isAuthenticated) {
          // Check if user has completed onboarding
          if (user?.hasCompletedOnboarding) {
            console.log('📱 [LoadingScreen] User has completed onboarding → main chat');
            router.replace('/(main)/chat');
          } else {
            console.log('📱 [LoadingScreen] User needs onboarding → creating onboarding conversation');
            // Create onboarding conversation and redirect to chat
            try {
              await createOnboardingConversation(user?.id);
              console.log('✅ Onboarding conversation created, redirecting to chat');
              router.replace('/(main)/chat');
            } catch (error) {
              console.error('❌ Error creating onboarding conversation:', error);
              // Fallback to regular chat on error
              router.replace('/(main)/chat');
            }
          }
        } else {
          router.replace('/(auth)/login');
        }
      }
    };

    checkAuthAndRedirect();
  }, [isLoading, isAuthenticated, isCheckingReauth, user?.hasCompletedOnboarding]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#E67B25" />
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
    backgroundColor: '#FFEFE3', // Light theme background color
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    color: '#000000', // Light theme text color
    fontSize: 16,
    marginTop: 16,
    fontFamily: 'Satoshi',
  },
});

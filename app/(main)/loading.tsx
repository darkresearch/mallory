import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function LoadingScreen() {
  const router = useRouter();
  const { isLoading, isAuthenticated, isCheckingReauth } = useAuth();

  console.log('📱 [LoadingScreen] State:', { 
    isLoading, 
    isAuthenticated, 
    isCheckingReauth
  });

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      // Once AuthProvider finishes loading and re-auth checking, redirect based on auth state
      if (!isLoading && !isCheckingReauth) {
        console.log('📱 [LoadingScreen] Redirecting...', { isAuthenticated });
        
        if (isAuthenticated) {
          router.replace('/(main)/chat');
        } else {
          router.replace('/(auth)/login');
        }
      }
    };

    checkAuthAndRedirect();
  }, [isLoading, isAuthenticated, isCheckingReauth]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#4A9EFF" />
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
    backgroundColor: '#05080C', // Dark theme background color from memory
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    color: '#DCE9FF', // Text/foreground color from memory
    fontSize: 16,
    marginTop: 16,
    fontFamily: 'Satoshi',
  },
});

import '@/polyfills';
import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { View, StatusBar, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { ErrorBoundary } from 'react-error-boundary';
import { AuthProvider } from '../contexts/AuthContext';
import { GridProvider } from '../contexts/GridContext';
import { WalletProvider } from '../contexts/WalletContext';
import { ActiveConversationProvider } from '../contexts/ActiveConversationContext';
import { initializeComponentRegistry } from '../components/registry';
import { DataPreloader } from '../components/DataPreloader';
import { ChatManager } from '../components/chat/ChatManager';
import { ErrorFallback } from '../components/ErrorFallback';
import 'react-native-url-polyfill/auto';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: '(auth)',
};

export default function RootLayout() {
  const [errorBoundaryKey, setErrorBoundaryKey] = React.useState(0);
  const [fontsLoaded] = useFonts({
    'Satoshi-Regular': require('../assets/fonts/Satoshi-Regular.ttf'),
    'Satoshi-Medium': require('../assets/fonts/Satoshi-Medium.ttf'),
    'Satoshi-Bold': require('../assets/fonts/Satoshi-Bold.ttf'),
    'Satoshi': require('../assets/fonts/Satoshi-Regular.ttf'), // Default weight
    'Belwe-Medium': require('../assets/fonts/BelweMediumBT.ttf'),
    'Belwe-Bold': require('../assets/fonts/BelweBoldBT.ttf'),
    'Belwe-Light': require('../assets/fonts/BelweLightBT.ttf'),
  });

  useEffect(() => {
    // Initialize component registry for dynamic UI
    console.log('🔧 Initializing component registry...');
    initializeComponentRegistry();
    
    // Set up status bar for light theme
    StatusBar.setBarStyle('dark-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('#FFEFE3');
      StatusBar.setTranslucent(true);
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#FFEFE3' }}>
      <ErrorBoundary
        resetKeys={[errorBoundaryKey]}
        fallbackRender={({ error, resetErrorBoundary }) => (
          <ErrorFallback 
            error={error as Error} 
            resetErrorBoundary={() => {
              // Update key first - this triggers auto-reset via resetKeys
              setErrorBoundaryKey(prev => prev + 1);
              // Also call resetErrorBoundary for immediate effect
              // Use setTimeout to ensure state update propagates (especially on mobile web)
              setTimeout(() => {
                resetErrorBoundary();
              }, 0);
            }} 
          />
        )}
        onReset={() => {
          // Cleanup callback - called when boundary resets
          console.log('Error boundary reset');
        }}
        onError={(error, info) => {
          console.error('Error caught by root boundary:', error);
          console.error('Error info:', info);
          // Future: send to error reporting service (e.g., Sentry)
          // Note: error is typed as unknown, but react-error-boundary ensures it's an Error
        }}
      >
        <SafeAreaProvider 
          key={errorBoundaryKey}
          style={{ flex: 1, backgroundColor: '#FFEFE3' }}
        >
          <AuthProvider>
            <GridProvider>
              <WalletProvider>
                <ActiveConversationProvider>
                  <DataPreloader />
                  <ChatManager />
                  <View style={{ flex: 1, backgroundColor: '#FFEFE3', minHeight: '100vh' as any, overflow: 'hidden' }}>
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: '#FFEFE3' },
                        animation: 'fade',
                      }}
                    />
                    {Platform.OS === 'web' && (
                      <>
                        <Analytics />
                        <SpeedInsights />
                      </>
                    )}
                  </View>
                </ActiveConversationProvider>
              </WalletProvider>
            </GridProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
import '@/polyfills';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { View, StatusBar, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '../contexts/AuthContext';
import { GridProvider } from '../contexts/GridContext';
import { ConversationsProvider } from '../contexts/ConversationsContext';
import { WalletProvider } from '../contexts/WalletContext';
import AuthGate from '../components/auth/AuthGate';
import { initializeComponentRegistry } from '../components/registry';
import 'react-native-url-polyfill/auto';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: '(auth)',
};

export default function RootLayout() {
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
      <SafeAreaProvider style={{ flex: 1, backgroundColor: '#FFEFE3' }}>
        <AuthProvider>
          <GridProvider>
            <AuthGate>
              <ConversationsProvider>
                <WalletProvider>
                  <View style={{ flex: 1, backgroundColor: '#FFEFE3', minHeight: '100vh' as any }}>
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
                </WalletProvider>
              </ConversationsProvider>
            </AuthGate>
          </GridProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
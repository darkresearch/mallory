import '@/polyfills';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, StatusBar, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '../contexts/AuthContext';
import { ConversationsProvider } from '../contexts/ConversationsContext';
import { WalletProvider } from '../contexts/WalletContext';
import AuthGate from '../components/auth/AuthGate';
import { initI18n } from '../lib/i18n';
import 'react-native-url-polyfill/auto';

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
  });
  
  const [i18nInitialized, setI18nInitialized] = useState(false);

  useEffect(() => {
    // Set up status bar for dark theme
    StatusBar.setBarStyle('light-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('#05080C');
      StatusBar.setTranslucent(true);
    }
  }, []);

  // Initialize i18n
  useEffect(() => {
    initI18n()
      .then(() => {
        console.log('✅ i18n initialized');
        setI18nInitialized(true);
      })
      .catch((error) => {
        console.error('Failed to initialize i18n:', error);
        // Continue anyway with fallback
        setI18nInitialized(true);
      });
  }, []);

  useEffect(() => {
    if (fontsLoaded && i18nInitialized) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, i18nInitialized]);

  if (!fontsLoaded || !i18nInitialized) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#05080C' }}>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: '#05080C' }}>
        <AuthProvider>
          <AuthGate>
            <ConversationsProvider>
              <WalletProvider>
                <View style={{ flex: 1, backgroundColor: '#05080C', minHeight: '100vh' }}>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: '#05080C' },
                      animation: 'fade',
                    }}
                  />
                </View>
              </WalletProvider>
            </ConversationsProvider>
          </AuthGate>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
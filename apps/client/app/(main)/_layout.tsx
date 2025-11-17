import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function MainLayout() {
  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
        contentStyle: { backgroundColor: '#FFEFE3' },
        animation: Platform.OS === 'web' ? 'fade' : 'slide_from_right',
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{
          animation: 'none',
        }}
      />
      <Stack.Screen 
        name="chat" 
        options={{
          animation: 'none',
        }}
      />
      <Stack.Screen 
        name="chat-history" 
        options={{
          animation: Platform.OS === 'web' ? 'fade' : 'slide_from_left',
        }}
      />
      <Stack.Screen 
        name="wallet" 
        options={{
          animation: Platform.OS === 'web' ? 'fade' : 'slide_from_right',
        }}
      />
      <Stack.Screen 
        name="gas-abstraction" 
        options={{
          animation: Platform.OS === 'web' ? 'fade' : 'slide_from_right',
        }}
      />
      <Stack.Screen 
        name="loading" 
        options={{
          animation: 'none',
        }}
      />
    </Stack>
  );
}
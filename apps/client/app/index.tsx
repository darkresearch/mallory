import { Redirect } from 'expo-router';

export default function RootIndex() {
  // Direct redirect to chat - AuthContext will handle auth-based routing
  return <Redirect href="/(main)/chat" />;
}
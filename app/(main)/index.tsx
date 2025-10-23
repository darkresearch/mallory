import { Redirect } from 'expo-router';

export default function MainIndex() {
  // Redirect to chat as default screen
  return <Redirect href="/(main)/chat" />;
}
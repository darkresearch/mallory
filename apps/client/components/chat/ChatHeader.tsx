import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { ModernMenuIcon } from '../ui/ModernMenuIcon';

interface ChatHeaderProps {
  user: any;
  styles: any;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ user, styles }) => {
  const router = useRouter();

  return (
    <View style={styles.header}>
      {/* Hamburger menu - opens chat history */}
      <TouchableOpacity 
        style={styles.headerButton}
        onPress={() => {
          console.log('🍔 Hamburger clicked - navigating to chat-history');
          router.push('/(main)/chat-history');
        }}
      >
        <ModernMenuIcon size={24} color="#FBAA69" strokeWidth={2} />
      </TouchableOpacity>

      {/* App logo */}
      <View style={styles.wordmarkContainer}>
        <Image 
          source={require('../../assets/mallory-logo.png')}
          style={styles.wordmarkImage}
          resizeMode="contain"
        />
      </View>

      {/* Profile picture - opens wallet */}
      <TouchableOpacity 
        style={styles.profileButton}
        onPress={() => {
          console.log('👤 Profile clicked - navigating to wallet');
          router.push('/(main)/wallet');
        }}
      >
        <View
          style={[styles.profileGradientBorder, { backgroundColor: '#E67B25' }]}
        >
          {user?.profilePicture ? (
            <Image
              source={{ uri: user.profilePicture }}
              style={styles.profileImage}
              onError={() => console.log('Profile image failed to load')}
            />
          ) : (
            <View style={styles.profilePlaceholder}>
              <Text style={styles.profileInitial}>
                {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
};

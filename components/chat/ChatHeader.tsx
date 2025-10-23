import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

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
        <Feather name="menu" size={24} color="#8C8C8C" />
      </TouchableOpacity>

      {/* Scout wordmark */}
      <View style={styles.wordmarkContainer}>
        <Image 
          source={require('../../assets/images/wordmark.svg')}
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
        <LinearGradient
          colors={['#81A6E5', '#1F4A95']}
          style={styles.profileGradientBorder}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
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
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

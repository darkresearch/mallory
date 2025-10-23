import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';

type TabBarProps = {
  state?: any;
  descriptors?: any;
  navigation?: any;
};

export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  
  // Define our main tabs
  const tabs = [
    { name: 'chat', icon: 'chatbubble', route: '/(main)/chat' },
    { name: 'wallet', icon: 'wallet', route: '/(main)/wallet' },
    { name: 'account', icon: 'person', route: '/(main)/account' },
  ];

  const handlePress = (route: string) => {
    if (Platform.OS === 'web') {
      router.push(route as any);
    } else if (navigation) {
      navigation.navigate(route);
    }
  };

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = pathname.includes(tab.name);
        
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => handlePress(tab.route)}
          >
            <Ionicons
              name={tab.icon as any}
              size={24}
              color={isActive ? '#4A9EFF' : '#7d8590'}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#05080C',
    borderTopWidth: 1,
    borderTopColor: '#30363d',
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
});

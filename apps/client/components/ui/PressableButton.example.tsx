/**
 * PressableButton Examples
 * 
 * This file demonstrates all variants and use cases of the PressableButton component.
 * You can copy these examples directly into your screens.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PressableButton } from './PressableButton';

export default function PressableButtonExamples() {
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = () => {
    console.log('Button pressed!');
  };

  const handleLoadingPress = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>PressableButton Examples</Text>
        <Text style={styles.subtitle}>
          Mallory's delightful button component with smooth animations
        </Text>

        {/* Variants */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Variants</Text>
          
          <PressableButton variant="primary" onPress={handlePress}>
            Primary Button
          </PressableButton>
          
          <PressableButton variant="secondary" onPress={handlePress}>
            Secondary Button
          </PressableButton>
          
          <PressableButton variant="ghost" onPress={handlePress}>
            Ghost Button
          </PressableButton>
          
          <PressableButton variant="pill" onPress={handlePress}>
            Pill Button
          </PressableButton>
        </View>

        {/* Sizes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sizes</Text>
          
          <PressableButton size="small" onPress={handlePress}>
            Small Button
          </PressableButton>
          
          <PressableButton size="medium" onPress={handlePress}>
            Medium Button (default)
          </PressableButton>
          
          <PressableButton size="large" onPress={handlePress}>
            Large Button
          </PressableButton>
        </View>

        {/* With Icons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>With Icons</Text>
          
          <PressableButton 
            onPress={handlePress}
            icon={<Ionicons name="create-outline" size={20} color="#000000" />}
          >
            New Chat
          </PressableButton>
          
          <PressableButton 
            variant="secondary"
            onPress={handlePress}
            icon={<Ionicons name="refresh-outline" size={20} color="#000000" />}
          >
            Refresh
          </PressableButton>
          
          <PressableButton 
            variant="pill"
            size="small"
            onPress={handlePress}
            icon={<Ionicons name="checkmark-circle-outline" size={18} color="#000000" />}
          >
            Confirm
          </PressableButton>
        </View>

        {/* Loading States */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Loading States</Text>
          
          <PressableButton 
            onPress={handleLoadingPress}
            loading={isLoading}
          >
            Click to Load
          </PressableButton>
          
          <PressableButton 
            variant="secondary"
            loading={true}
          >
            Always Loading
          </PressableButton>
        </View>

        {/* Full Width */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Full Width</Text>
          
          <PressableButton 
            fullWidth 
            onPress={handlePress}
          >
            Full Width Button
          </PressableButton>
          
          <PressableButton 
            fullWidth
            variant="secondary"
            onPress={handlePress}
            icon={<Ionicons name="settings-outline" size={20} color="#000000" />}
          >
            Full Width with Icon
          </PressableButton>
        </View>

        {/* Disabled */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Disabled States</Text>
          
          <PressableButton 
            disabled 
            onPress={handlePress}
          >
            Disabled Primary
          </PressableButton>
          
          <PressableButton 
            variant="secondary"
            disabled 
            onPress={handlePress}
          >
            Disabled Secondary
          </PressableButton>
        </View>

        {/* Real-world Examples */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Real-world Examples</Text>
          
          <PressableButton 
            fullWidth
            size="large"
            onPress={handlePress}
            icon={<Ionicons name="send-outline" size={24} color="#000000" />}
          >
            Send Message
          </PressableButton>
          
          <PressableButton 
            fullWidth
            variant="secondary"
            onPress={handlePress}
          >
            Cancel
          </PressableButton>
          
          <View style={styles.row}>
            <PressableButton 
              variant="ghost"
              size="small"
              onPress={handlePress}
              style={{ flex: 1 }}
            >
              Skip
            </PressableButton>
            <PressableButton 
              size="small"
              onPress={handlePress}
              style={{ flex: 1 }}
            >
              Next
            </PressableButton>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFEFE3',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    fontFamily: 'Satoshi',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Satoshi',
    color: '#000000',
    marginBottom: 32,
    opacity: 0.7,
  },
  section: {
    marginBottom: 32,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Satoshi',
    color: '#000000',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
});


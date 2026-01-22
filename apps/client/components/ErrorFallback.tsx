import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

/**
 * ErrorFallback - Custom fallback UI for error boundaries
 * 
 * Displays a user-friendly error message when a component error occurs.
 * Matches app design with #FFEFE3 background and branded styling.
 */
export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="alert-circle" size={64} color="#E67B25" />
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          We encountered an unexpected error. Don't worry, your data is safe.
        </Text>
        
        {__DEV__ && (
          <View style={styles.errorDetails}>
            <Text style={styles.errorLabel}>Error details (dev only):</Text>
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        )}
        
        <TouchableOpacity 
          style={styles.button}
          onPress={resetErrorBoundary}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFEFE3',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginTop: 24,
    marginBottom: 12,
    fontFamily: 'Satoshi-Bold',
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#212121',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    fontFamily: 'Satoshi',
  },
  errorDetails: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E67B25',
  },
  errorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E67B25',
    marginBottom: 8,
    fontFamily: 'Satoshi',
  },
  errorText: {
    fontSize: 12,
    color: '#212121',
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#E67B25',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    minWidth: 120,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'Satoshi',
  },
});


import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib';

interface DevAuthInputProps {
  isMobile: boolean;
}

/**
 * Development-only email input for testing authentication flow
 *
 * Flow (matches production exactly):
 * 1. Supabase password auth (replaces Google OAuth) → Creates Supabase session
 * 2. Grid OTP flow (automatic via GridContext) → Creates Grid wallet
 *
 * Uses a fixed dev password to avoid password input UI
 */
export default function DevAuthInput({ isMobile }: DevAuthInputProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const DEV_PASSWORD = 'dev-password-123'; // Fixed password for dev testing

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Please enter an email');
      return;
    }

    // Basic email validation
    if (!email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('🔐 [Dev Auth] Starting Supabase authentication for:', email);

      // Step 1: Try to sign in with password
      const signInResult = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: DEV_PASSWORD,
      });

      // If user doesn't exist, create account
      if (signInResult.error?.message?.includes('Invalid login credentials')) {
        console.log('🔐 [Dev Auth] User not found, creating account...');

        const signUpResult = await supabase.auth.signUp({
          email: email.trim(),
          password: DEV_PASSWORD,
          options: {
            emailRedirectTo: undefined, // No email confirmation in dev
          }
        });

        if (signUpResult.error) {
          throw signUpResult.error;
        }
      } else if (signInResult.error) {
        throw signInResult.error;
      }

      console.log('✅ [Dev Auth] Supabase session created');
      console.log('🔐 [Dev Auth] AuthContext will handle session → GridContext will initiate Grid sign-in');

      // Success! AuthContext will detect the session change via onAuthStateChange
      // Then GridContext will automatically call initiateGridSignIn()
      // User will see Grid OTP screen next
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
      console.error('❌ [Dev Auth] Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <Text style={[styles.label, isMobile && styles.labelMobile]}>DEV MODE</Text>

      <View style={[styles.inputContainer, isMobile && styles.inputContainerMobile]}>
        <TextInput
          style={[styles.input, isMobile && styles.inputMobile]}
          placeholder="Enter email for testing"
          placeholderTextColor="#999"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setError(null);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
        />

        <TouchableOpacity
          style={[
            styles.button,
            isMobile && styles.buttonMobile,
            (isLoading || !email.trim()) && styles.buttonDisabled
          ]}
          onPress={handleSubmit}
          disabled={isLoading || !email.trim()}
        >
          {isLoading ? (
            <ActivityIndicator color="#E67B25" size="small" />
          ) : (
            <Text style={[styles.buttonText, isMobile && styles.buttonTextMobile]}>
              Send OTP
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {error && (
        <Text style={[styles.errorText, isMobile && styles.errorTextMobile]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 345,
    alignItems: 'center',
    marginBottom: 20,
  },
  containerMobile: {
    maxWidth: '100%',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F8CEAC',
    letterSpacing: 1,
    marginBottom: 12,
    fontFamily: 'Satoshi',
  },
  labelMobile: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
  },
  inputContainerMobile: {
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#1F1F1F',
    fontFamily: 'Satoshi',
  },
  inputMobile: {
    paddingVertical: 16,
  },
  button: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  buttonMobile: {
    paddingVertical: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E67B25',
    fontFamily: 'Satoshi',
  },
  buttonTextMobile: {
    fontSize: 16,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    width: '100%',
    fontFamily: 'Satoshi',
  },
  errorTextMobile: {
    fontSize: 12,
  },
});

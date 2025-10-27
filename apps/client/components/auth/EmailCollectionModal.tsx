import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';

interface EmailCollectionModalProps {
  visible: boolean;
  onSubmit: (email: string) => Promise<void>;
  onSignOut?: () => void; // Sign out callback
  walletAddress?: string;
}

/**
 * Email Collection Modal for Wallet Users
 * Asks wallet-authenticated users to provide email for Grid account creation
 */
export default function EmailCollectionModal({ visible, onSubmit, onSignOut, walletAddress }: EmailCollectionModalProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    console.log('📧 [Modal] handleSubmit called');
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      console.log('📧 [Modal] Invalid email format');
      setError('Please enter a valid email address');
      return;
    }

    try {
      console.log('📧 [Modal] Validation passed, calling onSubmit...');
      setIsSubmitting(true);
      setError(null);
      
      await onSubmit(email);
      
      console.log('📧 [Modal] ✅ onSubmit completed successfully');
      // Modal will be closed by parent changing visible prop
    } catch (err: any) {
      console.error('📧 [Modal] ❌ onSubmit failed:', err);
      setError(err.message || 'Failed to set up account');
    } finally {
      console.log('📧 [Modal] Setting isSubmitting to false');
      setIsSubmitting(false);
    }
  };

  const isWeb = Platform.OS === 'web';

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isWeb ? "fade" : "slide"}
    >
      <KeyboardAvoidingView 
        style={isWeb ? styles.webContainer : styles.mobileContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.backdrop} />
        <View style={isWeb ? styles.webContent : styles.mobileContent}>
          {/* Title */}
          <Text style={styles.title}>Set Up Your Wallet</Text>
          
          {/* Description */}
          <Text style={styles.description}>
            We'll send a verification code to your email to set up your embedded wallet. This enables seamless transactions without wallet popups.
          </Text>

          {/* Email Input */}
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor="#C95900"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            editable={!isSubmitting}
            autoFocus
          />

          {/* Helper Text */}
          <Text style={styles.helperText}>
            Your email will be securely linked to your embedded wallet address
          </Text>

          {/* Error Message */}
          {error && (
            <Text style={styles.error}>{error}</Text>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>

          {/* Sign Out Button */}
          {onSignOut && (
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={onSignOut}
              disabled={isSubmitting}
            >
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Mobile container (bottom sheet)
  mobileContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // Web container (center modal)
  webContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(4px)' as any, // Modern web blur effect
    }),
  },
  // Mobile content (bottom sheet style)
  mobileContent: {
    backgroundColor: '#E67B25',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  // Web content (center modal style)
  webContent: {
    backgroundColor: '#E67B25',
    borderRadius: 16,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2)' as any,
    elevation: 20, // Android shadow
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFEFE3',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'Belwe-Medium',
  },
  description: {
    fontSize: 16,
    color: '#F8CEAC',
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: 'Satoshi',
    lineHeight: 22,
  },
  input: {
    backgroundColor: '#FFEFE3',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Satoshi',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 14,
    color: '#F8CEAC',
    marginBottom: 24,
    fontFamily: 'Satoshi',
    textAlign: 'center',
  },
  error: {
    color: '#FF3B30',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'Satoshi',
  },
  button: {
    backgroundColor: '#FBAA69',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Satoshi',
  },
  signOutButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  signOutText: {
    color: '#F8CEAC',
    fontSize: 14,
    fontFamily: 'Satoshi',
  },
});


import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import OtpVerificationModal from '../grid/OtpVerificationModal';

interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * AuthGate - Simple authentication gate
 * 
 * Shows blocking OTP modal when needsReauth is true
 * Re-auth detection is handled manually, not automatically
 */
export default function AuthGate({ children }: AuthGateProps) {
  const { user, isLoading, needsReauth, isCheckingReauth, completeReauth } = useAuth();

  console.log('🚪 [AuthGate] Auth state:', {
    hasUser: !!user,
    isLoading,
    needsReauth,
    isCheckingReauth,
    userEmail: user?.email || 'none'
  });

  // Don't show loading here - let the main loading screen handle it
  // AuthGate only handles the blocking OTP modal when needed

  // If user needs wallet verification, show blocking OTP modal
  if (user && needsReauth) {
    return (
      <View style={styles.blockedContainer}>
        <View style={styles.blockedContent}>
          <Text style={styles.blockedTitle}>Wallet Verification Required</Text>
          <Text style={styles.blockedMessage}>
            Please verify your wallet to continue.
            Check your email for a verification code.
          </Text>
        </View>
        
        <OtpVerificationModal
          visible={true}
          onClose={completeReauth}
          userEmail={user.email || ''}
        />
      </View>
    );
  }

  // User is fully authenticated - show main app
  return <>{children}</>;
}

const styles = StyleSheet.create({
  blockedContainer: {
    flex: 1,
    backgroundColor: '#05080C',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  blockedContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    marginBottom: 20,
  },
  blockedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#DCE9FF',
    textAlign: 'center',
    marginBottom: 12,
  },
  blockedMessage: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});

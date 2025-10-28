import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import OtpVerificationModal from '../grid/OtpVerificationModal';
import { getDeviceInfo, isMobileDevice } from '../../lib/device/detection';

interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * AuthGate - Simple authentication gate
 * 
 * Shows blocking OTP modal when needsReauth is true (desktop)
 * Or navigates to OTP screen (mobile web)
 * Re-auth detection is handled manually, not automatically
 */
export default function AuthGate({ children }: AuthGateProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const deviceInfo = getDeviceInfo(width);
  const isMobile = isMobileDevice(deviceInfo);
  
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

  // If user needs wallet verification, navigate to OTP screen (mobile web) or show modal (desktop)
  useEffect(() => {
    if (user && needsReauth && isMobile && Platform.OS === 'web') {
      console.log('🔐 [AuthGate] Mobile web reauth needed - navigating to OTP screen');
      router.push('/(auth)/otp-verification');
    }
  }, [user, needsReauth, isMobile]);
  
  // If user needs wallet verification on desktop, show blocking OTP modal
  if (user && needsReauth && !(isMobile && Platform.OS === 'web')) {
    // Get gridUser from sessionStorage if available
    let gridUser = null;
    if (Platform.OS === 'web') {
      try {
        const stored = sessionStorage.getItem('gridUser');
        if (stored) {
          gridUser = JSON.parse(stored);
        }
      } catch (e) {
        console.error('Failed to parse gridUser from sessionStorage:', e);
      }
    }
    
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
          gridUser={gridUser}
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

import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useHasWallet } from '@/contexts/WalletAdapterContext';
import { useState } from 'react';
import { hasMultipleWallets, type DetectedWallet } from '@/features/auth/services/solana-wallet';
import WalletSelectorModal from './WalletSelectorModal';

interface WalletSignInButtonProps {
  onPress: (wallet?: DetectedWallet) => Promise<void>;
  disabled?: boolean;
  isMobile?: boolean;
}

/**
 * Wallet Sign-In Button
 * Shows "Connect Wallet" button
 * Opens wallet selector modal if multiple wallets detected
 * Only renders on web platform when wallet is detected
 */
export default function WalletSignInButton({ onPress, disabled, isMobile }: WalletSignInButtonProps) {
  const hasWallet = useHasWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [showWalletSelector, setShowWalletSelector] = useState(false);

  // Don't render on non-web platforms or if no wallet detected
  if (Platform.OS !== 'web' || !hasWallet) {
    return null;
  }

  const handlePress = async () => {
    try {
      // If multiple wallets, show selector modal
      if (hasMultipleWallets()) {
        setShowWalletSelector(true);
        return;
      }

      // Single wallet - connect directly
      setIsLoading(true);
      await onPress();
    } catch (error) {
      console.error('Wallet sign-in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWalletSelected = async (wallet: DetectedWallet) => {
    try {
      setIsLoading(true);
      await onPress(wallet);
    } catch (error) {
      console.error('Wallet sign-in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.walletButton, isMobile && styles.walletButtonMobile]}
        onPress={handlePress}
        disabled={disabled || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Text style={styles.walletIcon}>👛</Text>
            <Text style={styles.walletButtonText}>Connect Wallet</Text>
          </>
        )}
      </TouchableOpacity>

      <WalletSelectorModal
        visible={showWalletSelector}
        onClose={() => setShowWalletSelector(false)}
        onSelectWallet={handleWalletSelected}
      />
    </>
  );
}

const styles = StyleSheet.create({
  walletButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#512DA8', // Purple for wallet - distinct from white Google button
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
    minWidth: 250,
    marginTop: 12, // Space from Google button
  },
  walletButtonMobile: {
    borderRadius: 28,
    width: '100%',
    minWidth: 0,
    paddingVertical: 16,
  },
  walletIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  walletButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 4,
    fontFamily: 'Satoshi',
  },
});

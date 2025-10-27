import { Modal, View, Text, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import { getAllWallets, type DetectedWallet } from '@/features/auth/services/solana-wallet';

interface WalletSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectWallet: (wallet: DetectedWallet) => void;
}

/**
 * Wallet Selector Modal
 * Shows all detected Solana wallets and lets user choose
 */
export default function WalletSelectorModal({ visible, onClose, onSelectWallet }: WalletSelectorModalProps) {
  if (Platform.OS !== 'web') {
    return null;
  }

  const wallets = getAllWallets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.backdrop} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Connect Wallet</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Wallet List */}
            <View style={styles.walletList}>
              {wallets.map((detectedWallet, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.walletButton}
                  onPress={() => {
                    onSelectWallet(detectedWallet);
                    onClose();
                  }}
                >
                  {detectedWallet.icon ? (
                    <Image 
                      source={{ uri: detectedWallet.icon }} 
                      style={styles.walletIcon}
                      onError={() => console.log('Failed to load wallet icon')}
                    />
                  ) : (
                    <View style={styles.walletIconPlaceholder}>
                      <Text style={styles.walletIconText}>👛</Text>
                    </View>
                  )}
                  <Text style={styles.walletName}>{detectedWallet.name}</Text>
                  <Text style={styles.walletArrow}>→</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* No Wallets Message */}
            {wallets.length === 0 && (
              <View style={styles.noWallets}>
                <Text style={styles.noWalletsText}>No Solana wallet detected</Text>
                <Text style={styles.noWalletsSubtext}>
                  Please install Phantom, Solflare, or another Solana wallet extension
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 400,
  },
  modal: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Satoshi',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 24,
    color: '#888888',
  },
  walletList: {
    gap: 12,
  },
  walletButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  walletIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  walletIconPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    backgroundColor: '#3A3A3A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletIconText: {
    fontSize: 20,
  },
  walletName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    fontFamily: 'Satoshi',
  },
  walletArrow: {
    fontSize: 18,
    color: '#888888',
  },
  noWallets: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  noWalletsText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 8,
    fontFamily: 'Satoshi',
  },
  noWalletsSubtext: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    fontFamily: 'Satoshi',
  },
});


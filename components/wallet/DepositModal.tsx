import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Clipboard } from 'react-native';

interface DepositModalProps {
  visible: boolean;
  onClose: () => void;
  solanaAddress?: string;
}

export default function DepositModal({
  visible,
  onClose,
  solanaAddress
}: DepositModalProps) {
  const [addressCopied, setAddressCopied] = useState(false);

  const handleCopyAddress = async () => {
    if (solanaAddress) {
      try {
        Clipboard.setString(solanaAddress);
        setAddressCopied(true);
        setTimeout(() => setAddressCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy address:', error);
      }
    }
  };

  const formatAddress = (address: string | undefined): string => {
    if (!address) return 'Address not available';
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const isWeb = Platform.OS === 'web';

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isWeb ? "fade" : "slide"}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={isWeb ? styles.webContainer : styles.mobileContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.backdrop} />
        <View style={isWeb ? styles.webContent : styles.mobileContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Money</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#DCE9FF" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.description}>
            Transfer SOL to your wallet address below
          </Text>

          <View style={styles.addressContainer}>
            <View style={styles.addressBox}>
              <Text style={styles.addressLabel}>Your Solana Address</Text>
              <Text style={styles.addressText}>
                {formatAddress(solanaAddress)}
              </Text>
              <TouchableOpacity 
                style={styles.copyButton}
                onPress={handleCopyAddress}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={addressCopied ? "checkmark" : "copy-outline"} 
                  size={16} 
                  color={addressCopied ? "#00D4AA" : "#4A9EFF"} 
                />
                <Text style={[styles.copyButtonText, addressCopied && styles.copiedText]}>
                  {addressCopied ? "Copied!" : "Copy Address"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.instructionBox}>
            <Ionicons name="information-circle-outline" size={20} color="#4A9EFF" />
            <Text style={styles.instructionText}>
              Send SOL from any external Solana wallet to this address. Funds will appear in your wallet shortly after confirmation.
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.doneButton}
            onPress={onClose}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
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
      backdropFilter: 'blur(4px)',
    }),
  },
  // Mobile content (bottom sheet style)
  mobileContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  // Web content (center modal style)
  webContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#DCE9FF',
  },
  description: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 24,
  },
  addressContainer: {
    marginBottom: 24,
  },
  addressBox: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  addressLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  addressText: {
    fontSize: 16,
    fontFamily: 'Satoshi',
    color: '#DCE9FF',
    marginBottom: 16,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    borderRadius: 8,
  },
  copyButtonText: {
    fontSize: 14,
    color: '#4A9EFF',
    fontWeight: '500',
  },
  copiedText: {
    color: '#00D4AA',
  },
  instructionBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'flex-start',
    gap: 12,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  doneButton: {
    backgroundColor: '#4A9EFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

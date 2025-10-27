import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableButton } from '../ui/PressableButton';

interface TokenHolding {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenPfp: string;
  holdings: number;
  holdingsValue: number;
  decimals: number;
}

interface SendModalProps {
  visible: boolean;
  onClose: () => void;
  onSend: (recipientAddress: string, amount: string, tokenAddress?: string) => Promise<void>;
  holdings: TokenHolding[];
}

export default function SendModal({
  visible,
  onClose,
  onSend,
  holdings
}: SendModalProps) {
  // Filter and sort tokens by USD value (descending)
  const availableTokens = holdings
    .filter(h => h.holdings > 0)
    .sort((a, b) => b.holdingsValue - a.holdingsValue);

  const [selectedToken, setSelectedToken] = useState<TokenHolding | null>(null);
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  // Set initial token when modal opens or holdings change
  useEffect(() => {
    if (availableTokens.length > 0 && !selectedToken) {
      setSelectedToken(availableTokens[0]);
    }
  }, [availableTokens.length, visible]);

  const validateSolanaAddress = (address: string): boolean => {
    // Basic Solana address validation - should be 32-44 characters, base58 encoded
    const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return solanaAddressRegex.test(address);
  };

  const validateAmount = (amountStr: string): boolean => {
    if (!selectedToken) return false;
    const numAmount = parseFloat(amountStr);
    return !isNaN(numAmount) && numAmount > 0 && numAmount <= selectedToken.holdings;
  };

  const handleSend = async () => {
    console.log('💸 [SendModal] handleSend called', { recipientAddress, amount, selectedToken: selectedToken?.tokenSymbol });
    setError('');

    if (!selectedToken) {
      setError('Please select a token');
      return;
    }

    // Validation
    if (!recipientAddress.trim()) {
      console.log('❌ [SendModal] Validation failed: No recipient address');
      setError('Please enter a recipient address');
      return;
    }

    if (!validateSolanaAddress(recipientAddress.trim())) {
      console.log('❌ [SendModal] Validation failed: Invalid Solana address');
      setError('Please enter a valid Solana address');
      return;
    }

    if (!amount.trim()) {
      console.log('❌ [SendModal] Validation failed: No amount');
      setError('Please enter an amount');
      return;
    }

    if (!validateAmount(amount)) {
      console.log('❌ [SendModal] Validation failed: Invalid amount', { amount, availableBalance: selectedToken.holdings });
      setError(`Amount must be between 0 and ${selectedToken.holdings.toFixed(selectedToken.decimals)} ${selectedToken.tokenSymbol}`);
      return;
    }

    console.log('✅ [SendModal] Validation passed, executing send');
    
    // No confirmation alert - Grid auto-signs transactions
    setIsSending(true);
    try {
      // For SOL, pass undefined; for SPL tokens, pass token address
      const tokenAddress = selectedToken.tokenSymbol === 'SOL' ? undefined : selectedToken.tokenAddress;
      console.log('💸 [SendModal] Calling onSend:', { 
        recipientAddress: recipientAddress.trim(), 
        amount,
        tokenAddress 
      });
      await onSend(recipientAddress.trim(), amount, tokenAddress);
      console.log('✅ [SendModal] Send successful');
      
      // Reset form on success
      setRecipientAddress('');
      setAmount('');
      onClose();
    } catch (error) {
      console.error('❌ [SendModal] Send failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to send transaction');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    if (!isSending) {
      setRecipientAddress('');
      setAmount('');
      setError('');
      setShowTokenPicker(false);
      onClose();
    }
  };

  const setMaxAmount = () => {
    if (!selectedToken) return;
    // Grid handles fees automatically, so user can send full balance
    setAmount(selectedToken.holdings.toFixed(selectedToken.decimals));
  };

  const isWeb = Platform.OS === 'web';

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isWeb ? "fade" : "slide"}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        style={isWeb ? styles.webContainer : styles.mobileContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.backdrop} />
        <View style={isWeb ? styles.webContent : styles.mobileContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Send Token</Text>
            <TouchableOpacity onPress={handleClose} disabled={isSending}>
              <Ionicons name="close" size={24} color="#DCE9FF" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.description}>
            Send tokens to any Solana wallet address
          </Text>

          {/* Token Selector */}
          {selectedToken && (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Token</Text>
              <TouchableOpacity
                style={styles.tokenSelector}
                onPress={() => setShowTokenPicker(!showTokenPicker)}
                disabled={isSending}
              >
                <View style={styles.tokenSelectorContent}>
                  <Image source={{ uri: selectedToken.tokenPfp }} style={styles.tokenIcon} />
                  <View style={styles.tokenInfo}>
                    <Text style={styles.tokenSymbol}>{selectedToken.tokenSymbol}</Text>
                    <Text style={styles.tokenName}>{selectedToken.tokenName}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-down" size={20} color="#8E8E93" />
              </TouchableOpacity>

              {/* Token Picker Dropdown */}
              {showTokenPicker && (
                <View style={styles.tokenPickerDropdown}>
                  <ScrollView style={styles.tokenPickerScroll}>
                    {availableTokens.map((token) => (
                      <TouchableOpacity
                        key={token.tokenAddress}
                        style={[
                          styles.tokenOption,
                          selectedToken.tokenAddress === token.tokenAddress && styles.tokenOptionSelected
                        ]}
                        onPress={() => {
                          setSelectedToken(token);
                          setShowTokenPicker(false);
                          setAmount(''); // Clear amount when switching tokens
                        }}
                      >
                        <Image source={{ uri: token.tokenPfp }} style={styles.tokenIcon} />
                        <View style={styles.tokenOptionInfo}>
                          <Text style={styles.tokenOptionSymbol}>{token.tokenSymbol}</Text>
                          <Text style={styles.tokenOptionBalance}>
                            {token.holdings.toFixed(token.decimals)} (${token.holdingsValue.toFixed(2)})
                          </Text>
                        </View>
                        {selectedToken.tokenAddress === token.tokenAddress && (
                          <Ionicons name="checkmark" size={20} color="#4A9EFF" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* Balance Display */}
          {selectedToken && (
            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <Text style={styles.balanceAmount}>
                {selectedToken.holdings.toFixed(selectedToken.decimals)} {selectedToken.tokenSymbol}
              </Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Recipient Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter Solana address..."
              placeholderTextColor="#666"
              value={recipientAddress}
              onChangeText={setRecipientAddress}
              autoCapitalize="none"
              autoCorrect={false}
              multiline={false}
              editable={!isSending}
            />
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.amountHeader}>
              <Text style={styles.inputLabel}>
                Amount {selectedToken ? `(${selectedToken.tokenSymbol})` : ''}
              </Text>
              <TouchableOpacity onPress={setMaxAmount} disabled={isSending}>
                <Text style={styles.maxButton}>MAX</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor="#666"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              editable={!isSending}
            />
          </View>

          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null}

          <PressableButton
            fullWidth
            onPress={handleSend}
            loading={isSending}
            disabled={!selectedToken}
            style={styles.sendButton}
            textStyle={styles.sendButtonText}
          >
            Send {selectedToken?.tokenSymbol || 'Token'}
          </PressableButton>

          <PressableButton 
            variant="secondary"
            fullWidth
            onPress={handleClose}
            disabled={isSending}
            style={styles.cancelButton}
            textStyle={styles.cancelButtonText}
          >
            Cancel
          </PressableButton>
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
    marginBottom: 20,
  },
  balanceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DCE9FF',
    fontFamily: 'Satoshi',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#DCE9FF',
    marginBottom: 8,
    fontWeight: '500',
  },
  amountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  maxButton: {
    fontSize: 14,
    color: '#4A9EFF',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#DCE9FF',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  error: {
    color: '#FF3B30',
    fontSize: 14,
    marginBottom: 16,
  },
  sendButton: {
    backgroundColor: '#4A9EFF',
    borderRadius: 12,
    marginBottom: 12,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginBottom: 8,
  },
  cancelButtonText: {
    color: '#8E8E93',
    fontSize: 16,
  },
  // Token selector styles
  tokenSelector: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tokenSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tokenIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DCE9FF',
  },
  tokenName: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  tokenPickerDropdown: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  tokenPickerScroll: {
    maxHeight: 200,
  },
  tokenOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a',
  },
  tokenOptionSelected: {
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
  },
  tokenOptionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  tokenOptionSymbol: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DCE9FF',
  },
  tokenOptionBalance: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
});

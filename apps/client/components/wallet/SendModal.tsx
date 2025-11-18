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
  Image,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableButton } from '../ui/PressableButton';
import { useGasAbstraction, InsufficientBalanceError } from '../../contexts/GasAbstractionContext';
import { isGasAbstractionEnabled } from '../../lib/gasAbstraction';
import { gasTelemetry } from '../../lib/telemetry';
import { useRouter } from 'expo-router';

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
  
  // Gas abstraction
  const gasAbstractionEnabled = isGasAbstractionEnabled();
  // Hook always called (returns null if context not available)
  const gasAbstraction = useGasAbstraction();
  const [useGasless, setUseGasless] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState<{ usdc?: number; sol?: number } | null>(null);
  
  // Error state for specific error types (Task 12.4)
  const [errorType, setErrorType] = useState<'insufficient_balance' | 'service_unavailable' | 'prohibited' | 'validation' | null>(null);
  const [errorDetails, setErrorDetails] = useState<{ required?: number; available?: number } | null>(null);
  const router = useRouter();

  // Set initial token when modal opens or holdings change
  useEffect(() => {
    if (availableTokens.length > 0 && !selectedToken) {
      setSelectedToken(availableTokens[0]);
    }
  }, [availableTokens.length, visible]);
  
  // Initialize gasless mode from context when modal opens
  useEffect(() => {
    if (visible && gasAbstractionEnabled && gasAbstraction) {
      setUseGasless(gasAbstraction.gaslessEnabled);
    }
    // Clear error state when modal opens
    if (visible) {
      setError('');
      setErrorType(null);
      setErrorDetails(null);
    }
  }, [visible, gasAbstractionEnabled, gasAbstraction]);
  
  // Fetch estimated cost when amount or mode changes
  useEffect(() => {
    if (!visible || !amount || !selectedToken) {
      setEstimatedCost(null);
      return;
    }
    
    // For now, use fixed estimates
    // TODO: Fetch actual estimates from backend
    if (useGasless && gasAbstractionEnabled) {
      // Typical Solana transaction fee is ~0.000005 SOL = ~$0.0001 USDC
      // For gasless, estimate ~0.0001 USDC
      setEstimatedCost({ usdc: 0.0001 });
    } else {
      // SOL fee estimate: ~0.000005 SOL
      setEstimatedCost({ sol: 0.000005 });
    }
  }, [amount, useGasless, selectedToken, visible, gasAbstractionEnabled]);

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
    console.log('💸 [SendModal] handleSend called', { recipientAddress, amount, selectedToken: selectedToken?.tokenSymbol, useGasless });
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

    // Check gasless mode balance if enabled
    if (useGasless && gasAbstractionEnabled && gasAbstraction) {
      if (gasAbstraction.availableBalance < 0.0001) {
        setError('Insufficient gas credits. Please top up first.');
        return;
      }
    }

    console.log('✅ [SendModal] Validation passed, executing send');
    
    setIsSending(true);
    try {
      // For SOL, pass undefined; for SPL tokens, pass token address
      const tokenAddress = selectedToken.tokenSymbol === 'SOL' ? undefined : selectedToken.tokenAddress;
      
      // Use gasless endpoint if enabled
      if (useGasless && gasAbstractionEnabled && gasAbstraction) {
        console.log('💸 [SendModal] Using gasless transaction flow');
        
        // Import required modules
        const { generateAPIUrl } = await import('../../lib/api/client');
        const { storage, SECURE_STORAGE_KEYS } = await import('../../lib/storage');
        const { gridClientService } = await import('../../features/grid');
        
        // Get auth token and Grid account
        const token = await storage.persistent.getItem(SECURE_STORAGE_KEYS.AUTH_TOKEN);
        if (!token) {
          throw new Error('Not authenticated');
        }
        
        const account = await gridClientService.getAccount();
        if (!account) {
          throw new Error('Grid wallet not connected');
        }
        
        const sessionSecretsJson = await storage.persistent.getItem(SECURE_STORAGE_KEYS.GRID_SESSION_SECRETS);
        if (!sessionSecretsJson) {
          throw new Error('Grid session secrets not available');
        }
        
        const sessionSecrets = JSON.parse(sessionSecretsJson);
        const session = {
          authentication: account.authentication || account,
          address: account.address
        };
        
        // Call gasless endpoint
        const url = generateAPIUrl('/api/grid/send-tokens-gasless');
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            recipient: recipientAddress.trim(),
            amount,
            tokenMint: tokenAddress,
            sessionSecrets,
            session,
            address: account.address
          })
        });
        
        const result = await response.json();
        
        if (!result.success) {
          // Handle specific error types with detailed UI (Task 12.4)
          if (response.status === 402) {
            const required = result.data?.required || result.required || 0;
            const available = result.data?.available || result.available || 0;
            
            // Set error state for UI display
            setErrorType('insufficient_balance');
            setErrorDetails({ 
              required: required / 1_000_000, // Convert to USDC
              available: available / 1_000_000 
            });
            setError(`Insufficient gas credits. Available: ${(available / 1_000_000).toFixed(6)} USDC, Required: ${(required / 1_000_000).toFixed(6)} USDC.`);
            setIsSending(false);
            return;
          }
          
          if (response.status === 400 && (
            result.error?.toLowerCase().includes('prohibited') ||
            result.error?.toLowerCase().includes('closeaccount') ||
            result.error?.toLowerCase().includes('setauthority')
          )) {
            setErrorType('prohibited');
            setError('This operation is not supported by gas sponsorship.');
            setIsSending(false);
            return;
          }
          
          if (response.status === 503) {
            setErrorType('service_unavailable');
            setError('Gas sponsorship temporarily unavailable. Please retry or use SOL gas.');
            setIsSending(false);
            return;
          }
          
          // Other validation errors
          setErrorType('validation');
          setError(result.error || 'Gasless transaction failed');
          setIsSending(false);
          return;
        }
        
        console.log('✅ [SendModal] Gasless send successful:', result.signature);
        
        // Refresh balance after successful transaction
        if (gasAbstraction) {
          await gasAbstraction.refreshBalance();
        }
      } else {
        // Use regular send flow
        console.log('💸 [SendModal] Using regular transaction flow');
        await onSend(recipientAddress.trim(), amount, tokenAddress);
      }
      
      console.log('✅ [SendModal] Send successful');
      
      // Reset form on success
      setRecipientAddress('');
      setAmount('');
      setError('');
      setErrorType(null);
      setErrorDetails(null);
      onClose();
    } catch (error) {
      console.error('❌ [SendModal] Send failed:', error);
      
      // Handle specific error types (Task 12.4)
      if (error instanceof InsufficientBalanceError) {
        setErrorType('insufficient_balance');
        setErrorDetails({
          required: error.required / 1_000_000,
          available: error.available / 1_000_000
        });
        setError(`Insufficient gas credits. Available: ${(error.available / 1_000_000).toFixed(6)} USDC, Required: ${(error.required / 1_000_000).toFixed(6)} USDC.`);
      } else if (error instanceof Error) {
        const errorMessage = error.message;
        
        // Check for service unavailable error
        if ((error as any).isServiceUnavailable || errorMessage.includes('unavailable')) {
          setErrorType('service_unavailable');
          setError('Gas sponsorship temporarily unavailable. Please retry or use SOL gas.');
        } 
        // Check for prohibited instruction error
        else if (errorMessage.includes('not supported') || errorMessage.includes('prohibited')) {
          setErrorType('prohibited');
          setError('This operation is not supported by gas sponsorship.');
        }
        // Check for blockhash error
        else if ((error as any).isBlockhashError || errorMessage.includes('blockhash')) {
          setErrorType('validation');
          setError('Transaction blockhash expired. Please try again.');
        }
        // Other validation errors
        else {
          setErrorType('validation');
          setError(errorMessage);
        }
      } else {
        setErrorType('validation');
        setError('Failed to send transaction');
      }
      
      // If gasless failed, offer fallback to SOL
      if (useGasless && gasAbstractionEnabled) {
        // Error message already set, user can retry with SOL by disabling gasless mode
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    if (!isSending) {
      setRecipientAddress('');
      setAmount('');
      setError('');
      setErrorType(null);
      setErrorDetails(null);
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

          {/* Gasless Mode Toggle */}
          {gasAbstractionEnabled && gasAbstraction && (
            <View style={styles.gaslessContainer}>
              <View style={styles.gaslessRow}>
                <View style={styles.gaslessInfo}>
                  <Text style={styles.gaslessLabel}>Use Gas Credits</Text>
                  <Text style={styles.gaslessDescription}>
                    Pay transaction fees with USDC instead of SOL
                  </Text>
                </View>
                <Switch
                  value={useGasless && (gasAbstraction.availableBalance >= 0.0001)}
                  onValueChange={(value) => {
                    if (value && gasAbstraction.availableBalance < 0.0001) {
                      setError('Insufficient gas credits. Please top up first.');
                      return;
                    }
                    setUseGasless(value);
                    setError('');
                  }}
                  disabled={isSending || gasAbstraction.availableBalance < 0.0001}
                  trackColor={{ false: '#3a3a3a', true: '#4A9EFF' }}
                  thumbColor={useGasless ? '#fff' : '#f4f3f4'}
                />
              </View>
              {useGasless && (
                <Text style={styles.gaslessNote}>
                  This transaction's gas fee will be paid using your gas credits. You will be charged ~{estimatedCost?.usdc?.toFixed(6) || '0.0001'} USDC.
                </Text>
              )}
              {!useGasless && estimatedCost && (
                <Text style={styles.gaslessNote}>
                  Estimated SOL fee: ~{estimatedCost.sol?.toFixed(9) || '0.000005'} SOL
                </Text>
              )}
            </View>
          )}

          {/* Enhanced error handling UI (Task 12.4) */}
          {error && errorType && (
            <View style={styles.errorContainer}>
              <View style={styles.errorHeader}>
                <Ionicons name="alert-circle" size={20} color="#FF6B6B" />
                <Text style={styles.errorTitle}>
                  {errorType === 'insufficient_balance' && 'Insufficient Gas Credits'}
                  {errorType === 'service_unavailable' && 'Service Unavailable'}
                  {errorType === 'prohibited' && 'Operation Not Supported'}
                  {errorType === 'validation' && 'Transaction Error'}
                </Text>
              </View>
              
              <Text style={styles.error}>{error}</Text>
              
              {/* Insufficient balance: Show details and top-up button */}
              {errorType === 'insufficient_balance' && errorDetails && (
                <View style={styles.errorActions}>
                  <View style={styles.balanceDetails}>
                    <Text style={styles.balanceText}>
                      Current Balance: {errorDetails.available?.toFixed(6) || '0.000000'} USDC
                    </Text>
                    <Text style={styles.balanceText}>
                      Required: {errorDetails.required?.toFixed(6) || '0.000000'} USDC
                    </Text>
                  </View>
                  <PressableButton
                    variant="secondary"
                    onPress={() => {
                      onClose();
                      router.push('/(main)/gas-abstraction');
                    }}
                    style={styles.topupButton}
                  >
                    Top Up Gas Credits
                  </PressableButton>
                  <PressableButton
                    variant="secondary"
                    onPress={async () => {
                      // Log fallback to SOL
                      if (gasAbstraction) {
                        const { gridClientService } = await import('../../features/grid');
                        const account = await gridClientService.getAccount();
                        if (account?.address) {
                          await gasTelemetry.sponsorFallbackToSol(account.address);
                        }
                      }
                      // Retry with SOL gas
                      setUseGasless(false);
                      setError('');
                      setErrorType(null);
                      setErrorDetails(null);
                      // Retry send with SOL
                      handleSend();
                    }}
                    style={styles.fallbackButton}
                  >
                    Use SOL Instead
                  </PressableButton>
                </View>
              )}
              
              {/* Service unavailable: Show retry and fallback options */}
              {errorType === 'service_unavailable' && (
                <View style={styles.errorActions}>
                  <PressableButton
                    variant="secondary"
                    onPress={() => {
                      setError('');
                      setErrorType(null);
                      handleSend();
                    }}
                    style={styles.retryButton}
                  >
                    Retry
                  </PressableButton>
                  <PressableButton
                    variant="secondary"
                    onPress={async () => {
                      // Log fallback to SOL
                      if (gasAbstraction) {
                        const { gridClientService } = await import('../../features/grid');
                        const account = await gridClientService.getAccount();
                        if (account?.address) {
                          await gasTelemetry.sponsorFallbackToSol(account.address);
                        }
                      }
                      // Retry with SOL gas
                      setUseGasless(false);
                      setError('');
                      setErrorType(null);
                      handleSend();
                    }}
                    style={styles.fallbackButton}
                  >
                    Use SOL Instead
                  </PressableButton>
                </View>
              )}
              
              {/* Prohibited instruction: Show fallback option */}
              {errorType === 'prohibited' && (
                <View style={styles.errorActions}>
                  <PressableButton
                    variant="secondary"
                    onPress={async () => {
                      // Log fallback to SOL
                      if (gasAbstraction) {
                        const { gridClientService } = await import('../../features/grid');
                        const account = await gridClientService.getAccount();
                        if (account?.address) {
                          await gasTelemetry.sponsorFallbackToSol(account.address);
                        }
                      }
                      // Retry with SOL gas
                      setUseGasless(false);
                      setError('');
                      setErrorType(null);
                      handleSend();
                    }}
                    style={styles.fallbackButton}
                  >
                    Use SOL Instead
                  </PressableButton>
                </View>
              )}
              
              {/* Validation errors: Show retry option */}
              {errorType === 'validation' && (
                <View style={styles.errorActions}>
                  <PressableButton
                    variant="secondary"
                    onPress={() => {
                      setError('');
                      setErrorType(null);
                    }}
                    style={styles.retryButton}
                  >
                    Dismiss
                  </PressableButton>
                </View>
              )}
            </View>
          )}

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
  // Enhanced error handling UI styles (Task 12.4)
  errorContainer: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#2a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  errorActions: {
    marginTop: 12,
    gap: 8,
  },
  balanceDetails: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  balanceText: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
  },
  topupButton: {
    marginTop: 4,
  },
  retryButton: {
    marginTop: 4,
  },
  fallbackButton: {
    marginTop: 4,
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
  // Gasless mode styles
  gaslessContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  gaslessRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gaslessInfo: {
    flex: 1,
    marginRight: 12,
  },
  gaslessLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DCE9FF',
    marginBottom: 4,
  },
  gaslessDescription: {
    fontSize: 12,
    color: '#8E8E93',
  },
  gaslessNote: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
    marginTop: 4,
  },
});

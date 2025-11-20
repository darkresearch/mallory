/**
 * Gas Abstraction Screen
 * 
 * Screen for managing gas credits, top-ups, and transaction history.
 * 
 * Requirements: 2.3, 2.4, 2.5, 3.4, 3.5, 3.6, 3.7, 3.14, 4.7, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 14.1, 14.2
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGasAbstraction } from '../../contexts/GasAbstractionContext';
import { useGrid } from '../../contexts/GridContext';
import { PressableButton } from '../../components/ui/PressableButton';
import {
  getSuggestedTopupAmount,
  getMinTopupAmount,
  getMaxTopupAmount,
  validateTopupAmount,
} from '../../lib/gasAbstraction';
import { generateAPIUrl } from '../../lib/api/client';
import { storage, SECURE_STORAGE_KEYS } from '../../lib/storage';
import { config } from '../../lib/config';
import { gasTelemetry } from '../../lib/telemetry';
import { gridClientService } from '../../features/grid';

const SOLANA_EXPLORER_BASE = 'https://solscan.io/tx/';

export default function GasAbstractionScreen() {
  const router = useRouter();
  
  try {
    console.log('🔍 [GasAbstraction] Screen rendering...');
    const { gridAccount } = useGrid();
    console.log('🔍 [GasAbstraction] Grid account:', gridAccount?.address ? 'Found' : 'Missing');
    const {
    balance,
    balanceBaseUnits,
    balanceLoading,
    balanceError,
    balanceLastFetched,
    pendingAmount,
    availableBalance,
    topups,
    usages,
    gaslessEnabled,
    lowBalanceThreshold,
    isLowBalance,
    refreshBalance,
    toggleGaslessMode,
  } = useGasAbstraction() || {
    balance: null,
    balanceBaseUnits: null,
    balanceLoading: false,
    balanceError: null,
    balanceLastFetched: null,
    pendingAmount: 0,
    availableBalance: 0,
    topups: [],
    usages: [],
    gaslessEnabled: false,
    lowBalanceThreshold: 0.1,
    isLowBalance: false,
    refreshBalance: async () => {},
    initiateTopup: async () => {},
    sponsorTransaction: async () => { throw new Error('Not available'); },
    toggleGaslessMode: () => {},
    isBalanceStale: () => true,
    hasInsufficientBalance: () => false,
  };

  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState<string>('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupRequirements, setTopupRequirements] = useState<any>(null);
  const [topupError, setTopupError] = useState<string | null>(null);

  // Load balance on mount
  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  // Fetch top-up requirements when modal opens
  useEffect(() => {
    if (showTopupModal && !topupRequirements) {
      fetchTopupRequirements();
    }
  }, [showTopupModal]);

  const fetchTopupRequirements = async () => {
    try {
      const token = await storage.persistent.getItem(SECURE_STORAGE_KEYS.AUTH_TOKEN);
      if (!token) {
        throw new Error('Not authenticated');
      }

      const url = generateAPIUrl('/api/gas-abstraction/topup/requirements');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to fetch top-up requirements');
      }

      const requirements = await response.json();
      
      // Log received requirements for debugging
      console.log('📋 [GasAbstraction] Received top-up requirements:', {
        hasPayTo: !!requirements.payTo,
        payTo: requirements.payTo,
        network: requirements.network,
        asset: requirements.asset,
        maxAmountRequired: requirements.maxAmountRequired,
        keys: Object.keys(requirements)
      });
      
      // Validate required fields
      if (!requirements.payTo) {
        console.error('❌ [GasAbstraction] Missing payTo in requirements:', requirements);
        throw new Error('Gateway did not provide payment address. Please contact support or try again later.');
      }
      
      if (!requirements.network) {
        throw new Error('Gateway did not provide network information');
      }
      
      if (!requirements.asset) {
        throw new Error('Gateway did not provide asset information');
      }
      
      setTopupRequirements(requirements);
      
      // Set default amount from maxAmountRequired
      if (requirements.maxAmountRequired) {
        const defaultAmount = requirements.maxAmountRequired / 1_000_000;
        setTopupAmount(defaultAmount.toFixed(2));
      } else {
        setTopupAmount(getSuggestedTopupAmount().toFixed(2));
      }
    } catch (error) {
      console.error('❌ [GasAbstraction] Failed to fetch top-up requirements:', error);
      setTopupError(error instanceof Error ? error.message : 'Failed to load top-up requirements');
    }
  };

  const handleTopup = async () => {
    if (!topupAmount || !topupRequirements) return;

    const amount = parseFloat(topupAmount);
    if (!validateTopupAmount(amount)) {
      Alert.alert(
        'Invalid Amount',
        `Amount must be between ${getMinTopupAmount()} and ${getMaxTopupAmount()} USDC`
      );
      return;
    }

    setTopupLoading(true);
    setTopupError(null);

    try {
      // Validate gridAccount is available
      if (!gridAccount?.address) {
        throw new Error('Grid wallet not connected');
      }

      // Validate network and asset match
      if (topupRequirements.network !== 'solana-mainnet-beta') {
        throw new Error('Network mismatch. Expected solana-mainnet-beta');
      }

      // Validate payTo address is present
      if (!topupRequirements.payTo) {
        throw new Error('Payment address not provided by gateway');
      }

      // Get USDC mint from config
      const usdcMint = process.env.EXPO_PUBLIC_GAS_GATEWAY_USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
      if (topupRequirements.asset !== usdcMint) {
        throw new Error('Asset mismatch. Expected USDC');
      }

      console.log('💰 [GasAbstraction] Creating USDC transfer for x402 payment', {
        amount,
        recipient: topupRequirements.payTo,
        tokenMint: usdcMint,
      });

      // Calculate amount in base units
      const amountBaseUnits = Math.floor(amount * 1_000_000);
      
      // Per requirements 3.7-3.10: Create USDC transfer from Grid wallet to gateway
      // Then sign with Grid (which triggers Privy approval)
      console.log('📝 [GasAbstraction] Creating USDC transfer transaction from Grid wallet...');
      
      const { Connection, PublicKey, TransactionMessage, VersionedTransaction } = await import('@solana/web3.js');
      const { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
      
      // RPC endpoints with fallbacks
      // Alchemy URLs are loaded from environment variables (secrets)
      const alchemyRpc1 = process.env.EXPO_PUBLIC_SOLANA_RPC_ALCHEMY_1;
      const alchemyRpc2 = process.env.EXPO_PUBLIC_SOLANA_RPC_ALCHEMY_2;
      const alchemyRpc3 = process.env.EXPO_PUBLIC_SOLANA_RPC_ALCHEMY_3;
      
      const rpcEndpoints = [
        process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        // Only include Alchemy endpoints if API keys are provided
        ...(alchemyRpc1 ? [alchemyRpc1] : []),
        ...(alchemyRpc2 ? [alchemyRpc2] : []),
        ...(alchemyRpc3 ? [alchemyRpc3] : []),
        // Public fallback endpoint
        'https://api.mainnet-beta.solana.com',
      ].filter(Boolean); // Remove any undefined/null values
      
      // Try each RPC endpoint until one works
      let connection: Connection | null = null;
      let blockhash: string | null = null;
      let lastError: Error | null = null;
      
      for (const endpoint of rpcEndpoints) {
        try {
          console.log(`🔗 [GasAbstraction] Trying RPC endpoint: ${endpoint.substring(0, 50)}...`);
          const testConnection = new Connection(endpoint, 'confirmed');
          
          // Test with a quick call
          const testBlockhash = await Promise.race([
            testConnection.getLatestBlockhash('confirmed'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('RPC timeout')), 5000))
          ]) as { blockhash: string };
          
          connection = testConnection;
          blockhash = testBlockhash.blockhash;
          console.log(`✅ [GasAbstraction] Connected to RPC: ${endpoint.substring(0, 50)}...`);
          break;
        } catch (error) {
          console.warn(`⚠️ [GasAbstraction] RPC endpoint failed: ${endpoint.substring(0, 50)}...`, error);
          lastError = error instanceof Error ? error : new Error(String(error));
          continue;
        }
      }
      
      if (!connection || !blockhash) {
        throw new Error(`All RPC endpoints failed. Last error: ${lastError?.message || 'Unknown'}`);
      }
      const userPubkey = new PublicKey(gridAccount.address);
      const payToPubkey = new PublicKey(topupRequirements.payTo);
      const usdcMintPubkey = new PublicKey(usdcMint);
      
      // Get token accounts
      const userTokenAccount = await getAssociatedTokenAddress(
        usdcMintPubkey,
        userPubkey,
        true // allowOwnerOffCurve for Grid PDA
      );
      
      const payToTokenAccount = await getAssociatedTokenAddress(
        usdcMintPubkey,
        payToPubkey,
        true // allowOwnerOffCurve
      );
      
      // Create transfer instruction (per requirement 3.7)
      const transferInstruction = createTransferInstruction(
        userTokenAccount,
        payToTokenAccount,
        userPubkey,
        amountBaseUnits,
        [],
        TOKEN_PROGRAM_ID
      );
      
      // Build transaction (per requirement 3.7)
      const message = new TransactionMessage({
        payerKey: userPubkey,
        recentBlockhash: blockhash,
        instructions: [transferInstruction],
      }).compileToV0Message();
      
      const transaction = new VersionedTransaction(message);
      const unsignedSerialized = Buffer.from(transaction.serialize()).toString('base64');
      
      console.log('✅ [GasAbstraction] Transaction created, requesting signature from Grid...');
      
      // Serialize unsigned transaction
      const unsignedTransaction = Buffer.from(transaction.serialize()).toString('base64');
      
      // Sign transaction via backend (per requirement 3.9)
      // Backend will use Grid to sign but NOT submit (for x402 gateway)
      const signUrl = generateAPIUrl('/api/grid/sign-transaction');
      const token = await storage.persistent.getItem(SECURE_STORAGE_KEYS.AUTH_TOKEN);
      
      // Get Grid session data
      const sessionSecretsJson = await storage.persistent.getItem(SECURE_STORAGE_KEYS.GRID_SESSION_SECRETS);
      const accountJson = await storage.persistent.getItem(SECURE_STORAGE_KEYS.GRID_ACCOUNT);
      
      if (!sessionSecretsJson || !accountJson) {
        throw new Error('Grid session not found. Please reconnect your wallet.');
      }
      
      const sessionSecrets = JSON.parse(sessionSecretsJson);
      const account = JSON.parse(accountJson);
      
      console.log('📤 [GasAbstraction] Sending transaction to backend for signing...');
      
      const signResponse = await fetch(signUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          transaction: unsignedTransaction,
          sessionSecrets,
          session: account.authentication,
          address: gridAccount.address,
        }),
      });
      
      if (!signResponse.ok) {
        const errorData = await signResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to sign transaction');
      }
      
      const signResult = await signResponse.json();
      
      if (!signResult.success || !signResult.signedTransaction) {
        throw new Error(signResult.error || 'Failed to get signed transaction from backend');
      }
      
      const signedTransaction = signResult.signedTransaction;
      console.log('✅ [GasAbstraction] Transaction signed by Grid');
      
      // Note: The transaction may have been submitted by Grid SDK (signAndSend)
      // The x402 gateway can verify transactions that are already on-chain
      // We'll wait a moment for the transaction to be confirmed before sending to gateway
      console.log('⏳ [GasAbstraction] Waiting for transaction confirmation...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for confirmation
      
      // Per requirement 3.11-3.12: Construct x402 payment payload
      // The payment payload must match the gateway spec exactly
      // Use the scheme from the requirements - gateway returns "exact" in accepts array
      // We should match what the gateway expects
      console.log('📦 [GasAbstraction] Constructing x402 payment payload...');
      const scheme = topupRequirements.scheme || (topupRequirements.accepts && topupRequirements.accepts[0]?.scheme) || 'solana';
      
      const paymentPayload = {
        x402Version: topupRequirements.x402Version,
        scheme: scheme, // Use scheme from requirements (gateway returns "exact")
        network: topupRequirements.network,
        asset: topupRequirements.asset,
        payload: {
          transaction: signedTransaction, // Base64-encoded signed transaction
          publicKey: gridAccount.address, // Base58 user public key
        },
      };
      
      // Base64-encode the payment payload (per requirement 3.12)
      const paymentBase64 = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
      console.log('✅ [GasAbstraction] x402 Payment payload constructed and encoded');
      
      // Submit to backend (per requirement 3.13)
      const topupUrl = generateAPIUrl('/api/gas-abstraction/topup');
      
      console.log('📤 [GasAbstraction] Submitting payment to gateway...');
      const response = await fetch(topupUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          payment: paymentBase64, // Base64-encoded x402 payment payload (per requirement 3.12-3.13)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [GasAbstraction] Top-up failed:', {
          status: response.status,
          error: errorData.error,
          message: errorData.message,
          data: errorData.data,
        });
        
        const error = new Error(errorData.error || errorData.message || 'Top-up failed');
        (error as any).status = response.status; // Attach status for telemetry
        
        // Provide more specific error messages
        if (response.status === 402) {
          // 402 Payment Required - gateway couldn't verify the payment
          if (errorData.data && (errorData.data.required || errorData.data.available)) {
            // This is actually an insufficient balance error (wrong status code from gateway)
            throw new Error(`Insufficient balance. Available: ${(errorData.data.available || 0) / 1_000_000} USDC, Required: ${(errorData.data.required || 0) / 1_000_000} USDC`);
          } else {
            // Payment verification failed
            throw new Error('Payment verification failed. The gateway could not verify your USDC transfer. Please ensure the transaction was confirmed on-chain and try again.');
          }
        } else if (response.status === 400) {
          // 400 Bad Request - validation error
          throw new Error(errorData.message || errorData.error || 'Invalid payment. Please check the transaction and try again.');
        } else if (response.status === 503) {
          // 503 Service Unavailable
          throw new Error('Gas gateway is temporarily unavailable. Please try again in a few moments.');
        }
        
        throw error;
      }

      const result = await response.json();
      
      // Log top-up success
      if (gridAccount?.address && result.amountBaseUnits !== undefined) {
        await gasTelemetry.topupSuccess(gridAccount.address, result.amountBaseUnits);
      }
      
      Alert.alert(
        'Top-up Successful',
        `+${amount.toFixed(6)} USDC added to gas credits.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowTopupModal(false);
              refreshBalance();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Top-up failed:', error);
      
      // Log top-up failure
      if (gridAccount?.address) {
        const errorCode = (error as any)?.status || 
          (error instanceof Error && error.message.includes('status')
            ? parseInt(error.message.match(/status[:\s]+(\d+)/)?.[1] || '500')
            : 500);
        await gasTelemetry.topupFailure(gridAccount.address, errorCode);
      }
      
      setTopupError(error instanceof Error ? error.message : 'Top-up failed, please try again later');
    } finally {
      setTopupLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const openSolanaExplorer = (signature: string) => {
    const url = `${SOLANA_EXPLORER_BASE}${signature}`;
    Linking.openURL(url);
  };

  const suggestedAmounts = [0.5, 1, 5, 10];

  console.log('🔍 [GasAbstraction] Render state:', {
    hasGridAccount: !!gridAccount?.address,
    balance,
    balanceLoading,
    balanceError,
  });

  // Early return if Grid account is not available
  if (!gridAccount?.address) {
    console.warn('⚠️ [GasAbstraction] No Grid account, showing error message');
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FBAA69" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gas Credits</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            Please connect your Grid wallet to use gas credits.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FBAA69" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gas Credits</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Explanatory Text */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="#4A9EFF" />
          <Text style={styles.infoText}>
            Gas credits are USDC you pre-pay so Mallory can cover your Solana network fees.
          </Text>
        </View>

        {/* Low Balance Warning Banner */}
        {isLowBalance && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={20} color="#FF6B6B" />
            <Text style={styles.warningText}>
              You have {'<'}0.1 USDC gas credits left. Top up now to avoid failures.
            </Text>
            <PressableButton
              variant="secondary"
              size="small"
              onPress={() => setShowTopupModal(true)}
            >
              Top Up
            </PressableButton>
          </View>
        )}

        {/* Balance Display */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceValue}>
            {balance !== null ? balance.toFixed(6) : '0.000000'} USDC
          </Text>
          
          {pendingAmount > 0 && (
            <View style={styles.pendingRow}>
              <Text style={styles.pendingLabel}>Pending:</Text>
              <Text style={styles.pendingValue}>-{pendingAmount.toFixed(6)} USDC</Text>
            </View>
          )}
          
          <View style={styles.availableRow}>
            <Text style={styles.availableLabel}>Available:</Text>
            <Text style={styles.availableValue}>{availableBalance.toFixed(6)} USDC</Text>
          </View>

          {balanceError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{balanceError}</Text>
              {balanceLastFetched && (
                <Text style={styles.lastFetchedText}>
                  Last updated: {formatDate(balanceLastFetched.toISOString())}
                </Text>
              )}
            </View>
          )}

          <View style={styles.balanceActions}>
            <PressableButton
              variant="ghost"
              size="small"
              onPress={refreshBalance}
              disabled={balanceLoading}
              icon={<Ionicons name="refresh" size={16} color="#4A9EFF" />}
            >
              Refresh
            </PressableButton>
            <PressableButton
              variant="primary"
              size="medium"
              onPress={() => setShowTopupModal(true)}
              fullWidth
            >
              Top Up
            </PressableButton>
          </View>
        </View>

        {/* Gasless Mode Toggle */}
        <View style={styles.settingsCard}>
          <Text style={styles.settingsTitle}>Settings</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabel}>
              <Text style={styles.toggleText}>Gasless Mode</Text>
              <Text style={styles.toggleDescription}>
                Use gas credits instead of SOL for transaction fees
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, gaslessEnabled && styles.toggleActive]}
              onPress={() => toggleGaslessMode(!gaslessEnabled)}
            >
              <View style={[styles.toggleThumb, gaslessEnabled && styles.toggleThumbActive]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Transaction History */}
        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>Transaction History</Text>
          
          {/* Top-ups */}
          {topups.length > 0 && (
            <View style={styles.historySection}>
              <Text style={styles.historySectionTitle}>Top-ups</Text>
              {topups.map((topup) => (
                <TouchableOpacity
                  key={topup.paymentId}
                  style={styles.historyItem}
                  onPress={() => openSolanaExplorer(topup.txSignature)}
                >
                  <View style={styles.historyItemLeft}>
                    <Ionicons name="arrow-down-circle" size={20} color="#00D4AA" />
                    <View style={styles.historyItemDetails}>
                      <Text style={styles.historyItemAmount}>
                        +{(topup.amountBaseUnits / 1_000_000).toFixed(6)} USDC
                      </Text>
                      <Text style={styles.historyItemDate}>{formatDate(topup.timestamp)}</Text>
                    </View>
                  </View>
                  <Ionicons name="open-outline" size={16} color="#4A9EFF" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Usages */}
          {usages.length > 0 && (
            <View style={styles.historySection}>
              <Text style={styles.historySectionTitle}>Sponsored Transactions</Text>
              {usages.map((usage, index) => (
                <TouchableOpacity
                  key={`${usage.txSignature}-${index}`}
                  style={styles.historyItem}
                  onPress={() => openSolanaExplorer(usage.txSignature)}
                >
                  <View style={styles.historyItemLeft}>
                    <Ionicons
                      name={
                        usage.status === 'settled'
                          ? 'checkmark-circle'
                          : usage.status === 'failed'
                          ? 'close-circle'
                          : 'time-outline'
                      }
                      size={20}
                      color={
                        usage.status === 'settled'
                          ? '#00D4AA'
                          : usage.status === 'failed'
                          ? '#FF6B6B'
                          : '#FFA500'
                      }
                    />
                    <View style={styles.historyItemDetails}>
                      <Text style={styles.historyItemAmount}>
                        -{(usage.amountBaseUnits / 1_000_000).toFixed(6)} USDC
                        {usage.status === 'failed' && ' [↩] Refunded gas for failed transaction'}
                      </Text>
                      <Text style={styles.historyItemDate}>
                        {formatDate(usage.timestamp)} • {usage.status}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="open-outline" size={16} color="#4A9EFF" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {topups.length === 0 && usages.length === 0 && (
            <Text style={styles.emptyHistory}>No transactions yet</Text>
          )}
        </View>

        {/* Refund Footnote */}
        <View style={styles.footnoteBox}>
          <Text style={styles.footnoteText}>
            Failed or expired transactions are automatically refunded within 2 minutes.
          </Text>
        </View>
      </ScrollView>

      {/* Top-up Modal */}
      <Modal
        visible={showTopupModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTopupModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalBackdrop} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Top Up Gas Credits</Text>
              <TouchableOpacity
                onPress={() => setShowTopupModal(false)}
                disabled={topupLoading}
              >
                <Ionicons name="close" size={24} color="#DCE9FF" />
              </TouchableOpacity>
            </View>

            {topupError && (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>{topupError}</Text>
              </View>
            )}

            {topupRequirements && (
              <>
                <Text style={styles.modalLabel}>Amount (USDC)</Text>
                
                {/* Suggested Amounts */}
                <View style={styles.suggestedAmounts}>
                  {suggestedAmounts.map((amount) => (
                    <PressableButton
                      key={amount}
                      variant="ghost"
                      size="small"
                      onPress={() => setTopupAmount(amount.toFixed(2))}
                    >
                      {`${amount} USDC`}
                    </PressableButton>
                  ))}
                </View>

                <TextInput
                  style={styles.amountInput}
                  value={topupAmount}
                  onChangeText={setTopupAmount}
                  placeholder="Enter amount"
                  keyboardType="decimal-pad"
                  editable={!topupLoading}
                />

                <Text style={styles.amountHint}>
                  Min: {getMinTopupAmount()} USDC • Max: {getMaxTopupAmount()} USDC
                </Text>

                {topupAmount && parseFloat(topupAmount) > 0 && (
                  <View style={styles.reviewBox}>
                    <Text style={styles.reviewText}>
                      You will send {parseFloat(topupAmount).toFixed(6)} USDC to purchase gas credits. Fees may apply.
                    </Text>
                  </View>
                )}

                <PressableButton
                  variant="primary"
                  size="large"
                  fullWidth
                  onPress={handleTopup}
                  loading={topupLoading}
                  disabled={!topupAmount || parseFloat(topupAmount) <= 0 || topupLoading}
                >
                  {topupLoading ? 'Processing...' : 'Top Up'}
                </PressableButton>
              </>
            )}

            {!topupRequirements && !topupError && (
              <ActivityIndicator size="large" color="#4A9EFF" />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
  } catch (error) {
    console.error('❌ [GasAbstraction] Rendering error:', error);
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FBAA69" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gas Credits</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            Error loading gas credits screen: {error instanceof Error ? error.message : 'Unknown error'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFEFE3',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFEFE3',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212121',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 20,
    fontWeight: '500',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#E65100',
    fontWeight: '500',
  },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
    fontWeight: '500',
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 12,
  },
  pendingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pendingLabel: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  pendingValue: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '600',
  },
  availableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  availableLabel: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  availableValue: {
    fontSize: 14,
    color: '#00C853',
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EF5350',
  },
  errorText: {
    fontSize: 12,
    color: '#C62828',
    fontWeight: '500',
  },
  lastFetchedText: {
    fontSize: 11,
    color: '#757575',
    marginTop: 4,
  },
  balanceActions: {
    gap: 8,
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    flex: 1,
    marginRight: 12,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 16,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#4A9EFF',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 16,
  },
  historySection: {
    marginBottom: 20,
  },
  historySectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  historyItemDetails: {
    marginLeft: 12,
    flex: 1,
  },
  historyItemAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
    marginBottom: 4,
  },
  historyItemDate: {
    fontSize: 12,
    color: '#757575',
  },
  emptyHistory: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
  footnoteBox: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  footnoteText: {
    fontSize: 12,
    color: '#616161',
    textAlign: 'center',
    lineHeight: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212121',
  },
  modalErrorBox: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  modalErrorText: {
    fontSize: 14,
    color: '#C62828',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
    marginBottom: 8,
  },
  suggestedAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: '#BDBDBD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    color: '#212121',
  },
  amountHint: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 16,
  },
  reviewBox: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  reviewText: {
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 20,
    fontWeight: '500',
  },
});


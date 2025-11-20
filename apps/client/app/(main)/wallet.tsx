import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  runOnJS,
  Easing 
} from 'react-native-reanimated';
import { Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Clipboard } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useWallet } from '../../contexts/WalletContext';
import { useGrid } from '../../contexts/GridContext';
import { useTransactionGuard } from '../../hooks/useTransactionGuard';
import { WalletItem } from '../../components/wallet/WalletItem';
import DepositModal from '../../components/wallet/DepositModal';
import SendModal from '../../components/wallet/SendModal';
import { sendToken } from '../../features/wallet';
import { walletService } from '../../features/wallet';
import { SESSION_STORAGE_KEYS, storage, getAppVersion } from '../../lib';
import { isGasAbstractionEnabled } from '../../lib/gasAbstraction';


export default function WalletScreen() {
  const router = useRouter();
  const { user, logout, triggerReauth } = useAuth();
  const { gridAccount, solanaAddress } = useGrid();
  const { ensureGridSession } = useTransactionGuard();
  const translateX = useSharedValue(Dimensions.get('window').width);
  const [addressCopied, setAddressCopied] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [pendingSend, setPendingSend] = useState<{ recipientAddress: string; amount: string; tokenAddress?: string } | null>(null);

  // Load pending send from storage on mount
  useEffect(() => {
    const loadPendingSend = async () => {
      const stored = await storage.session.getItem(SESSION_STORAGE_KEYS.PENDING_SEND);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          console.log('🔄 [WalletScreen] Restored pending send from storage:', parsed);
          setPendingSend(parsed);
        } catch (error) {
          console.error('❌ [WalletScreen] Failed to parse stored pending send:', error);
          await storage.session.removeItem(SESSION_STORAGE_KEYS.PENDING_SEND);
        }
      }
    };
    loadPendingSend();
  }, []);
  
  console.log('🏠 [WalletScreen] Component rendering', {
    hasUser: !!user,
    userId: user?.id || 'missing',
    userEmail: user?.email || 'missing',
    userKeys: user ? Object.keys(user) : 'no user'
  });
  
  // Use wallet context (data loaded in background)
  const { walletData, isLoading, isRefreshing, error, refreshWalletData, clearError } = useWallet();

  
  console.log('🏠 [WalletScreen] Hook data', { 
    hasWalletData: !!walletData, 
    isLoading, 
    isRefreshing,
    error: error || 'none',
    totalBalance: walletData?.totalBalance,
    holdingsCount: walletData?.holdings?.length 
  });


  // Function to format wallet address
  const formatWalletAddress = (address: string | undefined): string => {
    if (!address) return 'No wallet connected';
    return `${address.slice(0, 5)}...${address.slice(-5)}`;
  };


  const handleAddMoney = () => {
    console.log('Add Money pressed');
    setShowDepositModal(true);
  };

  const handleSendMoney = () => {
    console.log('Send pressed');
    setShowSendModal(true);
  };


  const handleSendToken = async (recipientAddress: string, amount: string, tokenAddress?: string) => {
    console.log('💸 [WalletScreen] handleSendToken called:', { recipientAddress, amount, tokenAddress });
    
    // Check Grid session before transaction
    const canProceed = await ensureGridSession(
      'send transaction',
      '/(main)/chat',
      '#FFEFE3', // Chat screen background
      '#000000'  // Black text on cream background
    );
    
    if (!canProceed) {
      // User being redirected to OTP, save pending action
      console.log('💸 [WalletScreen] Grid session required, saving pending send');
      const pendingSendData = { recipientAddress, amount, tokenAddress };
      setPendingSend(pendingSendData);
      
      // Persist to storage to survive navigation
      await storage.session.setItem(SESSION_STORAGE_KEYS.PENDING_SEND, JSON.stringify(pendingSendData));
      console.log('💾 [WalletScreen] Saved pending send to storage');
      
      setShowSendModal(false); // Close modal while redirecting
      return;
    }
    
    // Grid session valid, proceed with transaction
    try {
      const result = await sendToken(recipientAddress, amount, tokenAddress);
      console.log('💸 [WalletScreen] sendToken result:', result);
      
      if (result.success) {
        console.log('✅ [WalletScreen] Send successful, closing modal and refreshing wallet');
        setShowSendModal(false);
        refreshWalletData();
      } else {
        throw new Error(result.error || 'Transfer failed');
      }
    } catch (error) {
      console.error('❌ [WalletScreen] Send token failed:', error);
      throw error; // Re-throw so SendModal can handle loading state and show error
    }
  };

  // Resume pending send after OTP completion
  useEffect(() => {
    if (pendingSend && gridAccount) {
      console.log('✅ [WalletScreen] Grid session restored, resuming pending transaction');
      const { recipientAddress, amount, tokenAddress } = pendingSend;
      
      // Execute the pending send
      sendToken(recipientAddress, amount, tokenAddress)
        .then((result) => {
          if (result.success) {
            console.log('✅ [WalletScreen] Pending send successful');
            refreshWalletData();
          } else {
            console.error('❌ [WalletScreen] Pending send failed:', result.error);
          }
        })
        .catch((error) => {
          console.error('❌ [WalletScreen] Pending send error:', error);
        })
        .finally(async () => {
          setPendingSend(null);
          // Clear from storage after completion
          await storage.session.removeItem(SESSION_STORAGE_KEYS.PENDING_SEND);
          console.log('🧹 [WalletScreen] Cleared pending send from storage');
        });
    }
  }, [gridAccount, pendingSend]);

  // Get SOL balance from wallet data
  const getSolBalance = (): number => {
    if (!walletData?.holdings) return 0;
    const solHolding = walletData.holdings.find((h: any) => h.tokenSymbol === 'SOL');
    return solHolding?.holdings || 0;
  };

  const handleCopyAddress = async () => {
    const address = gridAccount?.address || solanaAddress || user?.solanaAddress;
    if (address) {
      try {
        Clipboard.setString(address);
        setAddressCopied(true);
        setTimeout(() => setAddressCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy address:', error);
      }
    }
  };

  useEffect(() => {
    // Slide in from right with modern easing
    translateX.value = withTiming(0, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, []);

  const handleBack = () => {
    // Slide out to right with callback
    translateX.value = withTiming(
      Dimensions.get('window').width,
      {
        duration: 350,
        easing: Easing.in(Easing.cubic),
      },
      () => {
        // Navigate directly to chat instead of router.back() to avoid issues with empty history stack
        runOnJS(() => router.push('/(main)/chat'))();
      }
    );
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  // If no user, show nothing while AuthContext handles redirect
  if (!user) {
    return null;
  }

  return (
    <Animated.View style={[styles.outerContainer, animatedStyle]}>
      <SafeAreaView style={styles.wideContainer} edges={['top']}>
        {/* Header with back navigation - uses wide container like other screens */}
        <View style={styles.header}>
          {/* Back arrow positioned on the left for intuitive navigation back to main */}
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBack}
          >
            <Ionicons name="arrow-back" size={24} color="#FBAA69" />
          </TouchableOpacity>
        </View>

        {/* Narrow container for wallet content */}
        <View style={styles.container}>
          {/* Wallet Content */}
          <View style={styles.content}>
          {/* Wallet Header Section - Fixed */}
          <View style={styles.walletHeader}>
            {/* Profile Picture */}
            <View style={styles.profileSection}>
              {user?.profilePicture ? (
                <View
                  style={[styles.profileGradientBorder, { backgroundColor: '#E67B25' }]}
                >
                  <Image 
                    source={{ uri: user.profilePicture }} 
                    style={styles.profilePicture}
                  />
                </View>
              ) : (
                <View
                  style={[styles.profileGradientBorder, { backgroundColor: '#E67B25' }]}
                >
                  <View style={styles.profilePicturePlaceholder}>
                    <Ionicons name="person" size={32} color="#8E8E93" />
                  </View>
                </View>
              )}
            </View>

            {/* Wallet Address */}
            <TouchableOpacity 
              style={styles.walletAddressContainer}
              onPress={handleCopyAddress}
              activeOpacity={0.7}
            >
              <Text style={styles.walletAddress}>
                {formatWalletAddress(gridAccount?.address || solanaAddress || user?.solanaAddress)}
              </Text>
              <Ionicons 
                name={addressCopied ? "checkmark" : "copy-outline"} 
                size={16} 
                color={addressCopied ? "#00D4AA" : "#212121"} 
              />
            </TouchableOpacity>

            {/* Total Balance */}
            <Text style={styles.totalBalanceValue}>
              ${walletData?.totalBalance?.toFixed(2) || '0.00'}
            </Text>

            {/* Action Buttons */}
            <View style={styles.actionButtonsContainer}>
              <View style={styles.actionButton}>
                <TouchableOpacity 
                  style={styles.actionButtonCircle}
                  onPress={handleAddMoney}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.actionButtonLabel}>Add Money</Text>
              </View>

              <View style={styles.actionButton}>
                <TouchableOpacity 
                  style={styles.actionButtonCircle}
                  onPress={handleSendMoney}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.actionButtonLabel}>Send</Text>
              </View>

              {isGasAbstractionEnabled() && (
                <View style={styles.actionButton}>
                  <TouchableOpacity 
                    style={styles.actionButtonCircle}
                    onPress={() => router.push('/(main)/gas-abstraction')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="flash" size={20} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.actionButtonLabel}>Gas Credits</Text>
                </View>
              )}
            </View>
          </View>

          {/* Show Current holdings section when there are holdings, loading, or error states */}
          {(isLoading && !walletData) || (error && !walletData) || (walletData && walletData.holdings && walletData.holdings.length > 0) ? (
            <>
              <LinearGradient
                  colors={['#FFEFE3', '#FFEFE3', 'transparent']}
                  style={styles.topFade}
                  pointerEvents="none"
              >
                <Text style={styles.sectionTitle}>Current holdings</Text>
              </LinearGradient>

              {/* Holdings List - Scrollable */}
              <ScrollView 
                style={styles.holdingsScrollView} 
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={refreshWalletData}
                    tintColor="#E67B25"
                    colors={["#E67B25"]}
                  />
                }
              >
                {isLoading && !walletData ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#E67B25" />
                    <Text style={styles.loadingText}>Loading wallet data...</Text>
                  </View>
                ) : error && !walletData ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={48} color="#f87171" />
                    <Text style={styles.errorTitle}>Failed to Load Wallet</Text>
                    <Text style={styles.errorSubtitle}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={refreshWalletData}>
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  walletData && walletData.holdings.map((holding, index) => (
                    <WalletItem
                      key={`${holding.tokenAddress}-${index}`}
                      tokenAddress={holding.tokenAddress}
                      tokenPfp={holding.tokenPfp}
                      tokenName={holding.tokenName}
                      tokenSymbol={holding.tokenSymbol}
                      holdings={holding.holdings}
                      holdingsValue={holding.holdingsValue}
                      tokenPrice={holding.tokenPrice}
                    />
                  ))
                )}
              </ScrollView>
            </>
          ) : (
            /* Show empty state without "Current holdings" header when no holdings */
            <View style={styles.emptyHoldings}>
              <Ionicons name="wallet-outline" size={48} color="#E67B25" />
              <Text style={styles.emptyHoldingsTitle}>No tokens yet</Text>
              <Text style={styles.emptyHoldingsSubtitle}>
                Your token holdings will appear here once you make your first purchase.
              </Text>
            </View>
          )}

          {/* Sign Out Button */}
          <View style={styles.signOutContainer}>
            <TouchableOpacity 
              style={styles.signOutButton}
              onPress={() => {
                console.log('🚪 Sign out button pressed');
                logout();
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={16} color="#212121" />
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
            
            {/* Version tag below sign out button */}
            <View>
              <Text style={styles.versionText}>{getAppVersion()}</Text>
            </View>
          </View>

          {/* Bottom Fade Gradient */}
          <LinearGradient
            colors={['transparent', '#FFEFE3', '#FFEFE3']}
            style={styles.bottomFade}
            pointerEvents="none"
          />
          </View>
        </View>

        {/* Modals */}
        <DepositModal
          visible={showDepositModal}
          onClose={() => setShowDepositModal(false)}
          solanaAddress={gridAccount?.address || solanaAddress || user?.solanaAddress}
        />
        
        <SendModal 
          visible={showSendModal}
          onClose={() => setShowSendModal(false)}
          onSend={handleSendToken}
          holdings={walletData?.holdings || []}
        />

      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#FFEFE3',
  },
  wideContainer: {
    flex: 1,
    maxWidth: 1111,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
  },
  container: {
    flex: 1,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#FFEFE3',
  },
  backButton: {
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  
  // Wallet Header Section
  walletHeader: {
    alignItems: 'center',
    paddingBottom: 32,
  },
  profileSection: {
    marginBottom: 16,
    // border: '1px solid green',
  },
  profileGradientBorder: {
    width: 70, // Slightly larger to show gradient border
    height: 70,
    borderRadius: 34,
    padding: 4, // Creates the border thickness
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicture: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  profilePicturePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1a1e24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    // border: '1px solid red',
  },
  walletAddress: {
    fontSize: 14,
    fontWeight: '300',
    fontFamily: 'Satoshi',
    color: '#212121',
    // border: '1px solid red',
  },
  totalBalanceLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
    fontFamily: 'Satoshi',
  },
  totalBalanceValue: {
    fontSize: 44,
    fontWeight: '700',
    color: '#E67B25',
    fontFamily: 'Satoshi-Bold',
    marginBottom: 24,
    // border: '1px solid red',
  },
  
  // Action Buttons
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    // border: '1px solid red',
  },
  actionButton: {
    alignItems: 'center',
    gap: 8,
  },
  actionButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FBAA69',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonLabel: {
    fontSize: 12,
    color: '#212121',
    textAlign: 'center',
    fontFamily: 'Satoshi',
  },
  
  // Holdings Section
  sectionTitleContainer: {
    width: 350,
    alignSelf: 'center',
    marginBottom: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    textAlign: 'left',
    fontFamily: 'Satoshi',
  },
  
  // Scrollable holdings area
  holdingsScrollView: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 40, // Space for sign out button and fade
    transform: [{ translateY: -15 }],
    // border: '1px solid red',
  },
  
  // Sign out section
  signOutContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    paddingBottom: 6,
    paddingHorizontal: 16,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
    letterSpacing: 0.5,
    fontFamily: 'Satoshi',
  },
  
  // Version tag
  versionText: {
    fontSize: 10, // 14px (wallet address) - 4px = 10px
    fontWeight: '300',
    fontFamily: 'Satoshi',
    color: '#212121',
    opacity: 0.3,
  },
  
  // Top fade gradient (under Current holdings)
  topFade: {
    left: 0,
    right: 0,
    height: 40,
    zIndex: 5,
    width: 350,
    alignSelf: 'center',
    // border: '1px solid red',
  },
  
  // Bottom fade gradient
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 5,
  },
  
  // Empty Holdings State
  emptyHoldings: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 60,
  },
  emptyHoldingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: 'Satoshi',
  },
  emptyHoldingsSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
    fontFamily: 'Satoshi',
  },
  
  // Loading States
  loadingContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
    fontFamily: 'Satoshi',
  },
  
  // Error States
  errorContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 60,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f87171',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: 'Satoshi',
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
    marginBottom: 24,
    fontFamily: 'Satoshi',
  },
  retryButton: {
    backgroundColor: '#4E81D9',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Satoshi',
  },
});

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { walletDataService, WalletData } from '../features/wallet';
import { gridClientService } from '../features/grid';
import { useAuth } from './AuthContext';
import { useGrid } from './GridContext';

interface WalletContextType {
  walletData: WalletData | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isInitialized: boolean;
  error: string | null;
  refreshWalletData: () => Promise<void>;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { solanaAddress, gridAccount, initiateGridSignIn, gridAccountStatus } = useGrid();
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasTriggeredGridSignIn, setHasTriggeredGridSignIn] = useState(false);
  
  // Track the last wallet address we loaded data for to prevent duplicate loads
  const lastLoadedAddressRef = useRef<string | null>(null);

  // Load wallet data
  const loadWalletData = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      console.log('💰 [Context] Loading wallet data in background for user:', user.id);
      
      // Get Grid account address from client-side secure storage
      const gridAccount = await gridClientService.getAccount();
      const gridAddress = gridAccount?.address;
      
      // Use Solana address from GridContext or user as fallback if Grid account not set up
      const fallbackAddress = gridAddress || solanaAddress || user?.solanaAddress;
      
      console.log('💰 [Context] Wallet address sources:', {
        gridAddress,
        solanaAddress,
        userSolanaAddress: user?.solanaAddress,
        fallbackAddress
      });
      
      // If no wallet address is available, trigger Grid sign-in
      if (!fallbackAddress && user?.email && !hasTriggeredGridSignIn) {
        console.log('💰 [Context] No wallet address available, triggering Grid OTP sign-in');
        setHasTriggeredGridSignIn(true);
        try {
          await initiateGridSignIn(user.email, {
            backgroundColor: '#FFEFE3',
            textColor: '#000000',
            returnPath: '/(main)/wallet'
          });
          // Don't set error here - Grid sign-in will navigate to OTP screen
          // Wallet data will load after OTP completion via the useEffect below
          return;
        } catch (signInError) {
          console.error('💰 [Context] Failed to initiate Grid sign-in:', signInError);
          setHasTriggeredGridSignIn(false); // Reset to allow retry
          throw new Error('No wallet address available. Please complete Grid wallet setup.');
        }
      }
      
      // If we still don't have an address after attempting sign-in, throw error
      if (!fallbackAddress) {
        throw new Error('No wallet found. Please complete Grid wallet setup.');
      }
      
      const data = forceRefresh 
        ? await walletDataService.refreshWalletData(fallbackAddress)
        : await walletDataService.getWalletData(fallbackAddress);
      
      // Override smartAccountAddress with client-side Grid address (source of truth)
      const walletData = {
        ...data,
        smartAccountAddress: gridAddress || solanaAddress || data.smartAccountAddress
      };
      
      console.log('💰 [Context] Wallet data loaded successfully', {
        totalBalance: walletData.totalBalance,
        holdingsCount: walletData.holdings.length,
        smartAccountAddress: walletData.smartAccountAddress
      });
      
      setWalletData(walletData);
      setError(null);
      setHasTriggeredGridSignIn(false); // Reset flag on success
      
      // Track the address we loaded data for
      lastLoadedAddressRef.current = fallbackAddress;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load wallet data';
      console.error('💰 [Context] Error loading wallet data:', errorMessage);
      
      // Don't set error if we're triggering Grid sign-in (will navigate to OTP)
      if (!errorMessage.includes('No wallet address available')) {
        setError(errorMessage);
      }
      
      // Try to use cached data on error
      const cachedData = walletDataService.getCachedData();
      if (cachedData) {
        console.log('💰 [Context] Using cached data due to error');
        
        // Try to add Grid address even with cached data
        const gridAccount = await gridClientService.getAccount();
        const fallbackForCache = gridAccount?.address || solanaAddress || user?.solanaAddress;
        if (fallbackForCache) {
          cachedData.smartAccountAddress = fallbackForCache;
        }
        
        setWalletData(cachedData);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsInitialized(true);
    }
  }, [user?.id, user?.email, user?.solanaAddress, solanaAddress, hasTriggeredGridSignIn, initiateGridSignIn]);

  // Refresh function for manual refresh
  const refreshWalletData = async () => {
    setIsRefreshing(true);
    await loadWalletData(true);
  };

  // Clear error
  const clearError = () => {
    setError(null);
  };

  // Load wallet data when user is available (background loading on app start)
  useEffect(() => {
    if (user?.id && !isInitialized) {
      console.log('💰 [Context] Loading wallet data in background for user:', user.id);
      loadWalletData();
    }
  }, [user?.id, isInitialized, loadWalletData]);

  // When Grid account becomes available (after OTP completion), load wallet data
  useEffect(() => {
    if (!user?.id || !isInitialized) return;
    
    // If Grid account just became available and we don't have wallet data, load it
    const hasWalletAddress = gridAccount?.address || solanaAddress || user?.solanaAddress;
    
    if (hasWalletAddress && gridAccountStatus === 'active') {
      // Check if we've already loaded data for this address to prevent duplicate loads
      const hasLoadedForThisAddress = lastLoadedAddressRef.current === hasWalletAddress;
      
      // Only load if we haven't loaded for this address yet
      // The ref check prevents infinite loops even if walletData state is stale
      if (!hasLoadedForThisAddress) {
        console.log('💰 [Context] Grid account now available, loading wallet data');
        setHasTriggeredGridSignIn(false); // Reset flag so we can retry if needed
        loadWalletData(true); // Force refresh to get fresh data
      }
    }
  }, [gridAccount?.address, solanaAddress, gridAccountStatus, user?.id, user?.solanaAddress, isInitialized, loadWalletData]);

  // Auto-refresh on app focus
  useEffect(() => {
    if (!user?.id || !isInitialized) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('💰 [Context] App became active, checking for wallet data refresh');
        
        // Only refresh if cache is stale
        if (!walletDataService.hasFreshCache()) {
          console.log('💰 [Context] Cache is stale, refreshing wallet data');
          loadWalletData();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [user?.id, isInitialized, loadWalletData]);

  // Auto-refresh timer (every 60 seconds when app is active)
  useEffect(() => {
    if (!user?.id || !isInitialized) return;

    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        console.log('💰 [Context] Auto-refresh timer triggered');
        loadWalletData();
      }
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [user?.id, isInitialized, loadWalletData]);

  // Clear data when user logs out
  useEffect(() => {
    if (!user?.id) {
      console.log('💰 [Context] User logged out, clearing wallet data');
      setWalletData(null);
      setError(null);
      setIsLoading(false);
      setIsInitialized(false);
      setHasTriggeredGridSignIn(false);
      lastLoadedAddressRef.current = null;
      walletDataService.clearCache();
    }
  }, [user?.id]);

  return (
    <WalletContext.Provider
      value={{
        walletData,
        isLoading,
        isRefreshing,
        isInitialized,
        error,
        refreshWalletData,
        clearError
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  const { solanaAddress } = useGrid();
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load wallet data
  const loadWalletData = async (forceRefresh = false) => {
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
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load wallet data';
      console.error('💰 [Context] Error loading wallet data:', errorMessage);
      setError(errorMessage);
      
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
  };

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
  }, [user?.id, isInitialized]);

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
  }, [user?.id, isInitialized]);

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
  }, [user?.id, isInitialized]);

  // Clear data when user logs out
  useEffect(() => {
    if (!user?.id) {
      console.log('💰 [Context] User logged out, clearing wallet data');
      setWalletData(null);
      setError(null);
      setIsLoading(false);
      setIsInitialized(false);
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

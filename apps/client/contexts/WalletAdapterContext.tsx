import React, { createContext, useContext, ReactNode } from 'react';
import { Platform } from 'react-native';
import { getWallet, hasWalletInstalled } from '../features/auth/services/solana-wallet';

/**
 * Simple Wallet Context
 * Provides access to browser wallet (Phantom, Solflare, etc.)
 */

interface WalletContextType {
  wallet: any | null;
  hasWallet: boolean;
}

const WalletContext = createContext<WalletContextType>({
  wallet: null,
  hasWallet: false,
});

interface WalletAdapterProviderProps {
  children: ReactNode;
}

/**
 * Wallet Provider (Web Only)
 * Provides access to Solana wallet from browser
 * On non-web platforms, this is a pass-through component
 */
export function WalletAdapterProvider({ children }: WalletAdapterProviderProps) {
  // On non-web platforms, just return children
  if (Platform.OS !== 'web') {
    return (
      <WalletContext.Provider value={{ wallet: null, hasWallet: false }}>
        {children}
      </WalletContext.Provider>
    );
  }

  // Web-only wallet detection
  const wallet = getWallet();
  const hasWallet = hasWalletInstalled();

  return (
    <WalletContext.Provider value={{ wallet, hasWallet }}>
      {children}
    </WalletContext.Provider>
  );
}

/**
 * Hook to access wallet (web only)
 * Returns null on non-web platforms
 */
export function useWalletAdapter() {
  const context = useContext(WalletContext);
  return context.wallet;
}

/**
 * Hook to check if wallet is available
 */
export function useHasWallet() {
  const context = useContext(WalletContext);
  return context.hasWallet;
}

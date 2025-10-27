import { Platform } from 'react-native';
import { supabase } from '../../../lib';

/**
 * Simple Solana Wallet Integration
 * Directly uses window.solana without wallet adapter libraries
 */

interface SolanaWallet {
  publicKey: { 
    toString: () => string;
    toBase58: () => string;
  };
  isConnected: boolean;
  connect: () => Promise<{ publicKey: any }>;
  disconnect: () => Promise<void>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

export interface DetectedWallet {
  name: string;
  wallet: SolanaWallet;
  icon?: string | number; // Can be URL string or require() module
}

/**
 * Get all available Solana wallets from browser
 * Returns array of detected wallets with names
 */
export const getAllWallets = (): DetectedWallet[] => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return [];
  }

  // 🚨 DEBUG MODE: Mock all wallets
  const DEBUG_MODE = false;
  
  if (DEBUG_MODE) {
    console.log('🚨 DEBUG MODE: Returning mock wallets');
    return [
      {
        name: 'Phantom',
        wallet: { isConnected: false } as any, // Mock wallet
        icon: require('../../../assets/wallets/phantom.svg')
      },
      {
        name: 'Backpack',
        wallet: { isConnected: false } as any, // Mock wallet
        icon: 'https://backpack.app/favicon.ico'
      },
      {
        name: 'Solflare',
        wallet: { isConnected: false } as any, // Mock wallet
        icon: 'https://solflare.com/favicon.ico'
      },
    ];
  }

  const wallets: DetectedWallet[] = [];
  const win = window as any;
  
  // DEBUG: Log what's available
  console.log('🔍 DEBUG - Wallet detection:', {
    'window.phantom?.solana': !!win.phantom?.solana,
    'window.backpack?.solana': !!win.backpack?.solana,
    'window.solflare': !!win.solflare,
    'window.solana': !!win.solana,
    'window.solana.isPhantom': win.solana?.isPhantom,
    'window.solana.isSolflare': win.solana?.isSolflare,
    'window.solana.isBackpack': win.solana?.isBackpack,
  });
  
  // Phantom
  if (win.phantom?.solana) {
    console.log('✅ Phantom detected via window.phantom.solana');
    wallets.push({
      name: 'Phantom',
      wallet: win.phantom.solana,
      icon: require('../../../assets/wallets/phantom.svg')
    });
  }
  
  // Backpack
  if (win.backpack?.solana) {
    console.log('✅ Backpack detected via window.backpack.solana');
    wallets.push({
      name: 'Backpack',
      wallet: win.backpack.solana,
      icon: 'https://backpack.app/favicon.ico'
    });
  }
  
  // Solflare
  if (win.solflare && win.solflare !== win.phantom?.solana && win.solflare !== win.backpack?.solana) {
    console.log('✅ Solflare detected via window.solflare');
    wallets.push({
      name: 'Solflare',
      wallet: win.solflare,
      icon: 'https://solflare.com/favicon.ico'
    });
  }
  
  // FALLBACK: Check if window.solana is one of our supported wallets
  if (win.solana && wallets.length === 0) {
    console.log('⚠️ Found window.solana but no specific wallet detected');
    if (win.solana.isPhantom) {
      console.log('✅ Phantom detected via window.solana.isPhantom');
      wallets.push({
        name: 'Phantom',
        wallet: win.solana,
        icon: require('../../../assets/wallets/phantom.svg')
      });
    } else if (win.solana.isSolflare) {
      console.log('✅ Solflare detected via window.solana.isSolflare');
      wallets.push({
        name: 'Solflare',
        wallet: win.solana,
        icon: 'https://solflare.com/favicon.ico'
      });
    }
  }
  
  console.log('📊 Total wallets detected:', wallets.length, wallets.map(w => w.name));
  
  return wallets;
};

/**
 * Get first available Solana wallet from browser
 * Used for auto-selection when only one wallet is available
 */
export const getWallet = (): SolanaWallet | null => {
  const wallets = getAllWallets();
  return wallets.length > 0 ? wallets[0].wallet : null;
};

/**
 * Sign in with specific Solana wallet using Supabase Web3 auth
 */
export const signInWithSolanaWallet = async (wallet?: SolanaWallet) => {
  if (Platform.OS !== 'web') {
    throw new Error('Solana wallet sign-in is only supported on web platform');
  }

  // Use provided wallet or get default
  const selectedWallet = wallet || getWallet();
  
  if (!selectedWallet) {
    throw new Error('No Solana wallet found. Please install Phantom, Solflare, or another Solana wallet.');
  }

  try {
    console.log('🔐 Starting Solana wallet authentication...');

    // ALWAYS disconnect and reconnect to ensure we get the currently active account
    // This is critical when users switch accounts within their wallet app
    if (selectedWallet.isConnected) {
      console.log('🔐 Disconnecting to refresh active account...');
      await selectedWallet.disconnect();
    }

    console.log('🔐 Connecting to wallet (will get active account)...');
    await selectedWallet.connect();

    // Read publicKey FRESH after connection to get the active account
    if (!selectedWallet.publicKey) {
      throw new Error('No wallet public key available');
    }

    const publicKeyString = selectedWallet.publicKey.toString();
    console.log('🔐 Wallet connected with ACTIVE account:', publicKeyString);

    // Use Supabase's Web3 sign-in
    console.log('🔐 Requesting signature from Supabase...');
    
    const { data, error } = await supabase.auth.signInWithWeb3({
      chain: 'solana',
      statement: 'Sign in to Mallory',
      wallet: selectedWallet,
    });

    if (error) {
      console.error('🔐 Supabase Web3 sign-in error:', error);
      throw error;
    }

    if (!data?.session) {
      throw new Error('No session created');
    }

    console.log('✅ Solana wallet authentication successful');
    console.log('✅ User ID:', data.user?.id);
    console.log('✅ Wallet address:', publicKeyString);

    return {
      session: data.session,
      user: data.user,
      walletAddress: publicKeyString,
    };
  } catch (error: any) {
    console.error('❌ Solana wallet sign-in error:', error);
    
    // Provide user-friendly error messages
    if (error.message?.includes('User rejected')) {
      throw new Error('Wallet signature request was rejected');
    } else if (error.message?.includes('not connected')) {
      throw new Error('Please connect your wallet first');
    } else {
      throw error;
    }
  }
};

/**
 * Disconnect wallet
 */
export const disconnectWallet = async (wallet?: SolanaWallet) => {
  if (Platform.OS !== 'web') {
    return;
  }

  const selectedWallet = wallet || getWallet();
  
  if (!selectedWallet) {
    return;
  }

  try {
    if (selectedWallet.isConnected) {
      await selectedWallet.disconnect();
      console.log('🔐 Wallet disconnected');
    }
  } catch (error) {
    console.error('❌ Wallet disconnect error:', error);
    // Don't throw - disconnection errors are not critical
  }
};

/**
 * Check if user has a Solana wallet installed
 */
export const hasWalletInstalled = (): boolean => {
  return getAllWallets().length > 0;
};

/**
 * Check if user has multiple wallets installed
 */
export const hasMultipleWallets = (): boolean => {
  return getAllWallets().length > 1;
};

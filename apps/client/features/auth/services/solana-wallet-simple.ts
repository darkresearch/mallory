import { Platform } from 'react-native';
import { supabase } from '../../../lib';

/**
 * Simple Solana Wallet Integration
 * Directly uses window.solana without wallet adapter libraries
 */

interface SolanaWallet {
  publicKey: { toString: () => string };
  isConnected: boolean;
  connect: () => Promise<{ publicKey: any }>;
  disconnect: () => Promise<void>;
  signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
}

/**
 * Get available Solana wallet from browser
 * Checks for Phantom, Solflare, Backpack, etc.
 */
export const getWallet = (): SolanaWallet | null => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  // Check for installed wallets in order of preference
  const win = window as any;
  
  // Phantom (most popular)
  if (win.phantom?.solana) {
    return win.phantom.solana;
  }
  
  // Backpack
  if (win.backpack?.solana) {
    return win.backpack.solana;
  }
  
  // Solflare
  if (win.solflare) {
    return win.solflare;
  }
  
  // Generic window.solana (works for many wallets)
  if (win.solana) {
    return win.solana;
  }
  
  return null;
};

/**
 * Sign in with Solana wallet using Supabase Web3 auth
 */
export const signInWithSolanaWallet = async () => {
  if (Platform.OS !== 'web') {
    throw new Error('Solana wallet sign-in is only supported on web platform');
  }

  const wallet = getWallet();
  
  if (!wallet) {
    throw new Error('No Solana wallet found. Please install Phantom, Solflare, or another Solana wallet.');
  }

  try {
    console.log('🔐 Starting Solana wallet authentication...');

    // Connect wallet if not already connected
    if (!wallet.isConnected) {
      console.log('🔐 Connecting to wallet...');
      await wallet.connect();
    }

    if (!wallet.publicKey) {
      throw new Error('No wallet public key available');
    }

    const publicKeyString = wallet.publicKey.toString();
    console.log('🔐 Wallet connected:', publicKeyString);

    // Use Supabase's Web3 sign-in
    console.log('🔐 Requesting signature from Supabase...');
    
    const { data, error } = await supabase.auth.signInWithWeb3({
      chain: 'solana',
      statement: 'Sign in to Mallory',
      wallet: wallet, // Pass the wallet object directly
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
export const disconnectWallet = async () => {
  if (Platform.OS !== 'web') {
    return;
  }

  const wallet = getWallet();
  
  if (!wallet) {
    return;
  }

  try {
    if (wallet.isConnected) {
      await wallet.disconnect();
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
  return getWallet() !== null;
};


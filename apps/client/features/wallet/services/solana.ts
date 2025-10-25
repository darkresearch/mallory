import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import { secureStorage, config } from '../../../lib';
import { gridClientService } from '../../grid/services/gridClient';

const SOLANA_RPC_URL = config.solanaRpcUrl || 'https://api.mainnet-beta.solana.com';

// Secure storage keys
const WALLET_PRIVATE_KEY = 'scout_wallet_private_key';
const WALLET_PUBLIC_KEY = 'scout_wallet_public_key';

// Initialize Solana connection
export const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// Wallet management functions
export async function getStoredWallet() {
  const publicKey = await SecureStore.getItemAsync(WALLET_PUBLIC_KEY);
  if (!publicKey) return null;
  
  return new PublicKey(publicKey);
}

export async function storeWallet(publicKey: string, privateKey?: string) {
  await SecureStore.setItemAsync(WALLET_PUBLIC_KEY, publicKey);
  if (privateKey) {
    await SecureStore.setItemAsync(WALLET_PRIVATE_KEY, privateKey);
  }
}

export async function clearWallet() {
  await SecureStore.deleteItemAsync(WALLET_PUBLIC_KEY);
  await SecureStore.deleteItemAsync(WALLET_PRIVATE_KEY);
}

// Transaction helpers
export async function signTransaction(transaction: Transaction): Promise<Transaction> {
  // TODO: Implement transaction signing
  // This will integrate with the mobile wallet adapter
  throw new Error('Transaction signing not yet implemented');
}

// Balance and portfolio functions
export async function getWalletBalance(publicKey: PublicKey) {
  const balance = await connection.getBalance(publicKey);
  return balance / 1e9; // Convert lamports to SOL
}

export async function getTokenBalances(publicKey: PublicKey) {
  // TODO: Implement token balance fetching
  // Will use getParsedTokenAccountsByOwner
  return [];
}

// Send SOL functionality
interface SendSolRequest {
  recipientAddress: string;
  amount: string;
}

interface SendTokenResponse {
  success: boolean;
  transactionSignature?: string;
  message?: string;
  error?: string;
}

export async function sendToken(recipientAddress: string, amount: string, tokenAddress?: string): Promise<SendTokenResponse> {
  try {
    console.log('💸 [sendToken] Starting client-side Grid send:', { recipientAddress, amount, tokenAddress });
    
    // Get Grid account
    const account = await gridClientService.getAccount();
    if (!account) {
      console.error('💸 [sendToken] No Grid account found');
      return {
        success: false,
        error: 'No Grid wallet found. Please set up your wallet first.'
      };
    }

    console.log('💸 [sendToken] Using Grid account:', account.address);

    // Determine token mint
    // Default to USDC if no token specified
    const tokenMint = tokenAddress || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // USDC
    
    // Convert amount to smallest unit (6 decimals for USDC, 9 for SOL)
    const decimals = 6; // TODO: Get actual decimals from token metadata
    const amountInSmallestUnit = parseFloat(amount) * Math.pow(10, decimals);
    
    console.log('💸 [sendToken] Creating spending limit:', {
      amount: amountInSmallestUnit,
      mint: tokenMint,
      destination: recipientAddress
    });

    // Create spending limit transaction
    const spendingLimitPayload = {
      amount: amountInSmallestUnit,
      mint: tokenMint,
      period: 'one_time' as const,
      destinations: [recipientAddress]
    };
    
    // Get transaction payload from Grid
    const result = await gridClientService.createSpendingLimit(
      account.address,
      spendingLimitPayload
    );
    
    console.log('💸 [sendToken] Spending limit created, signing transaction...');

    // Sign and send transaction (all client-side)
    const signature = await gridClientService.signAndSendTransaction(result.data);
    
    console.log('✅ [sendToken] Transaction successful:', signature);

    return {
      success: true,
      transactionSignature: signature,
      message: 'Transaction sent successfully'
    };
  } catch (error) {
    console.error('💸 [sendToken] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Transaction failed'
    };
  }
}

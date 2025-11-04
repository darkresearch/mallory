import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import { config } from '../../../lib';
import { gridClientService } from '../../grid/services/gridClient';

const SOLANA_RPC_URL = config.solanaRpcUrl || 'https://api.mainnet-beta.solana.com';

// Secure storage keys (legacy - not used with Grid wallets)
const WALLET_PRIVATE_KEY = 'mallory_wallet_private_key';
const WALLET_PUBLIC_KEY = 'mallory_wallet_public_key';

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

    // Send tokens directly using Grid's working sendTokens method
    // tokenAddress is the mint address for SPL tokens, or undefined for SOL
    const signature = await gridClientService.sendTokens({
      recipient: recipientAddress,
      amount,
      tokenMint: tokenAddress
    });
    
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

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import { secureStorage, config } from '../../../lib';

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
    console.log('💸 [sendToken] Starting send request:', { recipientAddress, amount, tokenAddress });
    
    const token = await secureStorage.getItem('scout_auth_token');
    if (!token) {
      console.error('💸 [sendToken] No auth token found');
      throw new Error('No auth token available');
    }

    const baseApiUrl = config.backendApiUrl || 'http://localhost:3001';
    console.log('💸 [sendToken] Sending to:', `${baseApiUrl}/api/wallet/send`);
    
    // Build request body - only include token_address for non-SOL tokens
    const requestBody: any = {
      to_address: recipientAddress,
      amount
    };
    
    if (tokenAddress) {
      requestBody.token_address = tokenAddress;
    }
    
    const response = await fetch(`${baseApiUrl}/api/wallet/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('💸 [sendToken] Response status:', response.status);
    const data = await response.json();
    console.log('💸 [sendToken] Response data:', data);

    if (!response.ok) {
      // Return full error response including session expiration details
      return {
        success: false,
        error: data.error || `HTTP error! status: ${response.status}`,
        ...data // Include action_required, otp_sent, retry_after_verify, etc.
      };
    }

    return data;
  } catch (error) {
    console.error('💸 [sendToken] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

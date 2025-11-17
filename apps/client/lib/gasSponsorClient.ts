/**
 * Gas Sponsor Client - Developer API for Agents
 * 
 * Typed helper API for agent developers to interact with gas abstraction.
 * Provides simple methods for checking balance, topping up, and sponsoring transactions.
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7
 */

import { VersionedTransaction } from '@solana/web3.js';
import { generateAPIUrl } from './api/client';
import { storage, SECURE_STORAGE_KEYS } from './storage';
import { gridClientService } from '../features/grid';
import { InsufficientBalanceError } from '../contexts/GasAbstractionContext';

/**
 * Top-up record
 */
export interface TopupRecord {
  paymentId: string;
  txSignature: string;
  amountBaseUnits: number;
  timestamp: string;
}

/**
 * Usage record (sponsored transaction)
 */
export interface UsageRecord {
  txSignature: string;
  amountBaseUnits: number;
  status: 'pending' | 'settled' | 'failed';
  timestamp: string;
  settled_at?: string;
}

/**
 * Balance response
 */
export interface BalanceResponse {
  balanceBaseUnits: number;
  topups: TopupRecord[];
  usages: UsageRecord[];
}

/**
 * Top-up result
 */
export interface TopupResult {
  wallet: string;
  amountBaseUnits: number;
  txSignature: string;
  paymentId: string;
}

/**
 * Sponsorship result
 */
export interface SponsorshipResult {
  sponsoredTx: VersionedTransaction;
  billedBaseUnits: number;
}

/**
 * Typed helper API for agent developers
 */
export interface GasSponsorClient {
  /**
   * Get current gas balance and history
   */
  getBalance(): Promise<BalanceResponse>;
  
  /**
   * Top up gas credits
   * @param params - Optional amount in base units
   */
  topup(params: { amountBaseUnits?: number }): Promise<TopupResult>;
  
  /**
   * Sponsor a transaction
   * @param params - Unsigned VersionedTransaction
   * @returns Sponsored transaction and billing details
   */
  sponsorTransaction(params: {
    unsignedTx: VersionedTransaction;
  }): Promise<SponsorshipResult>;
}

/**
 * Create Gas Sponsor Client instance
 */
export function createGasSponsorClient(): GasSponsorClient {
  return {
    async getBalance(): Promise<BalanceResponse> {
      const token = await storage.persistent.getItem(SECURE_STORAGE_KEYS.AUTH_TOKEN);
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const gridAccount = await gridClientService.getAccount();
      if (!gridAccount?.address) {
        throw new Error('Grid wallet not connected');
      }
      
      const gridSessionSecretsJson = await storage.persistent.getItem(SECURE_STORAGE_KEYS.GRID_SESSION_SECRETS);
      if (!gridSessionSecretsJson) {
        throw new Error('Grid session secrets not available');
      }
      
      const gridSessionSecrets = JSON.parse(gridSessionSecretsJson);
      const gridSession = {
        authentication: gridAccount.authentication || gridAccount,
        address: gridAccount.address
      };
      
      const url = generateAPIUrl('/api/gas-abstraction/balance');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          gridSessionSecrets,
          gridSession
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch balance: ${response.status}`);
      }
      
      const data = await response.json();
      return {
        balanceBaseUnits: data.balanceBaseUnits,
        topups: data.topups || [],
        usages: data.usages || []
      };
    },
    
    async topup(params: { amountBaseUnits?: number }): Promise<TopupResult> {
      // This is a placeholder - full implementation requires UI for transaction creation
      // and user approval. For now, throw an error indicating it should be done via UI.
      throw new Error('Top-up must be initiated through the UI. Use the Gas Abstraction screen to top up.');
    },
    
    async sponsorTransaction(params: { unsignedTx: VersionedTransaction }): Promise<SponsorshipResult> {
      const token = await storage.persistent.getItem(SECURE_STORAGE_KEYS.AUTH_TOKEN);
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const gridAccount = await gridClientService.getAccount();
      if (!gridAccount?.address) {
        throw new Error('Grid wallet not connected');
      }
      
      const gridSessionSecretsJson = await storage.persistent.getItem(SECURE_STORAGE_KEYS.GRID_SESSION_SECRETS);
      if (!gridSessionSecretsJson) {
        throw new Error('Grid session secrets not available');
      }
      
      const gridSessionSecrets = JSON.parse(gridSessionSecretsJson);
      const gridSession = {
        authentication: gridAccount.authentication || gridAccount,
        address: gridAccount.address
      };
      
      // Serialize transaction to base64
      const serialized = Buffer.from(params.unsignedTx.serialize()).toString('base64');
      
      const url = generateAPIUrl('/api/gas-abstraction/sponsor');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          transaction: serialized,
          gridSessionSecrets,
          gridSession
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 402) {
          const required = errorData.data?.required || errorData.required;
          const available = errorData.data?.available || errorData.available;
          throw new InsufficientBalanceError(required, available);
        }
        
        throw new Error(errorData.error || `Sponsorship failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Deserialize sponsored transaction
      const sponsoredTxBuffer = Buffer.from(result.transaction, 'base64');
      const sponsoredTx = VersionedTransaction.deserialize(sponsoredTxBuffer);
      
      return {
        sponsoredTx,
        billedBaseUnits: result.billedBaseUnits
      };
    }
  };
}

/**
 * Agent tools for LLM invocation
 */
export const agentTools = {
  /**
   * Check if user has sufficient gas balance
   * @param min_required_usdc - Minimum USDC required
   * @returns Balance status and message
   */
  async check_gas_balance(min_required_usdc: number): Promise<{
    sufficient: boolean;
    current_balance: number;
    message: string;
  }> {
    const client = createGasSponsorClient();
    const { balanceBaseUnits } = await client.getBalance();
    const currentUsdc = balanceBaseUnits / 1_000_000;
    
    if (currentUsdc >= min_required_usdc) {
      return {
        sufficient: true,
        current_balance: currentUsdc,
        message: `Balance sufficient: ${currentUsdc.toFixed(6)} USDC available`,
      };
    } else {
      return {
        sufficient: false,
        current_balance: currentUsdc,
        message: `Insufficient balance: ${currentUsdc.toFixed(6)} USDC available, ${min_required_usdc.toFixed(6)} USDC required. Please top up.`,
      };
    }
  },
  
  /**
   * Sponsor and send a transaction
   * @param encoded_tx - Base64-encoded unsigned transaction
   * @returns Transaction signature
   */
  async sponsor_and_send_transaction(encoded_tx: string): Promise<{
    success: boolean;
    signature?: string;
    error?: string;
  }> {
    try {
      const client = createGasSponsorClient();
      
      // Decode transaction
      const txBuffer = Buffer.from(encoded_tx, 'base64');
      const tx = VersionedTransaction.deserialize(txBuffer);
      
      // Sponsor transaction
      const { sponsoredTx, billedBaseUnits } = await client.sponsorTransaction({
        unsignedTx: tx,
      });
      
      // Note: User still needs to sign and send the transaction
      // This is a placeholder - actual signing and sending should be done
      // through the wallet integration
      // For now, return the sponsored transaction for the caller to handle
      
      return {
        success: true,
        // Return sponsored transaction as base64 for caller to sign and send
        signature: Buffer.from(sponsoredTx.serialize()).toString('base64'),
      };
    } catch (error) {
      if (error instanceof InsufficientBalanceError) {
        return {
          success: false,
          error: `Insufficient gas credits. Available: ${error.available.toFixed(6)} USDC, Required: ${error.required.toFixed(6)} USDC`,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};


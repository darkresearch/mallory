/**
 * Gas Abstraction Context
 * 
 * Manages gas abstraction state, balance, and operations.
 * Provides gasless transaction sponsorship and balance management.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 4.1, 4.2, 4.5, 4.6, 4.7, 4.8, 4.11, 4.12, 4.13, 4.16, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { VersionedTransaction } from '@solana/web3.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateAPIUrl } from '../lib/api/client';
import { storage, SECURE_STORAGE_KEYS } from '../lib/storage';
import { isGasAbstractionEnabled, getLowBalanceThreshold } from '../lib/gasAbstraction';
import { gasTelemetry } from '../lib/telemetry';
import { useAuth } from './AuthContext';
import { useGrid } from './GridContext';
import { gridClientService } from '../features/grid';

/**
 * Top-up record from gateway
 */
export interface TopupRecord {
  paymentId: string;
  txSignature: string;
  amountBaseUnits: number;
  timestamp: string; // ISO 8601
}

/**
 * Usage record (sponsored transaction) from gateway
 */
export interface UsageRecord {
  txSignature: string;
  amountBaseUnits: number;
  status: 'pending' | 'settled' | 'failed';
  timestamp: string; // ISO 8601
  settled_at?: string; // ISO 8601
}

/**
 * Gateway balance response
 */
export interface GatewayBalance {
  wallet: string;
  balanceBaseUnits: number;
  topups: TopupRecord[];
  usages: UsageRecord[];
}

/**
 * Custom error for insufficient balance
 */
export class InsufficientBalanceError extends Error {
  constructor(
    public required: number,
    public available: number
  ) {
    super(`Insufficient gas credits. Available: ${available} USDC, Required: ${required} USDC`);
    this.name = 'InsufficientBalanceError';
  }
}

/**
 * Gas Abstraction Context Type
 */
export interface GasAbstractionContextType {
  // Balance state
  balance: number | null; // USDC amount
  balanceBaseUnits: number | null; // Raw base units
  balanceLoading: boolean;
  balanceError: string | null;
  balanceLastFetched: Date | null;
  pendingAmount: number;
  availableBalance: number;
  
  // Transaction history
  topups: TopupRecord[];
  usages: UsageRecord[];
  
  // Settings
  gaslessEnabled: boolean;
  lowBalanceThreshold: number; // 0.1 USDC
  isLowBalance: boolean;
  
  // Actions
  refreshBalance: () => Promise<void>;
  initiateTopup: (amount?: number) => Promise<void>;
  sponsorTransaction: (transaction: VersionedTransaction) => Promise<string>;
  toggleGaslessMode: (enabled: boolean) => void;
  
  // Helper methods
  isBalanceStale: () => boolean;
  hasInsufficientBalance: (estimatedCost: number) => boolean;
}

const GasAbstractionContext = createContext<GasAbstractionContextType | undefined>(undefined);

const GASLESS_ENABLED_STORAGE_KEY = 'gaslessEnabled';

interface GasAbstractionProviderProps {
  children: ReactNode;
  enabled: boolean; // From feature flag
}

export function GasAbstractionProvider({ children, enabled }: GasAbstractionProviderProps) {
  const { user } = useAuth();
  const { gridAccount } = useGrid();
  
  // State management
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceBaseUnits, setBalanceBaseUnits] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [balanceLastFetched, setBalanceLastFetched] = useState<Date | null>(null);
  const [topups, setTopups] = useState<TopupRecord[]>([]);
  const [usages, setUsages] = useState<UsageRecord[]>([]);
  const [gaslessEnabled, setGaslessEnabled] = useState<boolean>(false);
  
  // Load persisted gasless mode preference
  useEffect(() => {
    if (!enabled) return;
    
    const loadGaslessPreference = async () => {
      try {
        const stored = await AsyncStorage.getItem(GASLESS_ENABLED_STORAGE_KEY);
        if (stored !== null) {
          setGaslessEnabled(stored === 'true');
        } else {
          // Use default from feature flag
          const { isGasAbstractionDefaultEnabled } = await import('../lib/gasAbstraction');
          setGaslessEnabled(isGasAbstractionDefaultEnabled());
        }
      } catch (error) {
        console.error('Failed to load gasless preference:', error);
      }
    };
    
    loadGaslessPreference();
  }, [enabled]);
  
  // Computed values
  const pendingAmount = useMemo(() => {
    return usages
      .filter(u => u.status === 'pending')
      .reduce((sum, u) => sum + u.amountBaseUnits, 0) / 1_000_000;
  }, [usages]);
  
  const availableBalance = useMemo(() => {
    return (balance || 0) - pendingAmount;
  }, [balance, pendingAmount]);
  
  const isLowBalance = useMemo(() => {
    return availableBalance < getLowBalanceThreshold();
  }, [availableBalance]);
  
  // Balance fetching with 10-second staleness check
  const isBalanceStale = useCallback(() => {
    if (!balanceLastFetched) return true;
    const now = new Date();
    const diff = now.getTime() - balanceLastFetched.getTime();
    return diff > 10_000; // 10 seconds
  }, [balanceLastFetched]);
  
  /**
   * Fetch balance from gateway
   * Implements retry logic for transient network errors (Task 15.2)
   */
  const refreshBalance = useCallback(async (retryCount = 0): Promise<void> => {
    if (!enabled) return;
    
    // Check if Grid account is available
    if (!gridAccount?.address) {
      console.warn('⚠️ [GasAbstraction] Cannot fetch balance: Grid account not available');
      setBalanceError('Grid wallet not connected');
      return;
    }
    
    setBalanceLoading(true);
    setBalanceError(null);
    
    try {
      // Get auth token
      const token = await storage.persistent.getItem(SECURE_STORAGE_KEYS.AUTH_TOKEN);
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Get Grid session secrets
      const gridSessionSecretsJson = await storage.persistent.getItem(SECURE_STORAGE_KEYS.GRID_SESSION_SECRETS);
      if (!gridSessionSecretsJson) {
        throw new Error('Grid session secrets not available');
      }
      
      const gridSessionSecrets = JSON.parse(gridSessionSecretsJson);
      const gridSession = {
        authentication: gridAccount.authentication || gridAccount,
        address: gridAccount.address
      };
      
      // Make API request
      // Note: Using POST because Grid session data needs to be sent
      // (GET requests with body are not standard HTTP)
      const url = generateAPIUrl('/api/gas-abstraction/balance');
      let response: Response;
      
      try {
        response = await fetch(url, {
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
      } catch (networkError) {
        // Network error (connection failed, timeout, etc.)
        // Retry once for transient network errors
        if (retryCount === 0) {
          console.log('🔄 [GasAbstraction] Network error, retrying balance fetch...');
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          return refreshBalance(1); // Retry once
        }
        throw networkError; // Re-throw if already retried
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const status = response.status;
        
        // Retry once for transient server errors (5xx)
        if (status >= 500 && status < 600 && retryCount === 0) {
          console.log(`🔄 [GasAbstraction] Server error ${status}, retrying balance fetch...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          return refreshBalance(1); // Retry once
        }
        
        // For 401 errors, don't retry (authentication issue)
        // For 4xx errors, don't retry (client error)
        throw new Error(errorData.error || `Failed to fetch balance: ${status}`);
      }
      
      const data: GatewayBalance = await response.json();
      
      // Update state
      const balanceUsdc = data.balanceBaseUnits / 1_000_000;
      setBalance(balanceUsdc);
      setBalanceBaseUnits(data.balanceBaseUnits);
      setTopups(data.topups || []);
      setUsages(data.usages || []);
      setBalanceLastFetched(new Date());
      setBalanceError(null);
      
      console.log('✅ [GasAbstraction] Balance fetched:', {
        balance: balanceUsdc,
        topups: data.topups.length,
        usages: data.usages.length
      });
    } catch (error) {
      console.error('❌ [GasAbstraction] Failed to fetch balance:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch balance';
      setBalanceError(errorMessage);
      // Keep last known balance on error (don't clear it) - graceful degradation
      // Wallet continues to work with SOL gas even if balance fetch fails
    } finally {
      setBalanceLoading(false);
    }
  }, [enabled, gridAccount]);
  
  // Auto-refresh on app focus if balance is stale
  useEffect(() => {
    if (!enabled) return;
    
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isBalanceStale()) {
        console.log('🔄 [GasAbstraction] App became active, refreshing stale balance');
        refreshBalance();
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [enabled, isBalanceStale, refreshBalance]);
  
  /**
   * Initiate top-up flow
   * 
   * Note: Full implementation will be in UI component.
   * This is a placeholder that can be extended.
   */
  const initiateTopup = useCallback(async (amount?: number) => {
    if (!enabled) {
      throw new Error('Gas abstraction not enabled');
    }
    
    // Log top-up start
    if (gridAccount?.address) {
      await gasTelemetry.topupStart(gridAccount.address);
    }
    
    // This will be implemented in the top-up UI component
    // For now, just log that it was called
    console.log('💰 [GasAbstraction] Top-up initiated:', { amount });
    
    // After top-up completes, refresh balance
    await refreshBalance();
  }, [enabled, refreshBalance, gridAccount]);
  
  /**
   * Sponsor a transaction
   */
  const sponsorTransaction = useCallback(async (transaction: VersionedTransaction): Promise<string> => {
    if (!enabled) {
      throw new Error('Gas abstraction not enabled');
    }
    
    // Check if Grid account is available
    if (!gridAccount?.address) {
      throw new Error('Grid wallet not connected');
    }
    
    const walletAddress = gridAccount.address;
    
    // Log sponsorship start
    await gasTelemetry.sponsorStart(walletAddress);
    
    // Refresh balance if stale
    if (isBalanceStale()) {
      console.log('🔄 [GasAbstraction] Balance stale, refreshing before sponsorship');
      await refreshBalance();
    }
    
    // Serialize transaction to base64
    const serialized = Buffer.from(transaction.serialize()).toString('base64');
    
    try {
      // Get auth token
      const token = await storage.persistent.getItem(SECURE_STORAGE_KEYS.AUTH_TOKEN);
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Get Grid session secrets
      const gridSessionSecretsJson = await storage.persistent.getItem(SECURE_STORAGE_KEYS.GRID_SESSION_SECRETS);
      if (!gridSessionSecretsJson) {
        throw new Error('Grid session secrets not available');
      }
      
      const gridSessionSecrets = JSON.parse(gridSessionSecretsJson);
      const gridSession = {
        authentication: gridAccount.authentication || gridAccount,
        address: gridAccount.address
      };
      
      // Request sponsorship
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
        const errorMessage = errorData.error || errorData.message || `Sponsorship failed: ${response.status}`;
        
        // Handle insufficient balance error (402)
        if (response.status === 402) {
          const required = errorData.data?.required || errorData.required;
          const available = errorData.data?.available || errorData.available;
          
          // Log insufficient balance
          await gasTelemetry.sponsorInsufficientBalance(walletAddress, required, available);
          
          throw new InsufficientBalanceError(required, available);
        }
        
        // Handle old blockhash error (400 with blockhash message)
        // Note: Backend should handle retry with fresh blockhash, but we handle it gracefully here
        if (response.status === 400 && (
          errorMessage.toLowerCase().includes('blockhash') ||
          errorMessage.toLowerCase().includes('expired') ||
          errorMessage.toLowerCase().includes('stale')
        )) {
          // Log error
          await gasTelemetry.sponsorError(walletAddress, response.status);
          
          // Throw specific error that callers can handle (e.g., rebuild transaction with fresh blockhash)
          const blockhashError = new Error('Transaction blockhash expired. Please rebuild transaction with fresh blockhash and retry.');
          (blockhashError as any).isBlockhashError = true;
          (blockhashError as any).status = 400;
          throw blockhashError;
        }
        
        // Handle service unavailable (503) - graceful degradation
        if (response.status === 503) {
          // Log error
          await gasTelemetry.sponsorError(walletAddress, response.status);
          
          // Throw specific error that allows fallback to SOL
          const unavailableError = new Error('Gas sponsorship temporarily unavailable. Please use SOL gas or try again later.');
          (unavailableError as any).isServiceUnavailable = true;
          (unavailableError as any).status = 503;
          throw unavailableError;
        }
        
        // Log other errors
        await gasTelemetry.sponsorError(walletAddress, response.status);
        
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      
      // Log success with billed amount
      if (result.billedBaseUnits !== undefined) {
        await gasTelemetry.sponsorSuccess(walletAddress, result.billedBaseUnits);
      }
      
      // Return sponsored transaction (base64)
      return result.transaction;
    } catch (error) {
      console.error('❌ [GasAbstraction] Sponsorship failed:', error);
      
      // If error wasn't already logged (e.g., network error), log it
      if (!(error instanceof InsufficientBalanceError)) {
        // Try to extract error code from error message or default to 500
        const errorCode = (error as any)?.status || 
          (error instanceof Error && error.message.includes('status') 
            ? parseInt(error.message.match(/status[:\s]+(\d+)/)?.[1] || '500')
            : 500);
        await gasTelemetry.sponsorError(walletAddress, errorCode);
      }
      
      // Graceful degradation: Errors don't break wallet functionality
      // Callers can catch these errors and fall back to SOL gas
      throw error;
    }
  }, [enabled, gridAccount, isBalanceStale, refreshBalance]);
  
  /**
   * Toggle gasless mode
   */
  const toggleGaslessMode = useCallback(async (enabled: boolean) => {
    setGaslessEnabled(enabled);
    try {
      await AsyncStorage.setItem(GASLESS_ENABLED_STORAGE_KEY, enabled.toString());
    } catch (error) {
      console.error('Failed to save gasless preference:', error);
    }
  }, []);
  
  /**
   * Check if balance is insufficient for estimated cost
   */
  const hasInsufficientBalance = useCallback((estimatedCost: number) => {
    return availableBalance < estimatedCost;
  }, [availableBalance]);
  
  // Clear data when user logs out
  useEffect(() => {
    if (!user?.id) {
      console.log('🔄 [GasAbstraction] User logged out, clearing state');
      setBalance(null);
      setBalanceBaseUnits(null);
      setBalanceError(null);
      setBalanceLastFetched(null);
      setTopups([]);
      setUsages([]);
    }
  }, [user?.id]);
  
  const value: GasAbstractionContextType = {
    balance,
    balanceBaseUnits,
    balanceLoading,
    balanceError,
    balanceLastFetched,
    pendingAmount,
    availableBalance,
    topups,
    usages,
    gaslessEnabled,
    lowBalanceThreshold: getLowBalanceThreshold(),
    isLowBalance,
    refreshBalance,
    initiateTopup,
    sponsorTransaction,
    toggleGaslessMode,
    isBalanceStale,
    hasInsufficientBalance,
  };
  
  return (
    <GasAbstractionContext.Provider value={value}>
      {children}
    </GasAbstractionContext.Provider>
  );
}

export function useGasAbstraction(): GasAbstractionContextType | null {
  const context = useContext(GasAbstractionContext);
  // Return null instead of throwing - allows conditional usage
  return context || null;
}


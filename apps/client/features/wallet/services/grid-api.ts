import { storage, config } from '../../../lib';

interface WalletStatus {
  exists: boolean;
  id?: string;
  address?: string;
  status: 'not_created' | 'pending_verification' | 'verified';
  ready_for_transactions: boolean;
  created_at?: string;
  verified_at?: string;
}

interface WalletBalances {
  tokens: Array<{
    tokenAddress: string;
    symbol: string;
    balance: string;
    decimals: number;
    uiAmount: number;
  }>;
  total_value_usd: number;
  last_updated: string;
}

interface WalletSetupResponse {
  success: boolean;
  wallet?: {
    id: string;
    status: string;
    address?: string;
    ready_for_transactions: boolean;
  };
  message: string;
  next_steps: string[];
  error?: string;
}

interface WalletVerifyResponse {
  success: boolean;
  wallet?: {
    id: string;
    address: string;
    status: string;
    ready_for_transactions: boolean;
  };
  message: string;
  next_steps: string[];
  error?: string;
}

class WalletService {
  private baseUrl: string;

  constructor() {
    // Point to Express API server - now using clean wallet API
    const baseApiUrl = config.backendApiUrl || 'http://localhost:3001';
    this.baseUrl = `${baseApiUrl}/api/wallet`;
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      // Use centralized storage key constant
      const { SECURE_STORAGE_KEYS } = await import('@/lib/storage/keys');
      const token = await storage.persistent.getItem(SECURE_STORAGE_KEYS.AUTH_TOKEN);
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  async getWalletStatus(): Promise<{ 
    wallet: WalletStatus; 
    balances: WalletBalances; 
    message: string; 
    next_steps: string[] 
  }> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No auth token available');
      }

      const response = await fetch(`${this.baseUrl}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting wallet status:', error);
      return {
        wallet: {
          exists: false,
          status: 'not_created',
          ready_for_transactions: false
        },
        balances: {
          tokens: [],
          total_value_usd: 0,
          last_updated: new Date().toISOString()
        },
        message: 'Failed to get wallet status',
        next_steps: ['Check your internet connection', 'Try again']
      };
    }
  }

  async setupWallet(): Promise<WalletSetupResponse> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No auth token available');
      }

      console.log('🚀 Setting up wallet via new API...');

      const response = await fetch(`${this.baseUrl}/setup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Wallet setup failed',
          next_steps: data.next_steps || ['Try again'],
          error: data.error || `HTTP error! status: ${response.status}`
        };
      }

      console.log('🚀 Wallet setup response:', data);
      return data;

    } catch (error) {
      console.error('Error setting up wallet:', error);
      return {
        success: false,
        message: 'Failed to setup wallet',
        next_steps: ['Check your internet connection', 'Try again'],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async verifyWallet(code: string): Promise<WalletVerifyResponse> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No auth token available');
      }

      console.log('✅ Verifying wallet with code...');

      const response = await fetch(`${this.baseUrl}/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      });

      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Wallet verification failed',
          next_steps: data.next_steps || ['Try again'],
          error: data.error || `HTTP error! status: ${response.status}`
        };
      }

      console.log('✅ Wallet verification response:', data);
      return data;

    } catch (error) {
      console.error('Error verifying wallet:', error);
      return {
        success: false,
        message: 'Failed to verify wallet',
        next_steps: ['Check your verification code', 'Try again'],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async recoverWallet(code: string): Promise<{
    success: boolean;
    message: string;
    next_steps: string[];
    error?: string;
  }> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No auth token available');
      }

      console.log('🔄 Recovering wallet access...');

      const response = await fetch(`${this.baseUrl}/recover`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      });

      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Wallet recovery failed',
          next_steps: data.next_steps || ['Try again'],
          error: data.error || `HTTP error! status: ${response.status}`
        };
      }

      console.log('🔄 Wallet recovery response:', data);
      return data;

    } catch (error) {
      console.error('Error recovering wallet:', error);
      return {
        success: false,
        message: 'Failed to recover wallet',
        next_steps: ['Check your recovery code', 'Try again'],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const walletService = new WalletService();

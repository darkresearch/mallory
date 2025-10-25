import { GridClient } from '@sqds/grid';
import { secureStorage, config } from '@/lib';

/**
 * Grid Client Service
 * Handles all Grid operations on the client side
 * - Account creation and verification
 * - Transaction signing (never sends session secrets to backend)
 * - Spending limit management
 */
class GridClientService {
  private client: GridClient;
  
  constructor() {
    this.client = new GridClient({
      environment: (config.gridEnv || 'sandbox') as 'sandbox' | 'production',
      apiKey: config.gridApiKey!,
      baseUrl: 'https://grid.squads.xyz'
    });
    
    console.log('🔐 Grid client initialized:', config.gridEnv);
  }

  /**
   * Create Grid account with email-based authentication
   * Generates and stores session secrets locally (never sent to backend)
   */
  async createAccount(email: string) {
    try {
      console.log('🔐 Creating Grid account for:', email);
      
      // Initiate account creation - Grid sends OTP to email
      const response = await this.client.createAccount({ email });
      
      // Generate session secrets (stored client-side only)
      const sessionSecrets = await this.client.generateSessionSecrets();
      
      // Store session secrets securely
      await secureStorage.setItem('grid_session_secrets', JSON.stringify(sessionSecrets));
      
      console.log('✅ Grid account creation initiated, OTP sent');
      
      return { 
        user: response.data, 
        sessionSecrets 
      };
    } catch (error) {
      console.error('❌ Grid account creation error:', error);
      throw error;
    }
  }

  /**
   * Verify OTP code and complete account setup
   */
  async verifyAccount(user: any, otpCode: string) {
    try {
      console.log('🔐 Verifying Grid account with OTP');
      
      // Retrieve session secrets from secure storage
      const sessionSecretsJson = await secureStorage.getItem('grid_session_secrets');
      if (!sessionSecretsJson) {
        throw new Error('Session secrets not found. Please create account first.');
      }
      
      const sessionSecrets = JSON.parse(sessionSecretsJson);
      
      // Complete authentication and create account
      const authResult = await this.client.completeAuthAndCreateAccount({
        user,
        otpCode,
        sessionSecrets
      });
      
      if (authResult.success && authResult.data) {
        // Store account data
        await secureStorage.setItem('grid_account', JSON.stringify(authResult.data));
        
        console.log('✅ Grid account verified:', authResult.data.address);
      }
      
      return authResult;
    } catch (error) {
      console.error('❌ Grid verification error:', error);
      throw error;
    }
  }

  /**
   * Get stored Grid account
   */
  async getAccount() {
    const accountJson = await secureStorage.getItem('grid_account');
    return accountJson ? JSON.parse(accountJson) : null;
  }

  /**
   * Sign and send transaction (CLIENT-SIDE ONLY)
   * Session secrets never leave the device
   */
  async signAndSendTransaction(transactionPayload: any) {
    try {
      console.log('🔐 Signing transaction client-side');
      
      // Retrieve session secrets (stored securely, never sent to backend)
      const sessionSecretsJson = await secureStorage.getItem('grid_session_secrets');
      if (!sessionSecretsJson) {
        throw new Error('Session secrets not found');
      }
      
      const sessionSecrets = JSON.parse(sessionSecretsJson);
      
      // Retrieve account data
      const accountJson = await secureStorage.getItem('grid_account');
      if (!accountJson) {
        throw new Error('Grid account not found');
      }
      
      const account = JSON.parse(accountJson);
      
      // Sign and send (all happens client-side)
      const signature = await this.client.signAndSend({
        sessionSecrets,
        session: account.authentication,
        transactionPayload,
        address: account.address
      });
      
      console.log('✅ Transaction signed and sent:', signature);
      
      return signature;
    } catch (error) {
      console.error('❌ Transaction signing error:', error);
      throw error;
    }
  }

  /**
   * Create spending limit transaction
   * Returns transaction payload to be signed
   */
  async createSpendingLimit(address: string, payload: {
    amount: number;
    mint: string;
    period: 'one_time' | 'daily' | 'weekly' | 'monthly';
    destinations: string[];
  }) {
    try {
      console.log('🔐 Creating spending limit:', payload);
      
      const result = await this.client.createSpendingLimit(address, payload);
      
      console.log('✅ Spending limit created, ready to sign');
      
      return result;
    } catch (error) {
      console.error('❌ Spending limit creation error:', error);
      throw error;
    }
  }

  /**
   * Get account balances
   */
  async getAccountBalances(address: string) {
    try {
      const balances = await this.client.getAccountBalances(address);
      return balances;
    } catch (error) {
      console.error('❌ Balance fetch error:', error);
      throw error;
    }
  }

  /**
   * Get spending limits
   */
  async getSpendingLimits(address: string) {
    try {
      const limits = await this.client.getSpendingLimits(address);
      return limits;
    } catch (error) {
      console.error('❌ Spending limits fetch error:', error);
      throw error;
    }
  }

  /**
   * Clear stored Grid data (logout)
   */
  async clearAccount() {
    await secureStorage.removeItem('grid_session_secrets');
    await secureStorage.removeItem('grid_account');
    console.log('🔐 Grid account data cleared');
  }
}

export const gridClientService = new GridClientService();


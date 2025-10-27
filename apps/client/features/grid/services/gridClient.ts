import { secureStorage, config } from '@/lib';

/**
 * Grid Client Service
 * Proxies all Grid operations through backend to avoid CORS and protect API key
 * - Account creation and verification (via backend proxy)
 * - Transaction signing (via backend proxy with session secrets)
 * - Session secrets generated and stored client-side, sent to backend only for signing
 */
class GridClientService {
  constructor() {
    console.log('🔐 Grid client service initialized (backend proxy mode)');
  }

  /**
   * Create Grid account with email-based authentication
   * Generates and stores session secrets locally (never sent to backend)
   * Uses backend proxy to avoid CORS issues
   */
  async createAccount(email: string) {
    try {
      console.log('🔐 Creating Grid account for:', email);
      
      // Call backend proxy (avoids CORS)
      const backendUrl = config.backendApiUrl || 'http://localhost:3001';
      const token = await secureStorage.getItem('mallory_auth_token');
      
      const response = await fetch(`${backendUrl}/api/grid/init-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, isReauth: false })
      });
      
      const data = await response.json();
      
      console.log('🔐 Backend proxy response:', data);
      
      if (!data.success || !data.user) {
        throw new Error(`Grid account creation failed: ${data.error || 'Unknown error'}`);
      }
      
      // Generate session secrets (client-side only, never sent to backend until needed for signing)
      // Import Grid SDK just for this utility function
      const { GridClient } = await import('@sqds/grid');
      const tempClient = new GridClient({
        environment: (config.gridEnv || 'production') as 'sandbox' | 'production',
        apiKey: 'temp', // Not used for generateSessionSecrets
        baseUrl: 'https://grid.squads.xyz'
      });
      const sessionSecrets = await tempClient.generateSessionSecrets();
      
      // Store session secrets securely
      await secureStorage.setItem('grid_session_secrets', JSON.stringify(sessionSecrets));
      
      console.log('✅ Grid account creation initiated, OTP sent');
      
      return { 
        user: data.user, 
        sessionSecrets 
      };
    } catch (error) {
      console.error('❌ Grid account creation error:', error);
      throw error;
    }
  }

  /**
   * Verify OTP code and complete account setup
   * Uses backend proxy to avoid CORS issues
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
      
      // Call backend proxy to complete auth (avoids CORS)
      const backendUrl = config.backendApiUrl || 'http://localhost:3001';
      const token = await secureStorage.getItem('mallory_auth_token');
      
      const response = await fetch(`${backendUrl}/api/grid/verify-otp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          user, 
          otpCode, 
          sessionSecrets,
          isReauth: false 
        })
      });
      
      const authResult = await response.json();
      
      console.log('🔐 Backend proxy verification response:', authResult);
      
      if (!authResult.success || !authResult.data) {
        throw new Error(`Verification failed: ${authResult.error || 'Unknown error'}`);
      }
      
      // Store account data
      await secureStorage.setItem('grid_account', JSON.stringify(authResult.data));
      
      console.log('✅ Grid account verified:', authResult.data.address);
      
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
   * Re-authenticate to existing Grid account
   * Used when logging in from a new device or when session expires
   * Uses backend proxy to avoid CORS issues
   */
  async reauthenticateAccount(email: string) {
    try {
      console.log('🔄 Re-authenticating to existing Grid account:', email);
      
      // Call backend proxy (avoids CORS)
      const backendUrl = config.backendApiUrl || 'http://localhost:3001';
      const token = await secureStorage.getItem('mallory_auth_token');
      
      const response = await fetch(`${backendUrl}/api/grid/init-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, isReauth: true })
      });
      
      const data = await response.json();
      
      console.log('🔄 Backend proxy response:', data);
      
      if (!data.success || !data.user) {
        throw new Error(`Grid re-authentication failed: ${data.error || 'Unknown error'}`);
      }
      
      // Generate NEW session secrets for this device/browser
      const { GridClient } = await import('@sqds/grid');
      const tempClient = new GridClient({
        environment: (config.gridEnv || 'production') as 'sandbox' | 'production',
        apiKey: 'temp',
        baseUrl: 'https://grid.squads.xyz'
      });
      const sessionSecrets = await tempClient.generateSessionSecrets();
      
      // Store session secrets securely
      await secureStorage.setItem('grid_session_secrets', JSON.stringify(sessionSecrets));
      
      console.log('✅ Grid re-authentication initiated, OTP sent');
      
      return {
        user: data.user,
        sessionSecrets
      };
    } catch (error) {
      console.error('❌ Grid re-authentication error:', error);
      throw error;
    }
  }

  /**
   * Complete re-authentication with OTP
   * Used for existing accounts (different from verifyAccount which is for new accounts)
   * Uses backend proxy to avoid CORS issues
   */
  async completeReauthentication(user: any, otpCode: string) {
    try {
      console.log('🔄 Completing re-authentication with OTP');
      
      // Retrieve session secrets from secure storage
      const sessionSecretsJson = await secureStorage.getItem('grid_session_secrets');
      if (!sessionSecretsJson) {
        throw new Error('Session secrets not found. Please re-authenticate.');
      }
      
      const sessionSecrets = JSON.parse(sessionSecretsJson);
      
      // Call backend proxy to complete auth (avoids CORS)
      const backendUrl = config.backendApiUrl || 'http://localhost:3001';
      const token = await secureStorage.getItem('mallory_auth_token');
      
      const response = await fetch(`${backendUrl}/api/grid/verify-otp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          user, 
          otpCode, 
          sessionSecrets,
          isReauth: true 
        })
      });
      
      const authResult = await response.json();
      
      console.log('🔄 Backend proxy verification response:', authResult);
      
      if (!authResult.success || !authResult.data) {
        throw new Error(`Re-authentication failed: ${authResult.error || 'Unknown error'}`);
      }
      
      // Store account data
      await secureStorage.setItem('grid_account', JSON.stringify(authResult.data));
      
      console.log('✅ Grid re-authentication successful:', authResult.data.address);
      
      return authResult;
    } catch (error) {
      console.error('❌ Grid re-authentication completion error:', error);
      throw error;
    }
  }

  /**
   * Get account balances
   * Calls Grid SDK via backend proxy
   */
  async getAccountBalances(address: string) {
    try {
      // For now, proxy through backend or use Grid SDK temporarily
      // This is less critical than sendTokens, can be implemented later if needed
      const { GridClient } = await import('@sqds/grid');
      const tempClient = new GridClient({
        environment: (config.gridEnv || 'production') as 'sandbox' | 'production',
        apiKey: config.gridApiKey || 'temp',
        baseUrl: 'https://grid.squads.xyz'
      });
      const balances = await tempClient.getAccountBalances(address);
      return balances;
    } catch (error) {
      console.error('❌ Balance fetch error:', error);
      throw error;
    }
  }

  /**
   * Send tokens (SOL or SPL) from Grid wallet
   * Proxies through backend to avoid CORS and protect Grid API key
   */
  async sendTokens(params: {
    recipient: string;
    amount: string;
    tokenMint?: string;
  }): Promise<string> {
    try {
      console.log('💸 Sending tokens via Grid (backend proxy):', params);

      const { recipient, amount, tokenMint } = params;
      
      // Retrieve session secrets and account
      const sessionSecretsJson = await secureStorage.getItem('grid_session_secrets');
      if (!sessionSecretsJson) {
        throw new Error('Session secrets not found');
      }
      
      const sessionSecrets = JSON.parse(sessionSecretsJson);
      
      const accountJson = await secureStorage.getItem('grid_account');
      if (!accountJson) {
        throw new Error('Grid account not found');
      }
      
      const account = JSON.parse(accountJson);

      // Call backend proxy
      const backendUrl = config.backendApiUrl || 'http://localhost:3001';
      const token = await secureStorage.getItem('mallory_auth_token');
      
      const response = await fetch(`${backendUrl}/api/grid/send-tokens`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient,
          amount,
          tokenMint,
          sessionSecrets,
          session: account.authentication,
          address: account.address
        })
      });

      const result = await response.json();
      
      if (!result.success || !result.signature) {
        throw new Error(result.error || 'Failed to send tokens');
      }

      console.log('✅ Tokens sent via Grid:', result.signature);
      
      return result.signature;
    } catch (error) {
      console.error('❌ Token send error:', error);
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


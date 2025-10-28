import { secureStorage, config } from '@/lib';
import { GridClient } from '@sqds/grid';

/**
 * Grid Client Service
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * GRID'S TWO-TIER AUTHENTICATION MODEL (Client Perspective)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This service provides a simple, clean API for Grid authentication.
 * ALL complexity is handled by the backend - the client just calls methods.
 * 
 * 🎯 KEY PRINCIPLE: Backend-Driven Authentication
 * ───────────────────────────────────────────────
 * - Client never needs to know if user is beginner or advanced
 * - Client never needs to know which Grid API to call
 * - Client just calls startSignIn() and completeSignIn()
 * - Backend automatically:
 *   • Detects user's auth level from app_metadata
 *   • Chooses correct Grid API flow
 *   • Handles migration for existing users
 *   • Upgrades users after first successful sign-in
 * 
 * 📱 CLIENT API (Only 3 Methods!)
 * ──────────────────────────────
 * 1. startSignIn(email)
 *    - Initiates sign-in for ANY user (first-time or returning)
 *    - Backend sends OTP via email
 *    - Returns user object for OTP verification
 * 
 * 2. completeSignIn(user, otpCode)
 *    - Completes sign-in for ANY user
 *    - Backend verifies OTP and creates/authenticates account
 *    - Returns authentication data
 * 
 * 3. getAccount()
 *    - Gets stored Grid account from secure storage
 *    - Used to check if user is already signed in
 * 
 * 🔒 SECURITY ARCHITECTURE
 * ───────────────────────
 * - Session secrets generated client-side (never leave device until needed)
 * - Backend proxies all Grid SDK calls (protects API key, avoids CORS)
 * - Auth level tracked in Supabase app_metadata (server-side only)
 * - Users cannot manipulate their auth level
 * 
 * 🔄 TYPICAL FLOW
 * ──────────────
 * 1. User opens app
 * 2. Check getAccount() - if exists, user is signed in
 * 3. If not signed in:
 *    a. Call startSignIn(email) → OTP sent
 *    b. User enters OTP
 *    c. Call completeSignIn(user, otp) → Account ready
 * 4. User can now make transactions
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

class GridClientService {
  constructor() {
    console.log('🔐 Grid client service initialized (backend proxy mode)');
  }

  /**
   * Start Grid sign-in process
   * 
   * Works for BOTH first-time users AND returning users.
   * Backend automatically determines which flow to use.
   * 
   * BACKEND BEHAVIOR:
   * ────────────────
   * • First-time users: Uses gridClient.createAccount(email)
   * • Returning users: Uses gridClient.initAuth(email)
   * • Migration users: Detects existing account, upgrades, retries
   * 
   * WHAT HAPPENS:
   * ────────────
   * 1. Backend determines user's auth level
   * 2. Backend calls appropriate Grid API
   * 3. Grid sends OTP to user's email
   * 4. Backend returns user object for OTP verification
   * 
   * NOTE: Session secrets are NOT generated here. They're generated
   * on-demand in completeSignIn() when we actually need them for verification.
   * 
   * @param email - User's email address
   * @returns Promise with { user } - Grid user object for OTP verification
   * @throws Error if backend request fails
   * 
   * USAGE:
   * ─────
   * const { user } = await gridClientService.startSignIn('user@example.com');
   * // User receives OTP via email
   * // Show OTP input modal
   */
  async startSignIn(email: string) {
    try {
      console.log('🔐 [Grid Client] Starting sign-in for:', email);
      
      // Call backend proxy (backend determines beginner vs advanced flow)
      const backendUrl = config.backendApiUrl || 'http://localhost:3001';
      const token = await secureStorage.getItem('mallory_auth_token');
      
      const response = await fetch(`${backendUrl}/api/grid/start-sign-in`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      
      console.log('🔐 [Grid Client] Backend response:', data);
      
      if (!data.success || !data.user) {
        throw new Error(`Sign-in failed: ${data.error || 'Unknown error'}`);
      }
      
      console.log('✅ [Grid Client] Sign-in started, OTP sent to email');
      
      return { 
        user: data.user
      };
    } catch (error) {
      console.error('❌ [Grid Client] Sign-in start error:', error);
      throw error;
    }
  }

  /**
   * Complete Grid sign-in with OTP code
   * 
   * Works for BOTH first-time users AND returning users.
   * Backend automatically determines which flow to use.
   * 
   * BACKEND BEHAVIOR:
   * ────────────────
   * • First-time users: Uses gridClient.completeAuthAndCreateAccount()
   *   - Creates Grid account
   *   - Upgrades user to advanced level
   * • Returning users: Uses gridClient.completeAuth()
   *   - Re-authenticates existing account
   * 
   * SESSION SECRETS:
   * ───────────────
   * Session secrets are generated HERE (not in startSignIn) because:
   * 1. They're just cryptographic keys, not tied to OTP timing
   * 2. Generate on-demand = simpler, no storage between steps
   * 3. If OTP expires, we generate fresh secrets on retry
   * 
   * After generation, they're stored permanently because:
   * - They never expire (unless manually revoked)
   * - They're reused for all future transactions
   * - Think of them as "device credentials"
   * 
   * WHAT HAPPENS:
   * ────────────
   * 1. Generate session secrets (cryptographic keys)
   * 2. Backend verifies OTP + creates/authenticates account
   * 3. Backend syncs Grid address to database
   * 4. Client stores account data + session secrets
   * 5. User is now signed in and can make transactions
   * 
   * FOR FIRST-TIME USERS:
   * ────────────────────
   * After successful verification, backend automatically:
   * • Sets app_metadata['grid-advanced'] = true
   * • User is PERMANENTLY upgraded to advanced level
   * • All future sign-ins will use advanced flow
   * 
   * @param user - Grid user object from startSignIn()
   * @param otpCode - 6-digit OTP code from email
   * @returns Promise with authentication result
   * @throws Error if verification fails
   * 
   * USAGE:
   * ─────
   * const result = await gridClientService.completeSignIn(user, '123456');
   * if (result.success) {
   *   console.log('Signed in! Address:', result.data.address);
   * }
   */
  async completeSignIn(user: any, otpCode: string) {
    try {
      console.log('🔐 [Grid Client] Completing sign-in with OTP');
      
      // Generate session secrets on-demand (not stored between start/complete)
      // These are just cryptographic keys - no need to generate earlier
      console.log('🔐 [Grid Client] Generating session secrets...');
      const tempClient = new GridClient({
        environment: 'production',
        apiKey: 'not-used-for-session-secrets', // GridClient requires apiKey but doesn't use it for generateSessionSecrets
        baseUrl: 'https://grid.squads.xyz'
      });
      const sessionSecrets = await tempClient.generateSessionSecrets();
      console.log('✅ [Grid Client] Session secrets generated');
      
      // Call backend proxy to complete auth (backend determines beginner vs advanced)
      const backendUrl = config.backendApiUrl || 'http://localhost:3001';
      const token = await secureStorage.getItem('mallory_auth_token');
      
      const response = await fetch(`${backendUrl}/api/grid/complete-sign-in`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          user, 
          otpCode, 
          sessionSecrets
        })
      });
      
      const authResult = await response.json();
      
      console.log('🔐 [Grid Client] Sign-in completion response:', authResult);
      
      if (!authResult.success || !authResult.data) {
        throw new Error(`Sign-in completion failed: ${authResult.error || 'Unknown error'}`);
      }
      
      // Store account data (includes authentication tokens)
      await secureStorage.setItem('grid_account', JSON.stringify(authResult.data));
      
      // Store session secrets for future transactions
      // These never expire - they're permanent "device credentials"
      await secureStorage.setItem('grid_session_secrets', JSON.stringify(sessionSecrets));
      
      console.log('✅ [Grid Client] Sign-in complete:', authResult.data.address);
      
      return authResult;
    } catch (error) {
      console.error('❌ [Grid Client] Sign-in completion error:', error);
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
   * Get account balances
   * 
   * NOTE: This method is not implemented. Balance fetching should be done
   * through the backend API to avoid exposing Grid API keys.
   * Use the wallet API endpoints instead: /api/wallet/status or /api/wallet/holdings
   */
  async getAccountBalances(address: string) {
    throw new Error('getAccountBalances should not be called from client. Use backend API endpoints instead.');
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


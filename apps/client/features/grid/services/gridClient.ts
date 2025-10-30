import { secureStorage, config, SECURE_STORAGE_KEYS, SESSION_STORAGE_KEYS } from '@/lib';
import { GridClient } from '@sqds/grid';

/**
 * Grid Client Service
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * STATELESS GRID AUTHENTICATION (Client Perspective)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This service provides a simple, clean API for Grid authentication using the
 * STATELESS FLOW HINT pattern. All complexity is handled by the backend.
 *
 * 🎯 KEY PRINCIPLE: Stateless Flow Hint Pattern
 * ─────────────────────────────────────────────
 * - Client stores isExistingUser hint between start/complete phases
 * - Backend uses hint to optimize API method selection
 * - Backend has bidirectional fallback if hint is wrong
 * - NO server-side state management required
 * - Grid API is the source of truth
 *
 * 📱 CLIENT API (Only 3 Methods!)
 * ──────────────────────────────
 * 1. startSignIn(email)
 *    - Initiates sign-in for ANY user (first-time or returning)
 *    - Backend detects user type via Grid API
 *    - Returns { user, isExistingUser } - hint stored for next phase
 *
 * 2. completeSignIn(user, otpCode)
 *    - Completes sign-in for ANY user
 *    - Passes isExistingUser hint to backend
 *    - Backend verifies with retry logic + fallback
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
 * - Flow hint is optimization only (Grid API validates everything)
 * - Bidirectional fallback handles corrupted hints
 *
 * 🔄 TYPICAL FLOW
 * ──────────────
 * 1. User opens app
 * 2. Check getAccount() - if exists, user is signed in
 * 3. If not signed in:
 *    a. Call startSignIn(email) → OTP sent, hint stored
 *    b. User enters OTP
 *    c. Call completeSignIn(user, otp) → Passes hint → Account ready
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
   * Works for BOTH first-time users AND returning users using STATELESS FLOW HINT pattern.
   * Backend automatically detects user type and returns isExistingUser hint.
   *
   * BACKEND BEHAVIOR (Stateless Detection):
   * ──────────────────────────────────────
   * • Always tries createAccount() first (optimistic for new users)
   * • If account exists, falls back to initAuth()
   * • Returns isExistingUser flag to guide completion flow
   * • NO DATABASE LOOKUP - Grid API is the source of truth
   *
   * WHAT HAPPENS:
   * ────────────
   * 1. Backend tries createAccount() → if success, user is NEW
   * 2. If "already exists" error → Backend tries initAuth() → user is EXISTING
   * 3. Grid sends OTP to user's email
   * 4. Backend returns { user, isExistingUser }
   * 5. Client stores isExistingUser hint for completeSignIn()
   *
   * FLOW HINT STORAGE:
   * ─────────────────
   * The isExistingUser flag is stored in sessionStorage (web) or memory (mobile)
   * to pass from startSignIn → completeSignIn without server-side state.
   *
   * @param email - User's email address
   * @returns Promise with { user, isExistingUser } - Grid user object + flow hint
   * @throws Error if backend request fails
   *
   * USAGE:
   * ─────
   * const { user, isExistingUser } = await gridClientService.startSignIn('user@example.com');
   * // isExistingUser is stored internally for completeSignIn()
   * // User receives OTP via email
   * // Show OTP input modal
   */
  async startSignIn(email: string) {
    try {
      console.log('🔐 [Grid Client] Starting sign-in for:', email);

      // Call backend proxy (backend uses stateless detection)
      const backendUrl = config.backendApiUrl || 'http://localhost:3001';
      const token = await secureStorage.getItem(SECURE_STORAGE_KEYS.AUTH_TOKEN);

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

      // Store flow hint for completeSignIn()
      // This is the KEY to the stateless pattern - passing hint between phases
      // CRITICAL: Use sessionStorage (temporary) not secureStorage (persistent)
      const isExistingUser = data.isExistingUser ?? false;
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem(SESSION_STORAGE_KEYS.GRID_IS_EXISTING_USER, String(isExistingUser));
      }

      console.log(`✅ [Grid Client] Sign-in started, OTP sent to email (${isExistingUser ? 'existing' : 'new'} user)`);

      return {
        user: data.user,
        isExistingUser
      };
    } catch (error) {
      console.error('❌ [Grid Client] Sign-in start error:', error);
      throw error;
    }
  }

  /**
   * Complete Grid sign-in with OTP code
   *
   * Works for BOTH first-time users AND returning users using FLOW HINT pattern.
   * Passes isExistingUser hint to backend for optimal API method selection.
   *
   * BACKEND BEHAVIOR (Flow Hint + Retry + Fallback):
   * ────────────────────────────────────────────────
   * • Existing users (hint=true): Uses completeAuth()
   *   - Single attempt, fallback to completeAuthAndCreateAccount() if fails
   * • New users (hint=false): Uses completeAuthAndCreateAccount()
   *   - 3 retry attempts with 1s delay (handles rate limiting)
   *   - Fallback to completeAuth() after 3 failures
   * • Bidirectional fallback handles wrong hints gracefully
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
   * 1. Retrieve isExistingUser hint from storage
   * 2. Generate session secrets (cryptographic keys)
   * 3. Backend verifies OTP with retry logic + fallback
   * 4. Backend syncs Grid address to database
   * 5. Client stores account data + session secrets
   * 6. User is now signed in and can make transactions
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

      // Retrieve flow hint from storage (set in startSignIn)
      // CRITICAL: Read from sessionStorage where we stored it
      const isExistingUserStr = typeof window !== 'undefined' && window.sessionStorage
        ? sessionStorage.getItem(SESSION_STORAGE_KEYS.GRID_IS_EXISTING_USER)
        : null;
      const isExistingUser = isExistingUserStr === 'true';

      console.log(`🔐 [Grid Client] Flow hint: ${isExistingUser ? 'existing' : 'new'} user`);

      // Generate session secrets on-demand (not stored between start/complete)
      // These are just cryptographic keys - no need to generate earlier
      console.log('🔐 [Grid Client] Generating session secrets...');

      // IMPORTANT: Use same environment as backend (from config)
      const gridEnv = (process.env.EXPO_PUBLIC_GRID_ENV || 'production') as 'sandbox' | 'production';
      console.log(`🔐 [Grid Client] Using Grid environment: ${gridEnv}`);

      const tempClient = new GridClient({
        environment: gridEnv,
        apiKey: 'not-used-for-session-secrets', // GridClient requires apiKey but doesn't use it for generateSessionSecrets
        baseUrl: 'https://grid.squads.xyz'
      });
      const sessionSecrets = await tempClient.generateSessionSecrets();
      console.log('✅ [Grid Client] Session secrets generated');

      // Call backend proxy to complete auth (passes flow hint for optimal routing)
      const backendUrl = config.backendApiUrl || 'http://localhost:3001';
      const token = await secureStorage.getItem(SECURE_STORAGE_KEYS.AUTH_TOKEN);

      const response = await fetch(`${backendUrl}/api/grid/complete-sign-in`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user,
          otpCode,
          sessionSecrets,
          isExistingUser // Flow hint for backend routing
        })
      });

      const authResult = await response.json();

      console.log('🔐 [Grid Client] Sign-in completion response:', authResult);

      if (!authResult.success || !authResult.data) {
        throw new Error(`Sign-in completion failed: ${authResult.error || 'Unknown error'}`);
      }

      // Store account data (includes authentication tokens)
      await secureStorage.setItem(SECURE_STORAGE_KEYS.GRID_ACCOUNT, JSON.stringify(authResult.data));

      // Store session secrets for future transactions
      // These never expire - they're permanent "device credentials"
      await secureStorage.setItem(SECURE_STORAGE_KEYS.GRID_SESSION_SECRETS, JSON.stringify(sessionSecrets));

      // Clean up flow hint (no longer needed)
      // CRITICAL: Remove from sessionStorage where we stored it
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem(SESSION_STORAGE_KEYS.GRID_IS_EXISTING_USER);
      }

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
    const accountJson = await secureStorage.getItem(SECURE_STORAGE_KEYS.GRID_ACCOUNT);
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
      const sessionSecretsJson = await secureStorage.getItem(SECURE_STORAGE_KEYS.GRID_SESSION_SECRETS);
      if (!sessionSecretsJson) {
        throw new Error('Session secrets not found');
      }
      
      const sessionSecrets = JSON.parse(sessionSecretsJson);
      
      const accountJson = await secureStorage.getItem(SECURE_STORAGE_KEYS.GRID_ACCOUNT);
      if (!accountJson) {
        throw new Error('Grid account not found');
      }
      
      const account = JSON.parse(accountJson);

      // Call backend proxy
      const backendUrl = config.backendApiUrl || 'http://localhost:3001';
      const token = await secureStorage.getItem(SECURE_STORAGE_KEYS.AUTH_TOKEN);
      
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
    await secureStorage.removeItem(SECURE_STORAGE_KEYS.GRID_SESSION_SECRETS);
    await secureStorage.removeItem(SECURE_STORAGE_KEYS.GRID_ACCOUNT);
    console.log('🔐 Grid account data cleared');
  }
}

export const gridClientService = new GridClientService();


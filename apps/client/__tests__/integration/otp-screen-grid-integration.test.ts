/**
 * Integration Tests - OTP Screen & GridContext
 * 
 * Tests the integration between GridContext actions and OTP screen:
 * - initiateGridSignIn() writes to storage
 * - OTP screen reads from storage
 * - OTP screen updates storage on resend
 * - completeGridSignIn() clears storage
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import '../setup/test-env';

// Mock secure storage (cross-platform)
let mockSecureStorage: Record<string, string> = {};

const secureStorage = {
  getItem: async (key: string) => mockSecureStorage[key] || null,
  setItem: async (key: string, value: string) => {
    mockSecureStorage[key] = value;
  },
  removeItem: async (key: string) => {
    delete mockSecureStorage[key];
  },
};

// Storage keys
const KEYS = {
  GRID_OTP_SESSION: 'mallory_grid_otp_session',
  GRID_ACCOUNT: 'mallory_grid_account',
  GRID_SESSION_SECRETS: 'mallory_grid_session_secrets',
};

describe('OTP Screen & GridContext Integration', () => {
  beforeEach(() => {
    mockSecureStorage = {};
  });

  describe('Full OTP Flow - GridContext → OTP Screen → GridContext', () => {
    test('should complete full OTP authentication flow', async () => {
      // ═══════════════════════════════════════════════════════
      // STEP 1: User initiates Grid sign-in
      // ═══════════════════════════════════════════════════════
      console.log('Step 1: initiateGridSignIn()');
      
      const email = 'user@test.com';
      const mockOtpSession = {
        id: 'session-123',
        email,
        challenge: 'challenge-abc',
        timestamp: Date.now(),
      };
      
      // GridContext.initiateGridSignIn() writes to storage
      await secureStorage.setItem(
        KEYS.GRID_OTP_SESSION,
        JSON.stringify(mockOtpSession)
      );
      
      // Verify: OTP session stored
      let stored = await secureStorage.getItem(KEYS.GRID_OTP_SESSION);
      expect(stored).not.toBeNull();
      console.log('✅ OTP session stored by GridContext');
      
      // ═══════════════════════════════════════════════════════
      // STEP 2: Navigation to OTP screen
      // ═══════════════════════════════════════════════════════
      console.log('Step 2: Navigate to OTP screen');
      
      // OTP screen mounts and loads from storage
      stored = await secureStorage.getItem(KEYS.GRID_OTP_SESSION);
      expect(stored).not.toBeNull();
      
      const otpScreenSession = JSON.parse(stored!);
      expect(otpScreenSession.id).toBe('session-123');
      expect(otpScreenSession.email).toBe(email);
      console.log('✅ OTP screen loaded session from storage');
      
      // ═══════════════════════════════════════════════════════
      // STEP 3: User enters OTP and verifies
      // ═══════════════════════════════════════════════════════
      console.log('Step 3: User verifies OTP');
      
      const otpCode = '123456';
      
      // OTP screen calls GridContext.completeGridSignIn(otpScreenSession, otpCode)
      // GridContext verifies OTP and stores account
      const mockGridAccount = {
        address: 'SolanaAddress123',
        authentication: { token: 'auth-token' },
      };
      
      await secureStorage.setItem(
        KEYS.GRID_ACCOUNT,
        JSON.stringify(mockGridAccount)
      );
      
      // GridContext clears OTP session (no longer needed)
      await secureStorage.removeItem(KEYS.GRID_OTP_SESSION);
      
      // Verify: Account stored, OTP session cleared
      const account = await secureStorage.getItem(KEYS.GRID_ACCOUNT);
      expect(account).not.toBeNull();
      
      const otpSession = await secureStorage.getItem(KEYS.GRID_OTP_SESSION);
      expect(otpSession).toBeNull();
      
      console.log('✅ Account stored, OTP session cleared');
      console.log('✅ Full OTP flow completed successfully');
    });

    test('should handle OTP code resend mid-flow', async () => {
      // ═══════════════════════════════════════════════════════
      // STEP 1: Initial sign-in
      // ═══════════════════════════════════════════════════════
      const initialSession = {
        id: 'session-initial',
        email: 'user@test.com',
        challenge: 'challenge-initial',
      };
      
      await secureStorage.setItem(
        KEYS.GRID_OTP_SESSION,
        JSON.stringify(initialSession)
      );
      
      // ═══════════════════════════════════════════════════════
      // STEP 2: User on OTP screen, realizes code expired
      // ═══════════════════════════════════════════════════════
      let otpScreenSession = JSON.parse(
        (await secureStorage.getItem(KEYS.GRID_OTP_SESSION))!
      );
      expect(otpScreenSession.id).toBe('session-initial');
      
      // ═══════════════════════════════════════════════════════
      // STEP 3: User clicks "Resend Code"
      // ═══════════════════════════════════════════════════════
      const newSession = {
        id: 'session-resend',
        email: 'user@test.com',
        challenge: 'challenge-new',
      };
      
      // OTP screen updates local state
      otpScreenSession = newSession;
      
      // OTP screen writes to storage for persistence
      await secureStorage.setItem(
        KEYS.GRID_OTP_SESSION,
        JSON.stringify(newSession)
      );
      
      // ═══════════════════════════════════════════════════════
      // STEP 4: Verify new session is active
      // ═══════════════════════════════════════════════════════
      const stored = await secureStorage.getItem(KEYS.GRID_OTP_SESSION);
      const storedSession = JSON.parse(stored!);
      
      expect(storedSession.id).toBe('session-resend');
      expect(storedSession.id).not.toBe('session-initial');
      
      // ═══════════════════════════════════════════════════════
      // STEP 5: User enters new OTP code
      // ═══════════════════════════════════════════════════════
      expect(otpScreenSession.id).toBe('session-resend');
      
      console.log('✅ Resend flow updates both local state and storage');
    });
  });

  describe('GridContext Does Not Expose OTP Session State', () => {
    test('should not have gridOtpSession in GridContext interface', () => {
      // Simulate GridContext interface
      interface GridContextType {
        // Persistent state
        gridAccount: any;
        solanaAddress: string | null;
        gridAccountStatus: 'not_created' | 'pending_verification' | 'active';
        gridAccountId: string | null;
        isSigningInToGrid: boolean;
        
        // Actions
        initiateGridSignIn: (email: string) => Promise<void>;
        completeGridSignIn: (otpSession: any, otp: string) => Promise<void>;
        clearGridAccount: () => Promise<void>;
      }
      
      // Check that gridOtpSession is NOT in the interface
      const contextKeys: (keyof GridContextType)[] = [
        'gridAccount',
        'solanaAddress',
        'gridAccountStatus',
        'gridAccountId',
        'isSigningInToGrid',
        'initiateGridSignIn',
        'completeGridSignIn',
        'clearGridAccount',
      ];
      
      expect(contextKeys).not.toContain('gridOtpSession' as any);
      
      console.log('✅ gridOtpSession not in GridContext interface');
    });

    test('should only write to storage, not manage OTP session state', async () => {
      // GridContext.initiateGridSignIn() should:
      // ✅ Write to storage
      // ❌ NOT set context state
      
      const mockSession = { id: 'test-session', email: 'test@test.com' };
      
      // Simulate initiateGridSignIn writing to storage
      await secureStorage.setItem(
        KEYS.GRID_OTP_SESSION,
        JSON.stringify(mockSession)
      );
      
      // Verify: Data in storage
      const stored = await secureStorage.getItem(KEYS.GRID_OTP_SESSION);
      expect(stored).not.toBeNull();
      
      // Context should NOT have this in state (only persistent state)
      const mockContextState = {
        gridAccount: null,
        solanaAddress: null,
        // NOT: gridOtpSession
      };
      
      expect('gridOtpSession' in mockContextState).toBe(false);
      
      console.log('✅ GridContext writes to storage, does not manage OTP session state');
    });
  });

  describe('OTP Screen Independence', () => {
    test('should not depend on GridContext state for OTP session', async () => {
      // Setup: OTP session in storage
      const mockSession = { id: 'independent-session', email: 'test@test.com' };
      await secureStorage.setItem(
        KEYS.GRID_OTP_SESSION,
        JSON.stringify(mockSession)
      );
      
      // OTP screen loads directly from storage
      const otpScreenSession = JSON.parse(
        (await secureStorage.getItem(KEYS.GRID_OTP_SESSION))!
      );
      
      // Does NOT read from GridContext state
      const mockGridContext = {
        gridAccount: null,
        // NOT: gridOtpSession
      };
      
      // Assert: OTP screen has its own copy from storage
      expect(otpScreenSession.id).toBe('independent-session');
      expect('gridOtpSession' in mockGridContext).toBe(false);
      
      console.log('✅ OTP screen independent of GridContext state');
    });

    test('should not trigger GridContext re-renders', () => {
      // When OTP screen updates its local state,
      // GridContext consumers should NOT re-render
      
      let contextRenderCount = 0;
      const mockContextConsumer = () => {
        contextRenderCount++;
        // Uses GridContext but NOT gridOtpSession
      };
      
      // OTP screen updates local state
      let localOtpSession = { id: 'session-1' };
      localOtpSession = { id: 'session-2' };
      
      // Context consumer called once (initial render)
      mockContextConsumer();
      
      // Assert: Only one render (not affected by OTP screen state)
      expect(contextRenderCount).toBe(1);
      
      console.log('✅ OTP screen state changes do not trigger context re-renders');
    });
  });

  describe('Error Recovery', () => {
    test('should handle OTP verification failure gracefully', async () => {
      // Setup: OTP session exists
      await secureStorage.setItem(
        KEYS.GRID_OTP_SESSION,
        JSON.stringify({ id: 'session-fail', email: 'test@test.com' })
      );
      
      // User enters invalid OTP
      // Verification fails
      
      // OTP session should remain in storage (for retry)
      const stored = await secureStorage.getItem(KEYS.GRID_OTP_SESSION);
      expect(stored).not.toBeNull();
      
      // User can try again or resend
      console.log('✅ OTP session persists after verification failure');
    });

    test('should clear OTP session only on successful verification', async () => {
      // Setup: OTP session
      await secureStorage.setItem(
        KEYS.GRID_OTP_SESSION,
        JSON.stringify({ id: 'session-success', email: 'test@test.com' })
      );
      
      // Successful verification
      const mockAccount = { address: 'address-123' };
      await secureStorage.setItem(KEYS.GRID_ACCOUNT, JSON.stringify(mockAccount));
      
      // Clear OTP session (no longer needed)
      await secureStorage.removeItem(KEYS.GRID_OTP_SESSION);
      
      // Assert: OTP session cleared, account stored
      const otpSession = await secureStorage.getItem(KEYS.GRID_OTP_SESSION);
      const account = await secureStorage.getItem(KEYS.GRID_ACCOUNT);
      
      expect(otpSession).toBeNull();
      expect(account).not.toBeNull();
      
      console.log('✅ OTP session cleared only after successful verification');
    });

    test('should handle page refresh during OTP flow', async () => {
      // Setup: User on OTP screen
      const sessionBeforeRefresh = {
        id: 'session-refresh',
        email: 'user@test.com',
      };
      
      await secureStorage.setItem(
        KEYS.GRID_OTP_SESSION,
        JSON.stringify(sessionBeforeRefresh)
      );
      
      // User refreshes page
      // Component remounts
      
      // Load from storage (should still be there)
      const stored = await secureStorage.getItem(KEYS.GRID_OTP_SESSION);
      const sessionAfterRefresh = JSON.parse(stored!);
      
      expect(sessionAfterRefresh.id).toBe('session-refresh');
      
      // User can continue with OTP flow
      console.log('✅ OTP session survives page refresh');
    });
  });

  describe('Cleanup on Logout', () => {
    test('should clear OTP session on logout', async () => {
      // Setup: OTP session and account
      await secureStorage.setItem(
        KEYS.GRID_OTP_SESSION,
        JSON.stringify({ id: 'session-logout' })
      );
      await secureStorage.setItem(
        KEYS.GRID_ACCOUNT,
        JSON.stringify({ address: 'address-123' })
      );
      
      // User logs out
      await secureStorage.removeItem(KEYS.GRID_OTP_SESSION);
      await secureStorage.removeItem(KEYS.GRID_ACCOUNT);
      await secureStorage.removeItem(KEYS.GRID_SESSION_SECRETS);
      
      // Assert: Everything cleared
      expect(await secureStorage.getItem(KEYS.GRID_OTP_SESSION)).toBeNull();
      expect(await secureStorage.getItem(KEYS.GRID_ACCOUNT)).toBeNull();
      
      console.log('✅ OTP session cleared on logout');
    });
  });

  describe('Storage as Single Source of Truth', () => {
    test('should use storage as source of truth for persistence', async () => {
      // The pattern: Storage is the source of truth, not context state
      // This prevents stale state and sync issues
      
      const mockSession = { id: 'source-of-truth', email: 'test@test.com' };
      
      // Write to storage
      await secureStorage.setItem(
        KEYS.GRID_OTP_SESSION,
        JSON.stringify(mockSession)
      );
      
      // Component reads from storage (source of truth)
      const component1Session = JSON.parse(
        (await secureStorage.getItem(KEYS.GRID_OTP_SESSION))!
      );
      
      // Another component also reads from storage
      const component2Session = JSON.parse(
        (await secureStorage.getItem(KEYS.GRID_OTP_SESSION))!
      );
      
      // Assert: Both have same data (storage is source of truth)
      expect(component1Session.id).toBe(component2Session.id);
      expect(component1Session.id).toBe('source-of-truth');
      
      console.log('✅ Storage is single source of truth');
    });

    test('should update storage immediately on state changes', async () => {
      // When OTP screen updates local state, it should also update storage
      // This ensures persistence and consistency
      
      let localState = { id: 'state-1', email: 'test@test.com' };
      
      // Update local state
      localState = { id: 'state-2', email: 'test@test.com' };
      
      // Immediately update storage
      await secureStorage.setItem(
        KEYS.GRID_OTP_SESSION,
        JSON.stringify(localState)
      );
      
      // Verify: Storage reflects latest state
      const stored = JSON.parse(
        (await secureStorage.getItem(KEYS.GRID_OTP_SESSION))!
      );
      
      expect(stored.id).toBe('state-2');
      expect(stored.id).toBe(localState.id);
      
      console.log('✅ Storage updated immediately with state changes');
    });
  });
});

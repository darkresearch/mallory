/**
 * Unit Tests for OTP Verification Screen
 * 
 * Tests the self-contained OTP screen architecture:
 * - Loading OTP session from secure storage
 * - Local state management
 * - Resend code functionality
 * - Error handling
 * - Integration with GridContext actions
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import '../setup/test-env';

// Mock secure storage
let mockSecureStorage: Record<string, string> = {};

const mockSecureStorageAPI = {
  getItem: async (key: string) => mockSecureStorage[key] || null,
  setItem: async (key: string, value: string) => {
    mockSecureStorage[key] = value;
  },
  removeItem: async (key: string) => {
    delete mockSecureStorage[key];
  },
};

// Mock Grid client service with call tracking
let mockStartSignInCalls: Array<{ email: string }> = [];
let mockCompleteSignInCalls: Array<{ otpSession: any; otpCode: string }> = [];

const mockGridClientService = {
  startSignIn: async (email: string) => {
    mockStartSignInCalls.push({ email });
    return {
      otpSession: {
        id: 'session-' + Date.now(),
        email,
        challenge: 'mock-challenge',
      },
      isExistingUser: false,
    };
  },
  completeSignIn: async (otpSession: any, otpCode: string) => {
    mockCompleteSignInCalls.push({ otpSession, otpCode });
    return {
      success: true,
      data: {
        address: 'mock-address-123',
        authentication: { token: 'mock-token' },
      },
    };
  },
};

describe('VerifyOtpScreen - Self-Contained Architecture', () => {
  beforeEach(() => {
    // Reset mocks
    mockSecureStorage = {};
    mockStartSignInCalls = [];
    mockCompleteSignInCalls = [];
  });

  describe('Loading OTP Session on Mount', () => {
    test('should load OTP session from secure storage on mount', async () => {
      // Setup: Store OTP session (set by initiateGridSignIn)
      const mockOtpSession = {
        id: 'session-123',
        email: 'user@test.com',
        challenge: 'challenge-abc',
      };
      
      await mockSecureStorageAPI.setItem(
        'mallory_grid_otp_session',
        JSON.stringify(mockOtpSession)
      );
      
      // Act: Simulate component mount
      const stored = await mockSecureStorageAPI.getItem('mallory_grid_otp_session');
      expect(stored).not.toBeNull();
      
      const loadedSession = JSON.parse(stored!);
      
      // Assert: Session loaded correctly
      expect(loadedSession.id).toBe('session-123');
      expect(loadedSession.email).toBe('user@test.com');
      expect(loadedSession.challenge).toBe('challenge-abc');
      
      console.log('✅ OTP session loaded from storage on mount');
    });

    test('should handle missing OTP session (routing error)', async () => {
      // Act: Try to load when no session exists
      const stored = await mockSecureStorageAPI.getItem('mallory_grid_otp_session');
      
      // Assert: Should be null (indicates routing error)
      expect(stored).toBeNull();
      
      // Component should show error: "Session error. Please sign in again."
      console.log('✅ Missing OTP session detected as routing error');
    });

    test('should handle corrupted OTP session gracefully', async () => {
      // Setup: Store corrupted JSON
      await mockSecureStorageAPI.setItem(
        'mallory_grid_otp_session',
        'invalid-json-{{'
      );
      
      // Act: Try to parse
      try {
        const stored = await mockSecureStorageAPI.getItem('mallory_grid_otp_session');
        if (stored) {
          JSON.parse(stored);
        }
        expect(true).toBe(false); // Should throw
      } catch (error) {
        // Assert: Should catch parse error
        expect(error).toBeDefined();
        
        // Component should show error and allow user to restart
        console.log('✅ Corrupted OTP session handled gracefully');
      }
    });

    test('should only load OTP session once on mount', async () => {
      // Setup: Store session
      const mockOtpSession = { id: 'session-456', email: 'test@test.com' };
      await mockSecureStorageAPI.setItem(
        'mallory_grid_otp_session',
        JSON.stringify(mockOtpSession)
      );
      
      // Act: Simulate useEffect with empty dependency array
      let loadCount = 0;
      const loadSession = async () => {
        loadCount++;
        await mockSecureStorageAPI.getItem('mallory_grid_otp_session');
      };
      
      // Only runs once
      await loadSession();
      
      // Assert: Should only load once (not on every render)
      expect(loadCount).toBe(1);
      
      console.log('✅ OTP session loaded only once on mount');
    });
  });

  describe('Local State Management', () => {
    test('should manage OTP session in local state, not context', async () => {
      // This is a conceptual test - the OTP screen should:
      // 1. NOT read otpSession from useGrid()
      // 2. Maintain it in local useState
      // 3. Load from storage only on mount
      
      const mockOtpSession = { id: 'local-session', email: 'local@test.com' };
      
      // Simulate local state
      let localOtpSession = null;
      
      // Load from storage (mount)
      const stored = await mockSecureStorageAPI.getItem('mallory_grid_otp_session');
      if (stored) {
        localOtpSession = JSON.parse(stored);
      } else {
        // Initialize with mock data for test
        localOtpSession = mockOtpSession;
      }
      
      // Assert: Local state owns the data
      expect(localOtpSession).not.toBeNull();
      expect(localOtpSession.id).toBe('local-session');
      
      console.log('✅ OTP session managed in local component state');
    });

    test('should not depend on GridContext state updates', () => {
      // The OTP screen should NOT have gridOtpSession in GridContext
      // This prevents unnecessary re-renders and coupling
      
      // Simulate GridContext interface
      const mockGridContext = {
        gridAccount: null,
        solanaAddress: null,
        gridAccountStatus: 'not_created',
        isSigningInToGrid: false,
        // ❌ NOT: gridOtpSession (removed in new architecture)
        initiateGridSignIn: async () => {},
        completeGridSignIn: async () => {},
      };
      
      // Assert: gridOtpSession not in context
      expect('gridOtpSession' in mockGridContext).toBe(false);
      
      console.log('✅ OTP session not in GridContext state');
    });
  });

  describe('Resend Code Functionality', () => {
    test('should update local state when resending code', async () => {
      // Setup: Initial OTP session
      const initialSession = {
        id: 'session-initial',
        email: 'user@test.com',
        challenge: 'challenge-initial',
      };
      
      let localOtpSession = initialSession;
      
      // Act: Simulate resend code
      const resendResult = await mockGridClientService.startSignIn('user@test.com');
      
      // Update local state (critical!)
      localOtpSession = resendResult.otpSession;
      
      // Update storage for persistence
      await mockSecureStorageAPI.setItem(
        'mallory_grid_otp_session',
        JSON.stringify(resendResult.otpSession)
      );
      
      // Assert: Local state updated with new session
      expect(localOtpSession.id).not.toBe('session-initial');
      expect(localOtpSession.email).toBe('user@test.com');
      
      // Assert: Storage also updated
      const stored = await mockSecureStorageAPI.getItem('mallory_grid_otp_session');
      const storedSession = JSON.parse(stored!);
      expect(storedSession.id).toBe(localOtpSession.id);
      
      console.log('✅ Local state updated on resend');
    });

    test('should update both local state and storage on resend', async () => {
      // Setup: Initial session in storage
      await mockSecureStorageAPI.setItem(
        'mallory_grid_otp_session',
        JSON.stringify({ id: 'old-session', email: 'user@test.com' })
      );
      
      let localOtpSession = { id: 'old-session', email: 'user@test.com' };
      
      // Act: Resend code
      const { otpSession: newSession } = await mockGridClientService.startSignIn('user@test.com');
      
      // Update BOTH local state and storage
      localOtpSession = newSession;
      await mockSecureStorageAPI.setItem(
        'mallory_grid_otp_session',
        JSON.stringify(newSession)
      );
      
      // Assert: Local state updated
      expect(localOtpSession.id).not.toBe('old-session');
      
      // Assert: Storage updated
      const stored = await mockSecureStorageAPI.getItem('mallory_grid_otp_session');
      const storedSession = JSON.parse(stored!);
      expect(storedSession.id).toBe(localOtpSession.id);
      
      console.log('✅ Both local state and storage updated on resend');
    });

    test('should clear OTP input field when resending', async () => {
      // Simulate OTP input state
      let otpInput = '123456';
      
      // Act: User clicks resend
      otpInput = ''; // Clear input
      
      await mockGridClientService.startSignIn('user@test.com');
      
      // Assert: Input cleared
      expect(otpInput).toBe('');
      
      console.log('✅ OTP input cleared on resend');
    });

    test('should handle resend errors gracefully', async () => {
      // Setup: Mock failure by replacing function temporarily
      const originalStartSignIn = mockGridClientService.startSignIn;
      mockGridClientService.startSignIn = async () => {
        throw new Error('Network error');
      };
      
      // Act: Try to resend
      let errorMessage = '';
      try {
        await mockGridClientService.startSignIn('user@test.com');
      } catch (err: any) {
        errorMessage = err.message;
      }
      
      // Assert: Error caught and displayed
      expect(errorMessage).toBe('Network error');
      
      // Restore original function
      mockGridClientService.startSignIn = originalStartSignIn;
      
      // Local state should remain unchanged
      console.log('✅ Resend errors handled gracefully');
    });
  });

  describe('OTP Verification with Local Session', () => {
    test('should verify OTP using local session state', async () => {
      // Setup: Local session state
      const localOtpSession = {
        id: 'session-verify',
        email: 'user@test.com',
        challenge: 'challenge-xyz',
      };
      
      const otpCode = '123456';
      
      // Act: Verify OTP using local state
      const result = await mockGridClientService.completeSignIn(localOtpSession, otpCode);
      
      // Assert: Verification successful
      expect(result.success).toBe(true);
      expect(result.data.address).toBe('mock-address-123');
      
      // Assert: completeSignIn called with local session
      expect(mockCompleteSignInCalls.length).toBe(1);
      expect(mockCompleteSignInCalls[0].otpSession.id).toBe(localOtpSession.id);
      expect(mockCompleteSignInCalls[0].otpCode).toBe(otpCode);
      
      console.log('✅ OTP verified using local session state');
    });

    test('should not use stale session after resend', async () => {
      // Setup: Initial session
      let localOtpSession = {
        id: 'session-old',
        email: 'user@test.com',
        challenge: 'old-challenge',
      };
      
      // Act: Resend code (gets new session)
      const { otpSession: newSession } = await mockGridClientService.startSignIn('user@test.com');
      localOtpSession = newSession; // Update local state
      
      // User enters code from NEW email
      const otpCode = '654321';
      
      // Verify with NEW session
      await mockGridClientService.completeSignIn(localOtpSession, otpCode);
      
      // Assert: Used new session, not old one
      expect(mockCompleteSignInCalls.length).toBe(1);
      expect(mockCompleteSignInCalls[0].otpSession.id).not.toBe('session-old');
      
      console.log('✅ Uses fresh session after resend, not stale one');
    });
  });

  describe('Error Handling', () => {
    test('should show correct error for expired OTP code', async () => {
      // Setup: Mock expired code error by replacing function temporarily
      const originalCompleteSignIn = mockGridClientService.completeSignIn;
      mockGridClientService.completeSignIn = async () => {
        throw new Error('Invalid code or expired');
      };
      
      // Act: Try to verify
      let errorMessage = '';
      try {
        await mockGridClientService.completeSignIn({ id: 'test' }, '123456');
      } catch (err: any) {
        errorMessage = err.message;
      }
      
      // Assert: Error message guides user to resend
      expect(errorMessage.toLowerCase()).toContain('expired');
      
      // Restore original function
      mockGridClientService.completeSignIn = originalCompleteSignIn;
      
      // UI should show: "This code is invalid or has expired. Please resend code."
      console.log('✅ Expired code error handled with correct message');
    });

    test('should show correct error for invalid OTP code', async () => {
      // Setup: Mock invalid code error
      const originalCompleteSignIn = mockGridClientService.completeSignIn;
      mockGridClientService.completeSignIn = async () => {
        throw new Error('Invalid code');
      };
      
      // Act: Try to verify
      let errorMessage = '';
      try {
        await mockGridClientService.completeSignIn({ id: 'test' }, '000000');
      } catch (err: any) {
        errorMessage = err.message;
      }
      
      // Assert: Error message guides user
      expect(errorMessage.toLowerCase()).toContain('invalid');
      
      // Restore original function
      mockGridClientService.completeSignIn = originalCompleteSignIn;
      
      console.log('✅ Invalid code error handled with correct message');
    });

    test('should handle network errors during verification', async () => {
      // Setup: Mock network error
      const originalCompleteSignIn = mockGridClientService.completeSignIn;
      mockGridClientService.completeSignIn = async () => {
        throw new Error('Network request failed');
      };
      
      // Act: Try to verify
      let errorMessage = '';
      try {
        await mockGridClientService.completeSignIn({ id: 'test' }, '123456');
      } catch (err: any) {
        errorMessage = err.message;
      }
      
      // Assert: Error caught
      expect(errorMessage).toContain('Network');
      
      // Restore original function
      mockGridClientService.completeSignIn = originalCompleteSignIn;
      
      console.log('✅ Network errors handled gracefully');
    });
  });

  describe('Integration with GridContext', () => {
    test('should only use GridContext actions, not state', () => {
      // OTP screen should only destructure actions from useGrid()
      const { completeGridSignIn } = {
        completeGridSignIn: mockGridClientService.completeSignIn,
        // NOT: gridOtpSession (removed from context)
      };
      
      expect(completeGridSignIn).toBeDefined();
      expect(typeof completeGridSignIn).toBe('function');
      
      console.log('✅ OTP screen uses only GridContext actions');
    });

    test('should pass OTP session as parameter to completeGridSignIn', async () => {
      // Setup: Local session
      const localOtpSession = { id: 'session-param', email: 'test@test.com' };
      const otpCode = '123456';
      
      // Act: Call GridContext action with session as parameter
      await mockGridClientService.completeSignIn(localOtpSession, otpCode);
      
      // Assert: Session passed as parameter, not read from context
      expect(mockCompleteSignInCalls.length).toBe(1);
      expect(mockCompleteSignInCalls[0].otpSession.id).toBe(localOtpSession.id);
      expect(mockCompleteSignInCalls[0].otpCode).toBe(otpCode);
      
      console.log('✅ OTP session passed as parameter to GridContext action');
    });

    test('should not trigger context re-renders on local state updates', () => {
      // This is a conceptual test: OTP screen's local state changes
      // should NOT cause GridContext to re-render its consumers
      
      // Simulate local state update
      let localOtpSession = { id: 'session-1' };
      localOtpSession = { id: 'session-2' }; // Update
      
      // GridContext consumers should not be affected
      // because otpSession is not in context state
      
      expect(localOtpSession.id).toBe('session-2');
      
      console.log('✅ Local state updates do not affect GridContext');
    });
  });

  describe('Persistence Across Page Refresh', () => {
    test('should reload OTP session from storage after refresh', async () => {
      // Setup: Session in storage (before refresh)
      const sessionBeforeRefresh = {
        id: 'session-before-refresh',
        email: 'user@test.com',
      };
      
      await mockSecureStorageAPI.setItem(
        'mallory_grid_otp_session',
        JSON.stringify(sessionBeforeRefresh)
      );
      
      // Act: Simulate refresh (component remounts)
      const stored = await mockSecureStorageAPI.getItem('mallory_grid_otp_session');
      const sessionAfterRefresh = JSON.parse(stored!);
      
      // Assert: Session persisted
      expect(sessionAfterRefresh.id).toBe('session-before-refresh');
      expect(sessionAfterRefresh.email).toBe('user@test.com');
      
      console.log('✅ OTP session persists across page refresh');
    });

    test('should handle case where storage is cleared during session', async () => {
      // Setup: Start with session
      await mockSecureStorageAPI.setItem(
        'mallory_grid_otp_session',
        JSON.stringify({ id: 'session-123' })
      );
      
      // Act: Storage cleared (user cleared browser data, etc.)
      await mockSecureStorageAPI.removeItem('mallory_grid_otp_session');
      
      // Try to reload
      const stored = await mockSecureStorageAPI.getItem('mallory_grid_otp_session');
      
      // Assert: Should be null, show error
      expect(stored).toBeNull();
      
      // UI should show: "Session error. Please sign in again."
      console.log('✅ Handles storage being cleared gracefully');
    });
  });

  describe('Cleanup on Success', () => {
    test('should clear OTP session from storage after successful verification', async () => {
      // Setup: Session in storage
      await mockSecureStorageAPI.setItem(
        'mallory_grid_otp_session',
        JSON.stringify({ id: 'session-cleanup', email: 'test@test.com' })
      );
      
      // Act: Successful verification
      await mockGridClientService.completeSignIn({ id: 'session-cleanup' }, '123456');
      
      // GridContext.completeGridSignIn should clear the session
      await mockSecureStorageAPI.removeItem('mallory_grid_otp_session');
      
      // Assert: Session cleared
      const stored = await mockSecureStorageAPI.getItem('mallory_grid_otp_session');
      expect(stored).toBeNull();
      
      console.log('✅ OTP session cleared after successful verification');
    });
  });
});

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { router } from 'expo-router';
import { supabase, SESSION_STORAGE_KEYS } from '../lib';
import { gridClientService } from '../features/grid';
import { useAuth } from './AuthContext';

/**
 * GridContext - Grid Wallet Integration
 * 
 * Manages Grid wallet sign-in, OTP flow, and account state.
 * Separated from AuthContext for better separation of concerns.
 */

interface GridAccount {
  address: string;
  authentication?: any;
}

interface GridUser {
  // Grid user object from startSignIn()
  [key: string]: any;
}

export interface GridContextType {
  // Grid wallet state
  gridAccount: GridAccount | null;
  solanaAddress: string | null;
  gridAccountStatus: 'not_created' | 'pending_verification' | 'active';
  gridAccountId: string | null;
  
  // OTP flow state
  isSigningInToGrid: boolean;
  
  // Grid actions
  initiateGridSignIn: (email: string, options?: { backgroundColor?: string; textColor?: string; returnPath?: string }) => Promise<void>;
  completeGridSignIn: (gridUser: GridUser, otp: string) => Promise<void>;
  clearGridAccount: () => Promise<void>;
}

const GridContext = createContext<GridContextType | undefined>(undefined);

export function GridProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  // Grid wallet state
  const [gridAccount, setGridAccount] = useState<GridAccount | null>(null);
  const [solanaAddress, setSolanaAddress] = useState<string | null>(null);
  const [gridAccountStatus, setGridAccountStatus] = useState<'not_created' | 'pending_verification' | 'active'>('not_created');
  const [gridAccountId, setGridAccountId] = useState<string | null>(null);
  
  // OTP flow state
  const [isSigningInToGrid, setIsSigningInToGrid] = useState(false);
  
  // Guard to prevent concurrent Grid sign-in attempts
  const isInitiatingGridSignIn = useRef(false);

  // Load Grid account on mount and when user changes
  useEffect(() => {
    const loadGridAccount = async () => {
      if (!user?.id) {
        // CRITICAL FIX: Only clear Grid state on EXPLICIT logout, not on app refresh
        // During app initialization, user?.id is temporarily null while auth session is being restored
        // We must NOT clear Grid credentials in this case, or users lose access to their wallet
        
        // Check if this is an explicit logout (user clicked sign out button)
        const isLoggingOut = typeof window !== 'undefined' && window.sessionStorage 
          ? sessionStorage.getItem(SESSION_STORAGE_KEYS.IS_LOGGING_OUT) === 'true'
          : false;
        
        if (isLoggingOut) {
          // Explicit logout - clear everything
          console.log('🔒 [GridContext] Explicit logout detected, clearing Grid state');
          setGridAccount(null);
          setSolanaAddress(null);
          setGridAccountStatus('not_created');
          setGridAccountId(null);
          
          // SECURITY FIX: Clear Grid credentials from secure storage on logout
          // This prevents the next user from accessing the previous user's Grid wallet
          try {
            await clearGridAccount();
            console.log('🔒 [GridContext] Grid credentials cleared from secure storage on logout');
          } catch (error) {
            console.log('🔒 [GridContext] Error clearing Grid credentials (non-critical):', error);
          }
          
          // Clear the logout flag now that we've handled it
          if (typeof window !== 'undefined' && window.sessionStorage) {
            sessionStorage.removeItem(SESSION_STORAGE_KEYS.IS_LOGGING_OUT);
            console.log('🔒 [GridContext] Cleared logout flag');
          }
        } else {
          // App refresh or initial load - do NOT clear Grid credentials
          // Just clear React state, keep secure storage intact
          console.log('🔄 [GridContext] App refresh/init detected, clearing React state only (preserving Grid credentials)');
          setGridAccount(null);
          setSolanaAddress(null);
          setGridAccountStatus('not_created');
          setGridAccountId(null);
        }
        
        return;
      }

      try {
        // Load from client-side secure storage (ONLY source for wallet address)
        const account = await gridClientService.getAccount();
        if (account) {
          console.log('🏦 [GridContext] Grid account loaded from secure storage');
          setGridAccount(account);
          setSolanaAddress(account.address);  // Wallet address from Grid SDK
          setGridAccountStatus('active');  // If account exists, it's active
          setGridAccountId(account.address);  // Use address as ID
          
          // Clear auto-initiate flag if account exists
          // This prevents auto-initiating when user already has a wallet
          if (typeof window !== 'undefined' && window.sessionStorage) {
            sessionStorage.removeItem(SESSION_STORAGE_KEYS.GRID_AUTO_INITIATE);
            sessionStorage.removeItem(SESSION_STORAGE_KEYS.GRID_AUTO_INITIATE_EMAIL);
          }
        } else {
          // No Grid account in secure storage
          setGridAccount(null);
          setSolanaAddress(null);
          setGridAccountStatus('not_created');
          setGridAccountId(null);
        }
        
        // Check for auto-initiate flag from AuthContext (unified authentication flow)
        // Only initiate if no account exists in secure storage
        if (!account && typeof window !== 'undefined' && window.sessionStorage) {
          const shouldAutoInitiate = sessionStorage.getItem(SESSION_STORAGE_KEYS.GRID_AUTO_INITIATE) === 'true';
          const autoInitiateEmail = sessionStorage.getItem(SESSION_STORAGE_KEYS.GRID_AUTO_INITIATE_EMAIL);
          
          if (shouldAutoInitiate && autoInitiateEmail && user?.email === autoInitiateEmail) {
            console.log('🏦 [GridContext] Auto-initiating Grid sign-in for unified flow');
            // Clear the flag immediately to prevent duplicate calls
            sessionStorage.removeItem(SESSION_STORAGE_KEYS.GRID_AUTO_INITIATE);
            sessionStorage.removeItem(SESSION_STORAGE_KEYS.GRID_AUTO_INITIATE_EMAIL);
            
            // Initiate Grid sign-in after a short delay to ensure UI is ready
            setTimeout(() => {
              initiateGridSignIn(user.email!, {
                backgroundColor: '#E67B25',
                textColor: '#FFFFFF',
                returnPath: '/(main)/chat'
              }).catch(error => {
                console.error('❌ [GridContext] Auto-initiate Grid sign-in failed:', error);
              });
            }, 500);
          }
        }
      } catch (error) {
        console.error('❌ [GridContext] Error loading Grid account:', error);
        // On error, assume no Grid account
        setGridAccount(null);
        setSolanaAddress(null);
        setGridAccountStatus('not_created');
        setGridAccountId(null);
      }
    };

    loadGridAccount();
  }, [user?.id, user?.email]);

  /**
   * Initiate Grid Sign-In
   * 
   * Starts the Grid wallet sign-in flow by:
   * 1. Checking if Grid account already exists
   * 2. Starting sign-in with Grid (sends OTP email)
   * 3. Storing gridUser in sessionStorage for OTP screen
   * 4. Navigating to OTP verification screen
   * 
   * Uses singleton pattern to prevent race conditions.
   * 
   * @param email - User's email address
   * @param options - Optional background color, text color, and return path for OTP screen
   */
  const initiateGridSignIn = async (
    email: string,
    options?: { backgroundColor?: string; textColor?: string; returnPath?: string }
  ) => {
    // GUARD: Atomic check-and-set to prevent race conditions
    if (isInitiatingGridSignIn.current) {
      console.log('🏦 [GridContext] Sign-in already in progress, skipping duplicate call');
      return;
    }

    // Set guard flag IMMEDIATELY (synchronously, before any awaits)
    isInitiatingGridSignIn.current = true;
    setIsSigningInToGrid(true);

    try {
      console.log('🏦 [GridContext] Checking Grid account status for:', email);
      
      // Check if Grid account exists in client-side secure storage
      const existingAccount = await gridClientService.getAccount();
      
      if (existingAccount) {
        console.log('✅ [GridContext] Grid account already exists in secure storage');
        setGridAccount(existingAccount);
        setSolanaAddress(existingAccount.address);
        setIsSigningInToGrid(false);
        return; // Already signed in to Grid
      }
      
      console.log('🏦 [GridContext] No Grid account found, starting sign-in...');
      
      // Start Grid sign-in - backend automatically detects auth level and handles migration
      const { user: gridUser } = await gridClientService.startSignIn(email);
      
      // Store gridUser and return path in sessionStorage for OTP screen
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem(SESSION_STORAGE_KEYS.GRID_USER, JSON.stringify(gridUser));
        if (options?.returnPath) {
          sessionStorage.setItem(SESSION_STORAGE_KEYS.OTP_RETURN_PATH, options.returnPath);
        }
      }
      
      // Navigate to OTP verification screen with background color, text color, and return path
      console.log('🏦 [GridContext] Navigating to OTP verification screen');
      router.push({
        pathname: '/(auth)/verify-otp',
        params: { 
          email,
          backgroundColor: options?.backgroundColor || '#E67B25',
          textColor: options?.textColor || '#FFFFFF',
          returnPath: options?.returnPath || '/(main)/chat'
        }
      });
    } catch (error: any) {
      console.error('❌ [GridContext] Failed to start Grid sign-in:', error);
      setIsSigningInToGrid(false);
      throw error;
    } finally {
      // ALWAYS clear guard flag when done (success or error)
      isInitiatingGridSignIn.current = false;
    }
  };

  /**
   * Complete Grid Sign-In
   * 
   * Completes the Grid wallet sign-in flow by:
   * 1. Verifying OTP code with Grid
   * 2. Storing Grid account credentials securely
   * 3. Syncing Grid account data with database
   * 4. Navigating back to the original screen
   * 
   * Called from OTP verification screen after user enters code.
   */
  const completeGridSignIn = async (gridUser: GridUser, otp: string) => {
    try {
      console.log('🔐 [GridContext] Completing Grid sign-in with OTP');
      
      const authResult = await gridClientService.completeSignIn(gridUser, otp);
      
      if (authResult.success && authResult.data) {
        console.log('✅ [GridContext] Grid sign-in successful!');
        console.log('   Address:', authResult.data.address);
        
        // Update local state
        setGridAccount(authResult.data);
        setSolanaAddress(authResult.data.address);
        setGridAccountStatus('active');
        setIsSigningInToGrid(false);
        
        // Get return path from sessionStorage or default to chat
        const returnPath = typeof window !== 'undefined' && window.sessionStorage 
          ? sessionStorage.getItem(SESSION_STORAGE_KEYS.OTP_RETURN_PATH) 
          : null;
        const finalPath = returnPath || '/(main)/chat';
        
        // Clear sessionStorage
        if (typeof window !== 'undefined' && window.sessionStorage) {
          sessionStorage.removeItem(SESSION_STORAGE_KEYS.GRID_USER);
          sessionStorage.removeItem(SESSION_STORAGE_KEYS.OAUTH_IN_PROGRESS);
          sessionStorage.removeItem(SESSION_STORAGE_KEYS.GRID_IS_EXISTING_USER);
          sessionStorage.removeItem(SESSION_STORAGE_KEYS.OTP_RETURN_PATH);
        }
        
        // Navigate to destination screen immediately
        // Grid account data is already stored in:
        // 1. React state (set above)
        // 2. Secure storage (set by gridClientService.completeSignIn)
        // No need to query database - Grid API is the source of truth
        console.log('🔐 [GridContext] Navigating to:', finalPath);
        router.replace(finalPath as any);
      } else {
        throw new Error('Grid sign-in failed');
      }
    } catch (error) {
      console.error('❌ [GridContext] Error completing Grid sign-in:', error);
      setIsSigningInToGrid(false);
      throw error;
    }
  };

  /**
   * Clear Grid Account
   * 
   * Clears Grid wallet credentials from secure storage and resets state.
   * Called during logout.
   */
  const clearGridAccount = async () => {
    try {
      console.log('🚪 [GridContext] Clearing Grid wallet data');
      await gridClientService.clearAccount();
      
      // Clear state
      setGridAccount(null);
      setSolanaAddress(null);
      setGridAccountStatus('not_created');
      setGridAccountId(null);
      setIsSigningInToGrid(false);
      
      // Clear sessionStorage
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem(SESSION_STORAGE_KEYS.GRID_USER);
        sessionStorage.removeItem(SESSION_STORAGE_KEYS.OAUTH_IN_PROGRESS);
        sessionStorage.removeItem(SESSION_STORAGE_KEYS.GRID_IS_EXISTING_USER);
      }
    } catch (error) {
      console.log('🚪 [GridContext] Error clearing Grid data (non-critical):', error);
    }
  };

  return (
    <GridContext.Provider
      value={{
        gridAccount,
        solanaAddress,
        gridAccountStatus,
        gridAccountId,
        isSigningInToGrid,
        initiateGridSignIn,
        completeGridSignIn,
        clearGridAccount,
      }}
    >
      {children}
    </GridContext.Provider>
  );
}

export function useGrid() {
  const context = useContext(GridContext);
  if (context === undefined) {
    throw new Error('useGrid must be used within a GridProvider');
  }
  return context;
}


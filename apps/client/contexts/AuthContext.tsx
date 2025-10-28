import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { supabase, secureStorage, config } from '../lib';
import { configureGoogleSignIn, signInWithGoogle, signOutFromGoogle } from '../features/auth';
import { gridClientService } from '../features/grid';
import OtpVerificationModal from '../components/grid/OtpVerificationModal';
import { getDeviceInfo, isMobileDevice } from '../lib/device/detection';

interface User {
  id: string;
  email?: string;
  displayName?: string;
  profilePicture?: string;
  // From users table
  instantBuyAmount?: number;
  instayieldEnabled?: boolean;
  hasCompletedOnboarding?: boolean;
  // Grid wallet info
  solanaAddress?: string;
  gridAccountStatus?: 'not_created' | 'pending_verification' | 'active';
  gridAccountId?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsReauth: boolean;
  isCheckingReauth: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshGridAccount: () => Promise<void>;
  completeReauth: () => Promise<void>;
  triggerReauth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = 'mallory_auth_token';
const REFRESH_TOKEN_KEY = 'mallory_refresh_token';

// No additional configuration needed - Supabase handles OAuth natively

export function AuthProvider({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const deviceInfo = getDeviceInfo(width);
  const isMobile = isMobileDevice(deviceInfo);
  
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [isCheckingReauth, setIsCheckingReauth] = useState(false);
  const hasCheckedReauth = useRef(false);
  
  // Grid OTP modal state
  const [showGridOtpModal, setShowGridOtpModal] = useState(false);
  const [gridUserForOtp, setGridUserForOtp] = useState<any>(null);
  
  // SIGN-IN STATE: Tracks when user is actively signing in
  // Set when user clicks "Continue with Google", cleared when sign-in completes or fails
  // Prevents premature logout during the sign-in flow
  const [isSigningIn, setIsSigningIn] = useState(false);
  
  // RACE CONDITION GUARD: Prevent concurrent Grid sign-in attempts
  // This singleton flag ensures only ONE Grid sign-in flow runs at a time
  const isInitiatingGridSignIn = useRef(false);
  
  // LOGOUT GUARD: Prevent recursive logout calls
  // Supabase's signOut() triggers SIGNED_OUT event which can call logout() again
  const isLoggingOut = useRef(false);

  console.log('AuthProvider rendering, user:', user?.email || 'none', 'isLoading:', isLoading);

  useEffect(() => {
    // Configure Google Sign-In for mobile
    if (Platform.OS !== 'web') {
      configureGoogleSignIn();
    }
    
    // Check for existing session
    // SKIP if we're returning from OAuth - let onAuthStateChange handle it instead
    // We use sessionStorage to persist this flag across React StrictMode double-renders
    // (in dev mode, React mounts components twice, and Supabase consumes the hash on first mount)
    const isOAuthCallback = typeof window !== 'undefined' && (
      window.location.hash.includes('access_token=') ||
      window.sessionStorage.getItem('mallory_oauth_in_progress') === 'true'
    );
    
    if (isOAuthCallback) {
      console.log('🔍 [Init] Skipping initial auth check (OAuth callback detected)');
      // Set flag in sessionStorage so it persists across StrictMode double-renders
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('mallory_oauth_in_progress', 'true');
      }
    } else {
      console.log('🔍 [Init] Running initial auth check (not an OAuth callback)');
      checkAuthSession();
    }

    // Listen for auth state changes - simplified
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, 'Session:', !!session);
        
        if (session && event === 'SIGNED_IN') {
          // When Supabase auth succeeds, also initiate Grid sign-in
          // This pairs Supabase + Grid as one unified sign-in experience
          await handleSignIn(session);
        } else if (event === 'TOKEN_REFRESHED' && session) {
          // COUPLED SESSION VALIDATION: Check both Supabase AND Grid sessions
          // Supabase and Grid sessions are treated as "coupled at the hip"
          // If either expires, user must re-authenticate both
          console.log('🔄 [Token Refresh] Supabase token refreshed, validating Grid session...');
          
          // Update Supabase tokens
          await secureStorage.setItem(AUTH_TOKEN_KEY, session.access_token);
          if (session.refresh_token) {
            await secureStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
          }
          
          // Validate Grid session still exists and is valid
          try {
            const gridAccount = await gridClientService.getAccount();
            if (!gridAccount) {
              console.warn('⚠️ [Token Refresh] Grid session missing - triggering re-auth');
              setNeedsReauth(true);
            } else {
              console.log('✅ [Token Refresh] Grid session still valid');
            }
          } catch (error) {
            console.error('❌ [Token Refresh] Error checking Grid session:', error);
            // If we can't verify Grid session, assume it's invalid
            setNeedsReauth(true);
          }
        } else if (event === 'SIGNED_OUT') {
          // Supabase session ended - use unified logout to clear everything
          console.log('🚪 [Auth State] SIGNED_OUT event - triggering logout');
          await logout();
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Helper function to check and initiate Grid sign-in if needed
  // Grid wallet is REQUIRED - users must complete Grid setup to use the app
  // 
  // SINGLETON PATTERN: Uses ref guard to prevent race conditions
  // Multiple calls to this function will be de-duplicated automatically
  const checkAndInitiateGridSignIn = async (userEmail: string) => {
    // GUARD: If Grid sign-in is already in progress, skip this call
    if (isInitiatingGridSignIn.current) {
      console.log('🏦 [Grid] Sign-in already in progress, skipping duplicate call');
      return;
    }
    
    try {
      // Set guard flag FIRST (before any async operations)
      isInitiatingGridSignIn.current = true;
      
      console.log('🏦 [Grid] Checking Grid account status for:', userEmail);
      
      // Check if Grid account exists in client-side secure storage
      const gridAccount = await gridClientService.getAccount();
      
      if (gridAccount) {
        console.log('✅ [Grid] Grid account already exists in secure storage');
        return; // Already signed in to Grid
      }
      
      console.log('🏦 [Grid] No Grid account found, starting sign-in...');
      
      // Start Grid sign-in - backend automatically detects auth level and handles migration
      // If Grid is down or unavailable, this will fail and throw an error
      // The error will propagate up and prevent the user from proceeding
      const { user: gridUser } = await gridClientService.startSignIn(userEmail);
      setGridUserForOtp(gridUser);
      
      // Store gridUser in sessionStorage for screen-based flow
      if (Platform.OS === 'web') {
        sessionStorage.setItem('gridUser', JSON.stringify(gridUser));
      }
      
      // On mobile web, navigate to OTP screen instead of showing modal
      if (isMobile && Platform.OS === 'web') {
        console.log('🏦 [Grid] Mobile web detected - navigating to OTP screen');
        router.push('/(auth)/otp-verification');
      } else {
        console.log('🏦 [Grid] Desktop detected - showing OTP modal');
        setShowGridOtpModal(true);
      }
    } catch (error: any) {
      console.error('❌ [Grid] Failed to start Grid sign-in:', error);
      
      // Grid wallet is REQUIRED - if we can't reach Grid, sign out completely
      // This handles Grid being down, network errors, or any other Grid failures
      console.error('💥 [Grid] Cannot proceed without Grid - signing out');
      await logout();
      throw error;
    } finally {
      // ALWAYS clear guard flag when done (success or error)
      isInitiatingGridSignIn.current = false;
    }
  };

  const checkAuthSession = async () => {
    console.log('🔍 [Auth Check] Starting comprehensive auth validation...');
    try {
      // STEP 1: Check Supabase session
      console.log('🔍 [Auth Check] Checking Supabase session...');
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('🔍 [Auth Check] Supabase session:', !!session, 'Error:', error);
      
      if (!session) {
        console.log('✅ [Auth Check] No session - user is logged out (expected)');
        setIsLoading(false);
        return;
      }
      
      console.log('🔍 [Auth Check] Supabase session found:', {
        user_id: session.user?.id,
        email: session.user?.email,
        expires_at: session.expires_at
      });
      
      // STEP 2: Check Grid session (REQUIRED for full authentication)
      // ALL-OR-NOTHING RULE: User must have BOTH Supabase AND Grid sessions
      // EXCEPTION: If Grid sign-in is currently in progress, skip this check
      console.log('🔍 [Auth Check] Validating Grid session...');
      const gridAccount = await gridClientService.getAccount();
      
      if (!gridAccount) {
        // Check if we're in the middle of OAuth flow (just returned from Google)
        // When Supabase OAuth completes, it adds #access_token= to the URL
        const isReturningFromOAuth = typeof window !== 'undefined' && 
                                     window.location.hash.includes('access_token=');
        
        // Check if user is currently signing in (in-memory state)
        if (isSigningIn || isReturningFromOAuth) {
          console.log('🔄 [Auth Check] User is signing in - skipping logout check');
          if (isReturningFromOAuth) {
            console.log('🔄 [Auth Check] Detected OAuth redirect in URL');
          }
          console.log('🔄 [Auth Check] Allowing sign-in flow to complete...');
          // Proceed with handleSignIn which will initiate/continue Grid sign-in
          await handleSignIn(session);
          return;
        }
        
        // INCOMPLETE AUTH STATE: User has Supabase session but NO Grid session
        // This means they started login but never completed Grid OTP verification
        // OR they're returning after closing the app mid-flow
        console.warn('⚠️ [Auth Check] INCOMPLETE AUTH STATE DETECTED');
        console.warn('⚠️ [Auth Check] User has Supabase session but NO Grid session');
        console.warn('⚠️ [Auth Check] Signing out and restarting auth flow...');
        
        // Sign out completely and restart the flow
        await logout();
        return;
      }
      
      console.log('✅ [Auth Check] Grid session validated:', {
        address: gridAccount.address,
        hasAuthentication: !!gridAccount.authentication
      });
      
      // STEP 3: Both sessions exist - proceed with full sign-in
      console.log('✅ [Auth Check] Full auth state validated - proceeding with sign-in');
      await handleSignIn(session);
      
    } catch (error) {
      console.error('❌ [Auth Check] Error during auth validation:', error);
      
      // On any error during validation, sign out to ensure clean state
      console.log('🚪 [Auth Check] Error detected - signing out for safety');
      await logout();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (session: any) => {
    console.log('🔐 handleSignIn called');
    console.log('Session exists:', !!session);
    console.log('Session data:', {
      user_id: session?.user?.id,
      email: session?.user?.email,
      access_token: session?.access_token ? 'exists' : 'missing',
      refresh_token: session?.refresh_token ? 'exists' : 'missing',
      expires_at: session?.expires_at
    });
    console.log('User metadata:', session?.user?.user_metadata);
    
    // Clear OAuth-in-progress flag now that we're handling the sign-in
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('mallory_oauth_in_progress');
      console.log('🔐 Cleared OAuth-in-progress flag');
    }
    
    try {
      // Store tokens securely
      await secureStorage.setItem(AUTH_TOKEN_KEY, session.access_token);
      if (session.refresh_token) {
        await secureStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
      }
      console.log('✅ Tokens stored securely');

      // Get user data from database
      console.log('📊 Fetching user data from database for ID:', session.user.id);
      const { data: userData, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      console.log('Database query result:', { userData, dbError });

      // Get Grid account data
      console.log('🏦 Fetching Grid account data');
      const { data: gridData, error: gridError } = await supabase
        .from('users_grid')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      // It's OK if no Grid data exists yet - it will be created async
      if (gridError && gridError.code !== 'PGRST116') {
        console.log('Grid data fetch error:', gridError);
      }

      const user: User = {
        id: session.user.id,
        email: userData?.email || session.user.email,
        // From Google OAuth metadata
        displayName: session.user.user_metadata?.name || session.user.user_metadata?.full_name,
        profilePicture: session.user.user_metadata?.avatar_url,
        // From users table
        instantBuyAmount: userData?.instant_buy_amount,
        instayieldEnabled: userData?.instayield_enabled,
        hasCompletedOnboarding: userData?.has_completed_onboarding || false,
        // Grid wallet info
        solanaAddress: gridData?.solana_wallet_address,
        gridAccountStatus: gridData?.grid_account_status || 'not_created',
        gridAccountId: gridData?.grid_account_id,
      };

      console.log('👤 Setting user:', user);
      setUser(user);
      console.log('✅ User set successfully');

      // UNIFIED SIGN-IN: Pair Grid authentication with Supabase authentication
      // After successful Supabase login, automatically initiate Grid sign-in
      // This creates a seamless single sign-in experience for users
      if (user.email) {
        await checkAndInitiateGridSignIn(user.email);
      }
      
      // Sign-in completed successfully, clear the signing-in state
      setIsSigningIn(false);
    } catch (error) {
      console.error('❌ Error handling sign in:', error);
      // Clear signing-in state on error
      setIsSigningIn(false);
    }
  };

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * UNIFIED LOGOUT - Single Source of Truth for All Sign-Out Operations
   * ═══════════════════════════════════════════════════════════════════════════════
   * 
   * This is the ONLY logout function that should be used across the entire codebase.
   * It performs a complete, comprehensive sign-out from all services:
   * 
   * WHAT IT CLEARS:
   * ───────────────
   * 1. Native Google Sign-In (mobile only)
   * 2. Supabase authentication session
   * 3. Grid wallet credentials (session secrets + account data)
   * 4. Auth tokens (access + refresh)
   * 5. Supabase persisted session in AsyncStorage
   * 6. Wallet data cache
   * 7. React state (user, modals, flags)
   * 8. Navigation stack
   * 
   * USAGE:
   * ─────
   * - Manual sign-out button → logout()
   * - Grid setup cancellation → logout()
   * - Session expired → logout()
   * - Any place that needs to sign user out → logout()
   * 
   * GUARANTEES:
   * ──────────
   * - User is completely signed out from all services
   * - No credentials or sessions remain in storage
   * - User is redirected to login screen
   * - Even if errors occur, user ends up at login screen
   * 
   * ═══════════════════════════════════════════════════════════════════════════════
   */
  const logout = async () => {
    // GUARD: Prevent recursive logout calls
    // When we call supabase.auth.signOut(), it triggers SIGNED_OUT event
    // which would call logout() again, causing infinite loop
    if (isLoggingOut.current) {
      console.log('🚪 [LOGOUT] Already logging out - skipping recursive call');
      return;
    }
    
    isLoggingOut.current = true;
    
    try {
      console.log('🚪 [LOGOUT] Starting comprehensive logout');
      setIsLoading(true);
      
      // STEP 1: Close all modals and clear signing-in state immediately (prevents UI blocking)
      setShowGridOtpModal(false);
      setGridUserForOtp(null);
      setIsSigningIn(false);
      console.log('🚪 [LOGOUT] Modals closed and signing-in state cleared');
      
      // STEP 2: Sign out from native Google Sign-In (mobile only)
      if (Platform.OS !== 'web') {
        try {
          console.log('🚪 [LOGOUT] Signing out from Google (native)');
          await signOutFromGoogle();
        } catch (error) {
          console.log('🚪 [LOGOUT] Google sign-out error (non-critical):', error);
        }
      }
      
      // STEP 3: Clear Grid wallet credentials (CRITICAL - prevents wallet access leakage)
      try {
        console.log('🚪 [LOGOUT] Clearing Grid wallet data');
        await gridClientService.clearAccount();
      } catch (error) {
        console.log('🚪 [LOGOUT] Grid clear error (non-critical):', error);
      }
      
      // STEP 4: Clear auth tokens
      await secureStorage.removeItem(AUTH_TOKEN_KEY);
      await secureStorage.removeItem(REFRESH_TOKEN_KEY);
      console.log('🚪 [LOGOUT] Auth tokens cleared');
      
      // STEP 5: Clear Supabase persisted session from AsyncStorage
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const keys = await AsyncStorage.getAllKeys();
        const supabaseKeys = keys.filter(key => 
          key.includes('supabase') || 
          key.includes('sb-') ||
          key.startsWith('@supabase')
        );
        if (supabaseKeys.length > 0) {
          await AsyncStorage.multiRemove(supabaseKeys);
          console.log('🚪 [LOGOUT] Cleared Supabase storage:', supabaseKeys);
        }
      } catch (error) {
        console.log('🚪 [LOGOUT] Could not clear Supabase storage:', error);
      }
      
      // STEP 6: Clear wallet cache
      try {
        const { walletDataService } = await import('../features/wallet');
        walletDataService.clearCache();
        console.log('🚪 [LOGOUT] Wallet cache cleared');
      } catch (error) {
        console.log('🚪 [LOGOUT] Could not clear wallet cache:', error);
      }
      
      // STEP 7: Clear React state
      setUser(null);
      setNeedsReauth(false);
      hasCheckedReauth.current = false;
      console.log('🚪 [LOGOUT] React state cleared');
      
      // STEP 8: Sign out from Supabase (triggers SIGNED_OUT event)
      try {
        console.log('🚪 [LOGOUT] Signing out from Supabase');
        await supabase.auth.signOut();
      } catch (error) {
        console.log('🚪 [LOGOUT] Supabase sign-out error (non-critical):', error);
      }
      
      // STEP 9: Clear navigation stack and redirect to login
      try {
        if (router.canDismiss()) {
          router.dismissAll();
          console.log('🚪 [LOGOUT] Navigation stack dismissed');
        }
      } catch (error) {
        console.log('🚪 [LOGOUT] Could not dismiss navigation stack:', error);
      }
      
      // Final redirect to login
      router.replace('/(auth)/login');
      console.log('🚪 [LOGOUT] Logout completed successfully');
      
    } catch (error) {
      console.error('🚪 [LOGOUT] Unexpected error during logout:', error);
      // Force redirect to login even on error - user MUST end up at login screen
      router.replace('/(auth)/login');
    } finally {
      setIsLoading(false);
      isLoggingOut.current = false; // Reset guard flag
    }
  };

  // Check re-auth status for a specific user (avoids state dependency issues)
  const checkReauthStatusForUser = async (targetUser: User | null) => {
    if (!targetUser || isCheckingReauth) {
      console.log('🔐 Skipping re-auth check:', { hasTargetUser: !!targetUser, isCheckingReauth });
      return;
    }

    console.log('🔐 Starting re-auth check for user:', targetUser.email);
    setIsCheckingReauth(true);
    
    try {
      console.log('🔐 Step 1: Getting auth token...');
      const token = await secureStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        throw new Error('No auth token available');
      }
      console.log('🔐 Step 1: Auth token retrieved');

      console.log('🔐 Step 2: Making API call to wallet status...');
      const baseApiUrl = config.backendApiUrl || 'http://localhost:3001';
      const apiUrl = `${baseApiUrl}/api/wallet/status`;
      console.log('🔐 Step 2: Calling URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('🔐 Step 3: API response received:', { 
        status: response.status, 
        ok: response.ok 
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      console.log('🔐 Step 4: Parsing JSON response...');
      const status = await response.json();
      console.log('🔐 Step 4: Fresh wallet status received:', {
        walletExists: status.wallet?.exists,
        walletStatus: status.wallet?.status,
        readyForTransactions: status.wallet?.ready_for_transactions,
        message: status.message
      });
      
      // User needs verification if:
      // 1. No wallet exists (first-time setup)
      // 2. Wallet exists but not ready for transactions (initial OTP or re-auth)
      const needsVerification = !status.wallet.exists || 
                               (status.wallet.exists && !status.wallet.ready_for_transactions);

      console.log('🔐 Step 5: Verification check result:', {
        needsVerification,
        currentNeedsReauth: needsReauth,
        willUpdate: needsReauth !== needsVerification
      });

      // Only update needsReauth if it actually changed to prevent unnecessary re-renders
      if (needsReauth !== needsVerification) {
        console.log('🔐 Step 6: Updating needsReauth to:', needsVerification);
        setNeedsReauth(needsVerification);
      }

      // If verification needed, user will be prompted via Grid OTP modal
      if (needsVerification) {
        console.log('🔐 User needs verification - Grid OTP modal will handle this');
      }

      console.log('🔐 Re-auth check completed successfully');

    } catch (error) {
      console.error('🔐 Error in re-auth check:', error);
      if (needsReauth !== false) {
        setNeedsReauth(false); // Only update if different
      }
    } finally {
      console.log('🔐 Setting isCheckingReauth to false');
      setIsCheckingReauth(false);
    }
  };

  // Check if user needs wallet verification (covers both first-time and re-auth)
  const checkReauthStatus = async () => {
    await checkReauthStatusForUser(user);
  };

  // Complete re-authentication process
  const completeReauth = async () => {
    console.log('🔐 Re-authentication completed, refreshing auth state...');
    setNeedsReauth(false);
    setIsCheckingReauth(false);
    
    // Reset the check flag to allow future re-auth checks
    hasCheckedReauth.current = false;
    
    // Clear wallet cache to force fresh data fetch
    try {
      const { walletDataService } = await import('../features/wallet');
      walletDataService.clearCache();
      console.log('🔐 Wallet cache cleared successfully');
    } catch (error) {
      console.log('🔐 Note: Could not clear wallet cache:', error);
      // Not critical - continue anyway
    }
    
    console.log('🔐 Re-authentication complete - wallet access restored!');
  };

  // Trigger re-authentication manually (for testing key rotation)
  const triggerReauth = async () => {
    if (!user || needsReauth || isCheckingReauth) return;
    
    console.log('🔐 Manual re-auth trigger requested');
    await checkReauthStatus();
  };

  const login = async () => {
    try {
      setIsLoading(true);
      // Set signing-in state when user explicitly starts the login process
      setIsSigningIn(true);
      
      if (Platform.OS === 'web') {
        // Use Supabase OAuth for web
        const redirectUrl = config.webOAuthRedirectUrl || 'http://localhost:8081';
        console.log('🔐 Auth Redirect URL:', redirectUrl);
        console.log('🔐 Full config.webOAuthRedirectUrl:', config.webOAuthRedirectUrl);
        
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
          }
        });
        
        if (error) throw error;
      } else {
        // Use native Google Sign-In for mobile
        const { idToken, user } = await signInWithGoogle();
        
        // Sign in to Supabase with the Google ID token
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
          // No nonce parameter - let Supabase handle it automatically
        });
        
        console.log('Native sign-in response:', { data, error });
        
        if (error) throw error;
      }

    } catch (error: any) {
      console.error('Login error:', error);
      // Clear signing-in state on error
      setIsSigningIn(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Refresh Grid account data from database
   * 
   * This function refetches Grid wallet info (address, status) from the database
   * and updates the local user state. It's called after Grid sign-in completes
   * to sync the newly created wallet address into the UI.
   * 
   * PARAMETERS:
   * @param userId - Optional user ID to use (defaults to current user)
   * 
   * WHY THIS CAN HANG:
   * ─────────────────
   * 1. User state not yet initialized (user?.id is undefined)
   * 2. Supabase query timeout or network issues
   * 3. Database replication delay (Grid backend just wrote, client reads immediately)
   * 
   * FIXES APPLIED:
   * ─────────────
   * - Accept explicit userId parameter to avoid depending on state
   * - Add timeout to Supabase query (abortSignal)
   * - Return early with helpful logs if user not found
   */
  const refreshGridAccount = async (userId?: string) => {
    console.log('🔄 [refreshGridAccount] Starting...');
    
    // Use provided userId or fall back to current user
    const targetUserId = userId || user?.id;
    
    if (!targetUserId) {
      console.log('🔄 [refreshGridAccount] No user ID provided or available, skipping');
      return;
    }
    
    try {
      console.log('🔄 [refreshGridAccount] Querying database for user:', targetUserId);
      
      // Add timeout to prevent hanging (5 second max)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const { data: gridData, error: queryError } = await supabase
        .from('users_grid')
        .select('*')
        .eq('id', targetUserId)
        .abortSignal(controller.signal)
        .single();
      
      clearTimeout(timeoutId);

      console.log('🔄 [refreshGridAccount] Query result:', {
        hasData: !!gridData,
        address: gridData?.solana_wallet_address,
        status: gridData?.grid_account_status,
        error: queryError?.message,
      });

      // Update user state only if we have a current user
      if (user) {
        console.log('🔄 [refreshGridAccount] Updating user state...');
        setUser(prev => {
          if (!prev) return null;
          return {
            ...prev,
            solanaAddress: gridData?.solana_wallet_address,
            gridAccountStatus: gridData?.grid_account_status || 'not_created',
            gridAccountId: gridData?.grid_account_id,
          };
        });
        console.log('🔄 [refreshGridAccount] User state updated');
      } else {
        console.log('🔄 [refreshGridAccount] No user in state, skipping state update');
      }
    } catch (error: any) {
      // Check if this is an abort error (timeout)
      if (error.name === 'AbortError') {
        console.error('❌ [refreshGridAccount] Query timed out after 5 seconds');
      } else {
        console.error('❌ [refreshGridAccount] Error:', error);
      }
      // Don't throw - this is a non-critical operation
    }
    
    console.log('🔄 [refreshGridAccount] COMPLETED');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        needsReauth,
        isCheckingReauth,
        login,
        logout,
        refreshGridAccount,
        completeReauth,
        triggerReauth
      }}
    >
      {children}
      
      {/* Grid OTP Verification Modal - Desktop only */}
      {showGridOtpModal && !isMobile && (
        <OtpVerificationModal
          visible={showGridOtpModal}
          onClose={async (success: boolean) => {
            console.log('🔐 [OTP Modal] onClose called with success:', success);
            
            if (!success) {
              // Grid setup is REQUIRED - user must complete it to use the app
              // If user closes modal or cancels, they're signing out
              console.log('❌ [OTP Modal] Grid setup cancelled - signing out');
              return;
            }
            
            console.log('🔐 [OTP Modal] Success! Refreshing Grid account...');
            
            // Success - Grid address already synced by backend
            // Refresh auth context to update user state from database
            try {
              console.log('🔐 [OTP Modal] Starting refreshGridAccount...');
              
              // Pass user.id explicitly to avoid state dependency issues
              await refreshGridAccount(user?.id);
              
              console.log('🔐 [OTP Modal] Grid account refreshed successfully');
            } catch (error) {
              // Log the error but don't prevent modal from closing
              // The Grid account is already created and synced - refresh is just nice-to-have
              console.error('🔐 [OTP Modal] Error refreshing Grid account:', error);
            } finally {
              // Close modal
              setShowGridOtpModal(false);
              setGridUserForOtp(null);
              
              // Grid sign-in complete - clear loading state
              // This allows the user to proceed to the app
              setIsLoading(false);
              console.log('🔐 [OTP Modal] Modal closed, loading complete');
            }
          }}
          userEmail={user?.email || ''}
          gridUser={gridUserForOtp}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
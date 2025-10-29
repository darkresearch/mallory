import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase, secureStorage, config } from '../lib';
import { configureGoogleSignIn, signInWithGoogle, signOutFromGoogle } from '../features/auth';
import { walletDataService } from '../features/wallet';

interface User {
  id: string;
  email?: string;
  displayName?: string;
  profilePicture?: string;
  // From users table
  instantBuyAmount?: number;
  instayieldEnabled?: boolean;
  hasCompletedOnboarding?: boolean;
  // Grid wallet info - now managed by GridContext, but kept here for backward compatibility
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
  isSigningIn: boolean; // Expose to prevent loading screen redirect during sign-in
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>; // Renamed from refreshGridAccount - now just refreshes user data
  completeReauth: () => void;
  triggerReauth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = 'mallory_auth_token';
const REFRESH_TOKEN_KEY = 'mallory_refresh_token';

// No additional configuration needed - Supabase handles OAuth natively

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [isCheckingReauth, setIsCheckingReauth] = useState(false);
  const hasCheckedReauth = useRef(false);
  
  // Grid OTP - now uses screen instead of modal
  // No more modal state needed!
  
  // SIGN-IN STATE: Tracks when user is actively signing in
  // Set when user clicks "Continue with Google", cleared when sign-in completes or fails
  // Prevents premature logout during the sign-in flow
  // Note: Grid OTP flow is now managed by GridContext
  const [isSigningIn, setIsSigningIn] = useState(false);
  
  // LOGOUT GUARD: Prevent recursive logout calls
  // Supabase's signOut() triggers SIGNED_OUT event which can call logout() again
  const isLoggingOut = useRef(false);

  console.log('AuthProvider rendering, user:', user?.email || 'none', 'isLoading:', isLoading);

  // RESTORE isSigningIn from sessionStorage on app init (after OAuth redirect)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const oauthInProgress = sessionStorage.getItem('mallory_oauth_in_progress') === 'true';
      if (oauthInProgress) {
        console.log('🔐 [Init] Restoring isSigningIn=true from sessionStorage');
        setIsSigningIn(true);
      }
    }
  }, []);

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
          // When Supabase auth succeeds, just handle sign-in
          // Grid sign-in is now handled by GridContext
          await handleSignIn(session);
        } else if (event === 'TOKEN_REFRESHED' && session) {
          // COUPLED SESSION VALIDATION: Check both Supabase AND Grid sessions
          // Note: Grid session check is now in GridContext
          console.log('🔄 [Token Refresh] Supabase token refreshed');
          
          // Update Supabase tokens
          await secureStorage.setItem(AUTH_TOKEN_KEY, session.access_token);
          if (session.refresh_token) {
            await secureStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
          }
          console.log('✅ [Token Refresh] Tokens updated');
        } else if (event === 'SIGNED_OUT') {
          // Supabase session ended - just clear state
          console.log('🚪 [Auth State] SIGNED_OUT event - clearing state');

          // Only clear state if we're not already in a logout flow
          if (!isLoggingOut.current) {
            setUser(null);
            setIsLoading(false);
          }
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Auto-redirect based on auth state
  // Only redirects from root or auth screens, preserves user's current page
  useEffect(() => {
    // CRITICAL: Wait for auth state to be resolved before making redirect decisions
    // On page refresh, user is initially null while session is being restored
    if (isLoading) {
      console.log('🔀 [AuthContext] Still loading auth state, waiting...');
      return;
    }
    
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
    
    if (!user) {
      // Not authenticated - redirect to login only if not already on auth screen
      if (!currentPath.includes('/(auth)/')) {
        console.log('🔀 [AuthContext] Not authenticated, redirecting to login from:', currentPath);
        router.replace('/(auth)/login');
      }
    } else {
      // Authenticated - only redirect from root or auth screens
      // Do NOT redirect if user is on wallet, chat-history, or any other main screen
      const isOnAuthScreen = currentPath.includes('/(auth)/');
      const isOnRootOnly = currentPath === '/' || currentPath === '/index';
      
      if (isOnAuthScreen || isOnRootOnly) {
        console.log('🔀 [AuthContext] Authenticated, redirecting to chat from:', currentPath);
        router.replace('/(main)/chat');
      } else {
        console.log('🔀 [AuthContext] User on main screen, staying at:', currentPath);
      }
      // If user is on /(main)/wallet, /(main)/chat-history, etc - stay there
    }
  }, [user, isLoading]);

  // Grid sign-in logic moved to GridContext
  // AuthContext now only handles Supabase authentication

  const checkAuthSession = async () => {
    console.log('🔍 [Auth Check] Checking Supabase session...');
    try {
      // Check Supabase session
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
      
      // Note: Grid session validation is now handled by GridContext
      console.log('✅ [Auth Check] Auth state validated - proceeding with sign-in');
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

      // Get Grid account data (kept for backward compatibility in user object)
      // Actual Grid state management is handled by GridContext
      console.log('🏦 Fetching Grid account data');
      const { data: gridData, error: gridError } = await supabase
        .from('users_grid')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      // It's OK if no Grid data exists yet - it will be created by GridContext
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
        // Grid wallet info (kept for backward compatibility, but managed by GridContext)
        solanaAddress: gridData?.solana_wallet_address,
        gridAccountStatus: gridData?.grid_account_status || 'not_created',
        gridAccountId: gridData?.grid_account_id,
      };

      console.log('👤 Setting user:', user);
      setUser(user);
      console.log('✅ User set successfully');
      
      // Note: Grid sign-in is now handled by GridContext, not AuthContext
      // Clear signing-in state - Grid flow is separate
      setIsSigningIn(false);
    } catch (error) {
      console.error('❌ Error handling sign in:', error);
      // Clear signing-in state on error
      setIsSigningIn(false);
    }
  };

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * LOGOUT - Supabase Authentication Cleanup
   * ═══════════════════════════════════════════════════════════════════════════════
   * 
   * This function handles Supabase authentication cleanup.
   * Grid wallet cleanup is now handled by GridContext.
   * 
   * WHAT IT CLEARS:
   * ───────────────
   * 1. Native Google Sign-In (mobile only)
   * 2. Supabase authentication session
   * 3. Auth tokens (access + refresh)
   * 4. Supabase persisted session in AsyncStorage
   * 5. Wallet data cache
   * 6. React state (user, flags)
   * 7. Navigation stack
   * 
   * Note: Grid wallet cleanup (clearGridAccount) should be called by GridContext
   * ═══════════════════════════════════════════════════════════════════════════════
   */
  const logout = async () => {
    // GUARD: Prevent recursive logout calls
    if (isLoggingOut.current) {
      console.log('🚪 [LOGOUT] Already logging out - skipping recursive call');
      return;
    }
    
    isLoggingOut.current = true;
    
    try {
      console.log('🚪 [LOGOUT] Starting Supabase logout');
      setIsLoading(true);
      
      // STEP 1: Clear signing-in state immediately
      setIsSigningIn(false);
      // Clear OAuth-in-progress flag
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem('mallory_oauth_in_progress');
      }
      console.log('🚪 [LOGOUT] Signing-in state cleared');
      
      // STEP 2: Sign out from native Google Sign-In (mobile only)
      if (Platform.OS !== 'web') {
        try {
          console.log('🚪 [LOGOUT] Signing out from Google (native)');
          await signOutFromGoogle();
        } catch (error) {
          console.log('🚪 [LOGOUT] Google sign-out error (non-critical):', error);
        }
      }
      
      // STEP 3: Clear auth tokens
      await secureStorage.removeItem(AUTH_TOKEN_KEY);
      await secureStorage.removeItem(REFRESH_TOKEN_KEY);
      console.log('🚪 [LOGOUT] Auth tokens cleared');
      
      // STEP 4: Clear Supabase persisted session from AsyncStorage
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
      
      // STEP 5: Clear wallet cache
      try {
        walletDataService.clearCache();
        console.log('🚪 [LOGOUT] Wallet cache cleared');
      } catch (error) {
        console.log('🚪 [LOGOUT] Could not clear wallet cache:', error);
      }
      
      // STEP 6: Clear React state
      setUser(null);
      setNeedsReauth(false);
      hasCheckedReauth.current = false;
      console.log('🚪 [LOGOUT] React state cleared');
      
      // STEP 7: Sign out from Supabase (triggers SIGNED_OUT event)
      try {
        console.log('🚪 [LOGOUT] Signing out from Supabase');
        await supabase.auth.signOut();
      } catch (error) {
        console.log('🚪 [LOGOUT] Supabase sign-out error (non-critical):', error);
      }
      
      // STEP 8: Clear navigation stack and redirect to login
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
      // Force redirect to login even on error
      router.replace('/(auth)/login');
    } finally {
      setIsLoading(false);
      isLoggingOut.current = false;
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
      
      // IMPORTANT: Persist to sessionStorage for OAuth redirect on web
      // When OAuth redirects back, the app reloads and loses React state
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('mallory_oauth_in_progress', 'true');
        console.log('🔐 Set OAuth-in-progress flag in sessionStorage');
      }
      
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
   * Refresh User Data
   * 
   * Refetches user data (including Grid info for backward compatibility) from the database.
   * Grid-specific refresh logic is now in GridContext.refreshGridAccount()
   * 
   * @param userId - Optional user ID to use (defaults to current user)
   */
  const refreshUser = async (userId?: string) => {
    console.log('🔄 [AuthContext] Refreshing user data...');
    
    const targetUserId = userId || user?.id;
    
    if (!targetUserId) {
      console.log('🔄 [AuthContext] No user ID, skipping');
      return;
    }
    
    try {
      // Fetch user data
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', targetUserId)
        .single();
      
      // Fetch Grid data (for backward compatibility in user object)
      const { data: gridData } = await supabase
        .from('users_grid')
        .select('*')
        .eq('id', targetUserId)
        .single();

      // Update user state
      if (user) {
        setUser(prev => {
          if (!prev) return null;
          return {
            ...prev,
            ...(userData && {
              instantBuyAmount: userData.instant_buy_amount,
              instayieldEnabled: userData.instayield_enabled,
              hasCompletedOnboarding: userData.has_completed_onboarding,
            }),
            // Grid data for backward compatibility
            solanaAddress: gridData?.solana_wallet_address || prev.solanaAddress,
            gridAccountStatus: gridData?.grid_account_status || prev.gridAccountStatus,
            gridAccountId: gridData?.grid_account_id || prev.gridAccountId,
          };
        });
        console.log('🔄 [AuthContext] User data refreshed');
      }
    } catch (error) {
      console.error('❌ [AuthContext] Error refreshing user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        needsReauth,
        isCheckingReauth,
        isSigningIn,
        login,
        logout,
        refreshUser,
        completeReauth,
        triggerReauth
      }}
    >
      {children}
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
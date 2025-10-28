import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase, secureStorage, config } from '../lib';
import { configureGoogleSignIn, signInWithGoogle, signOutFromGoogle } from '../features/auth';
import { gridClientService } from '../features/grid';
import OtpVerificationModal from '../components/grid/OtpVerificationModal';

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
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [isCheckingReauth, setIsCheckingReauth] = useState(false);
  const hasCheckedReauth = useRef(false);
  
  // Grid OTP modal state
  const [showGridOtpModal, setShowGridOtpModal] = useState(false);
  const [gridUserForOtp, setGridUserForOtp] = useState<any>(null);

  console.log('AuthProvider rendering, user:', user?.email || 'none', 'isLoading:', isLoading);

  useEffect(() => {
    // Configure Google Sign-In for mobile
    if (Platform.OS !== 'web') {
      configureGoogleSignIn();
    }
    
    // Check for existing session
    checkAuthSession();

    // Listen for auth state changes - simplified
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, 'Session:', !!session);
        
        if (session && event === 'SIGNED_IN') {
          // When Supabase auth succeeds, also initiate Grid sign-in
          // This pairs Supabase + Grid as one unified sign-in experience
          await handleSignIn(session);
        } else if (event === 'TOKEN_REFRESHED' && session) {
          // Just update tokens, don't re-process user data or trigger Grid
          // User is already signed in to both Supabase and Grid
          await secureStorage.setItem(AUTH_TOKEN_KEY, session.access_token);
          if (session.refresh_token) {
            await secureStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
          }
        } else if (event === 'SIGNED_OUT') {
          await handleSignOut();
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Helper function to check and initiate Grid sign-in if needed
  // Called explicitly only when we know the user should have a Grid account
  const checkAndInitiateGridSignIn = async (userEmail: string) => {
    try {
      console.log('🏦 [Grid] Checking Grid account status for:', userEmail);
      
      // Check if Grid account exists in client-side secure storage
      const gridAccount = await gridClientService.getAccount();
      
      if (gridAccount) {
        console.log('✅ [Grid] Grid account already exists in secure storage');
        return; // Already signed in to Grid
      }
      
      console.log('🏦 [Grid] No Grid account found, starting sign-in...');
      
      // Start Grid sign-in - backend automatically detects auth level and handles migration
      const { user: gridUser } = await gridClientService.startSignIn(userEmail);
      setGridUserForOtp(gridUser);
      setShowGridOtpModal(true);
    } catch (error) {
      console.error('❌ [Grid] Failed to start Grid sign-in:', error);
      // Don't block the main flow - Grid wallet is optional
    }
  };

  const checkAuthSession = async () => {
    console.log('🔍 checkAuthSession called');
    try {
      // Get session from Supabase
      console.log('🔍 About to call supabase.auth.getSession()');
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('checkAuthSession - Session:', !!session, 'Error:', error);
      console.log('checkAuthSession - Session data:', session ? {
        user_id: session.user?.id,
        email: session.user?.email,
        expires_at: session.expires_at
      } : null);
      
      if (session) {
        await handleSignIn(session);
      }
    } catch (error) {
      console.error('Error checking auth session:', error);
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
    } catch (error) {
      console.error('❌ Error handling sign in:', error);
    }
  };

  /**
   * Clear all auth state and redirect to login
   * Used internally by both manual logout and Supabase auth events
   */
  const clearAuthState = async () => {
    console.log('🚪 [clearAuthState] Clearing all auth state');
    
    // STEP 1: Close modals FIRST (before any state changes)
    // This prevents modals from blocking navigation
    setShowGridOtpModal(false);
    setGridUserForOtp(null);
    console.log('🚪 [clearAuthState] Modals closed');
    
    // STEP 2: Clear our tokens
    await secureStorage.removeItem(AUTH_TOKEN_KEY);
    await secureStorage.removeItem(REFRESH_TOKEN_KEY);
    
    // STEP 3: Clear Supabase's persisted session from AsyncStorage
    // This prevents session re-hydration on hard refresh
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
        console.log('🚪 [clearAuthState] Cleared Supabase storage:', supabaseKeys);
      }
    } catch (error) {
      console.log('🚪 [clearAuthState] Could not clear Supabase storage:', error);
    }
    
    // STEP 4: Clear wallet cache
    try {
      const { walletDataService } = await import('../features/wallet');
      walletDataService.clearCache();
      console.log('🚪 [clearAuthState] Wallet cache cleared');
    } catch (error) {
      console.log('🚪 [clearAuthState] Could not clear wallet cache:', error);
    }
    
    // STEP 5: Clear auth state
    setUser(null);
    setNeedsReauth(false);
    hasCheckedReauth.current = false;
    console.log('🚪 [clearAuthState] Auth state cleared');
    
    // STEP 6: Clear navigation stack and redirect to login
    // dismissAll() ensures we clear any stacked screens that might interfere
    try {
      if (router.canDismiss()) {
        router.dismissAll();
        console.log('🚪 [clearAuthState] Navigation stack dismissed');
      }
    } catch (error) {
      console.log('🚪 [clearAuthState] Could not dismiss navigation stack:', error);
    }
    
    // Final redirect to login
    router.replace('/(auth)/login');
    console.log('🚪 [clearAuthState] Redirected to login');
  };

  /**
   * Handle Supabase SIGNED_OUT event
   * Called automatically when Supabase session ends
   */
  const handleSignOut = async () => {
    try {
      console.log('🚪 [handleSignOut] Supabase signed out event');
      await clearAuthState();
    } catch (error) {
      console.error('🚪 [handleSignOut] Error:', error);
      router.replace('/(auth)/login');
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
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Manual logout - Sign out from all services
   * Called when user clicks "Sign out" button
   */
  const logout = async () => {
    try {
      console.log('🚪 [logout] Manual logout initiated');
      setIsLoading(true);
      
      // Sign out from native Google Sign-In if on mobile
      if (Platform.OS !== 'web') {
        console.log('🚪 [logout] Signing out from Google (native)');
        await signOutFromGoogle();
      }
      
      // Sign out from Supabase (this will trigger handleSignOut via auth listener)
      console.log('🚪 [logout] Signing out from Supabase');
      await supabase.auth.signOut();
      
      // Clear auth state (in case listener doesn't fire)
      await clearAuthState();
      
      console.log('🚪 [logout] Logout completed successfully');
    } catch (error) {
      console.error('🚪 [logout] Logout error:', error);
      // Force clear state and redirect even on error
      await clearAuthState();
    } finally {
      setIsLoading(false);
    }
  };

  const refreshGridAccount = async () => {
    console.log('🔄 [refreshGridAccount] Starting...');
    
    // Just refetch the Grid data from database, don't create new accounts
    if (!user?.id) {
      console.log('🔄 [refreshGridAccount] No user ID, skipping');
      return;
    }
    
    try {
      console.log('🔄 [refreshGridAccount] Querying database for user:', user.id);
      
      const { data: gridData, error: queryError } = await supabase
        .from('users_grid')
        .select('*')
        .eq('id', user.id)
        .single();

      console.log('🔄 [refreshGridAccount] Query result:', {
        hasData: !!gridData,
        address: gridData?.solana_wallet_address,
        status: gridData?.grid_account_status,
        error: queryError?.message,
      });

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
    } catch (error) {
      console.error('❌ [refreshGridAccount] Error:', error);
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
      
      {/* Grid OTP Verification Modal */}
      {showGridOtpModal && (
        <OtpVerificationModal
          visible={showGridOtpModal}
          onClose={async (success: boolean) => {
            console.log('🔐 [OTP Modal] onClose called with success:', success);
            
            if (!success) {
              // User cannot skip - Grid setup is required
              console.error('❌ Grid setup is required to use Mallory');
              // Keep modal open by not changing state
              return;
            }
            
            console.log('🔐 [OTP Modal] Success! Refreshing Grid account...');
            
            // Safety net: Ensure modal closes within 2 seconds even if refresh hangs
            // This fixes mobile Safari issues where refreshGridAccount can stall
            const timeoutId = setTimeout(() => {
              console.warn('🔐 [OTP Modal] Force closing modal after timeout');
              setShowGridOtpModal(false);
              setGridUserForOtp(null);
            }, 2000);
            
            // Success - Grid address already synced by backend
            // Refresh auth context to update user state from database
            try {
              console.log('🔐 [OTP Modal] Starting refreshGridAccount...');
              
              // Race the refresh against a 1.8s timeout to detect hangs early
              await Promise.race([
                refreshGridAccount(),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Refresh timeout')), 1800)
                )
              ]);
              
              console.log('🔐 [OTP Modal] Grid account refreshed successfully');
            } catch (error) {
              // Log the error but don't prevent modal from closing
              // The Grid account is already created and synced - refresh is just nice-to-have
              console.error('🔐 [OTP Modal] Error refreshing Grid account:', error);
            } finally {
              // Always clean up: cancel timeout and close modal
              clearTimeout(timeoutId);
              setShowGridOtpModal(false);
              setGridUserForOtp(null);
              console.log('🔐 [OTP Modal] Modal closed');
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
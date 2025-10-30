/**
 * Centralized storage keys for the Mallory app
 * 
 * NAMING CONVENTION:
 * - All keys use 'mallory_' prefix for namespacing
 * - Use snake_case for consistency
 * - Group by category (auth, grid, session)
 * 
 * STORAGE TYPE RULES:
 * - secureStorage: Persistent data that survives app restart (auth tokens, wallet credentials)
 * - sessionStorage: Temporary flow state, UI flags (cleared on tab close)
 */

// ═══════════════════════════════════════════════════════════════
// SECURE STORAGE KEYS (Persistent across app sessions)
// ═══════════════════════════════════════════════════════════════

export const SECURE_STORAGE_KEYS = {
  // Authentication
  AUTH_TOKEN: 'mallory_auth_token',
  REFRESH_TOKEN: 'mallory_refresh_token',
  
  // Grid Wallet (Persistent credentials)
  GRID_ACCOUNT: 'mallory_grid_account',
  GRID_SESSION_SECRETS: 'mallory_grid_session_secrets',
} as const;

// ═══════════════════════════════════════════════════════════════
// SESSION STORAGE KEYS (Temporary, cleared on tab close)
// ═══════════════════════════════════════════════════════════════

export const SESSION_STORAGE_KEYS = {
  // OAuth Flow
  OAUTH_IN_PROGRESS: 'mallory_oauth_in_progress',
  
  // Grid Sign-In Flow
  GRID_USER: 'mallory_grid_user',
  GRID_IS_EXISTING_USER: 'mallory_grid_is_existing_user',
  GRID_AUTO_INITIATE: 'mallory_auto_initiate_grid',
  GRID_AUTO_INITIATE_EMAIL: 'mallory_auto_initiate_email',
  
  // OTP Flow
  OTP_RETURN_PATH: 'mallory_otp_return_path',
  
  // Logout
  IS_LOGGING_OUT: 'mallory_is_logging_out',
  
  // Transactions
  PENDING_SEND: 'mallory_pending_send',
} as const;

// Type helpers for compile-time safety
export type SecureStorageKey = typeof SECURE_STORAGE_KEYS[keyof typeof SECURE_STORAGE_KEYS];
export type SessionStorageKey = typeof SESSION_STORAGE_KEYS[keyof typeof SESSION_STORAGE_KEYS];

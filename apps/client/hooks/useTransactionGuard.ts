import { useAuth } from '../contexts/AuthContext';
import { useGrid } from '../contexts/GridContext';
import { SESSION_STORAGE_KEYS, storage } from '../lib';

/**
 * Transaction Guard Hook
 * 
 * Provides reactive Grid session validation before transactions.
 * Ensures Grid session is valid before allowing on-chain operations.
 * 
 * Usage:
 * ```typescript
 * const { ensureGridSession } = useTransactionGuard();
 * 
 * const canProceed = await ensureGridSession(
 *   'send transaction',
 *   '/(main)/wallet',
 *   '#FFEFE3'
 * );
 * 
 * if (!canProceed) {
 *   // User being redirected to OTP, save pending action
 *   return;
 * }
 * ```
 */
export function useTransactionGuard() {
  const { user } = useAuth();
  const { gridAccount, initiateGridSignIn } = useGrid();
  
  /**
   * Ensure Grid Session is Valid
   * 
   * Checks if Grid account exists and is ready for transactions.
   * If not, triggers OTP flow with proper context.
   * 
   * @param actionName - Name of action requiring Grid session (for logging)
   * @param currentScreen - Current screen path (for return navigation)
   * @param backgroundColor - Background color for OTP screen
   * @param textColor - Text color for OTP screen
   * @returns Promise<boolean> - true if can proceed, false if OTP required
   */
  const ensureGridSession = async (
    actionName: string,
    currentScreen: string,
    backgroundColor: string,
    textColor: string
  ): Promise<boolean> => {
    console.log(`🛡️ [TransactionGuard] Checking Grid session for: ${actionName}`);
    
    // Check if Grid account exists and is valid
    if (!gridAccount) {
      console.log(`🛡️ [TransactionGuard] Grid session required for ${actionName}`);
      
      // Store current location for return navigation
      await storage.session.setItem(SESSION_STORAGE_KEYS.OTP_RETURN_PATH, currentScreen);
      
      // Trigger Grid sign-in with proper context
      if (user?.email) {
        console.log('🛡️ [TransactionGuard] Initiating Grid sign-in for transaction');
        await initiateGridSignIn(user.email, { 
          backgroundColor,
          textColor,
          returnPath: currentScreen 
        });
      } else {
        console.error('🛡️ [TransactionGuard] No user email available');
      }
      
      return false; // Transaction blocked, OTP required
    }
    
    console.log(`✅ [TransactionGuard] Grid session valid, ${actionName} can proceed`);
    return true; // Transaction can proceed
  };
  
  return { ensureGridSession };
}


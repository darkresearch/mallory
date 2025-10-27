/**
 * Grid Context Utilities
 * Shared between production and tests for x402 payment handling
 */

export interface GridContextOptions {
  getGridAccount: () => Promise<any>;
  getSessionSecrets: () => Promise<string | null>;
}

export interface GridContext {
  gridSessionSecrets: any | null;
  gridSession: any | null;
}

/**
 * Load Grid context for x402 payments
 * 
 * This function abstracts the Grid account and session secrets loading
 * with dependency injection, allowing it to be used in both production
 * and test environments.
 * 
 * @param options - Functions to get Grid account and session secrets
 * @returns Grid context with secrets and session, or null values if unavailable
 */
export async function loadGridContextForX402(
  options: GridContextOptions
): Promise<GridContext> {
  try {
    const account = await options.getGridAccount();
    const sessionSecretsJson = await options.getSessionSecrets();
    
    console.log('🔐 [loadGridContextForX402] Account structure:', {
      hasAccount: !!account,
      accountKeys: account ? Object.keys(account) : [],
      hasAddress: !!account?.address,
      address: account?.address,
      hasAuthentication: !!account?.authentication,
      authKeys: account?.authentication ? Object.keys(account.authentication) : []
    });
    
    if (account && sessionSecretsJson) {
      const gridSessionSecrets = JSON.parse(sessionSecretsJson);
      
      // Grid SDK expects authentication to be passed AS-IS (array or object)
      // Do NOT extract elements - just pass it through with address
      const gridSession = account.authentication;
      
      console.log('🔐 Grid context loaded for x402 payments:', {
        hasAccount: !!account,
        hasAuthentication: !!gridSession,
        accountAddress: account.address,
        authIsArray: Array.isArray(gridSession),
        authType: typeof gridSession
      });
      
      // Return authentication AS-IS, plus address at top level for backend access
      return { 
        gridSessionSecrets, 
        gridSession: {
          authentication: gridSession,  // Pass array/object as-is
          address: account.address
        }
      };
    }
    
    console.log('⚠️ Grid context not available');
    return { gridSessionSecrets: null, gridSession: null };
  } catch (error) {
    console.log('⚠️ Error loading Grid context:', error);
    return { gridSessionSecrets: null, gridSession: null };
  }
}


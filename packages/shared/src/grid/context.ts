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
    
    if (account && sessionSecretsJson) {
      const gridSessionSecrets = JSON.parse(sessionSecretsJson);
      const gridSession = {
        ...account.authentication,
        address: account.address
      };
      
      console.log('🔐 Grid context loaded for x402 payments');
      return { gridSessionSecrets, gridSession };
    }
    
    console.log('⚠️ Grid context not available');
    return { gridSessionSecrets: null, gridSession: null };
  } catch (error) {
    console.log('⚠️ Error loading Grid context:', error);
    return { gridSessionSecrets: null, gridSession: null };
  }
}


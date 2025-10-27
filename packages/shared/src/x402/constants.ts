// x402 Protocol Constants
// EXACT same values as Researcher
// Safe for both Node and browser environments
export const X402_CONSTANTS = {
  // Solana network (runtime values from env)
  // Check both SOLANA_RPC_URL (server) and EXPO_PUBLIC_SOLANA_RPC_URL (client/tests)
  getSolanaRpcUrl: () => {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.SOLANA_RPC_URL || process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    }
    return 'https://api.mainnet-beta.solana.com';
  },
  SOLANA_CLUSTER: 'mainnet-beta' as const, // Hardcoded like Researcher
  
  // Tokens
  USDC_MINT: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  
  // Payment thresholds
  AUTO_APPROVE_THRESHOLD_USDC: 0.01,
  
  // Ephemeral wallet funding (same as Researcher)
  EPHEMERAL_FUNDING_USDC: '0.01', // Enough for ~10 API calls
  EPHEMERAL_FUNDING_SOL: '0.001',  // For transaction fees
  
  // Nansen API (runtime from env)
  getNansenApiBase: () => (typeof process !== 'undefined' && process.env?.NANSEN_API_URL) || 'https://nansen.api.corbits.dev',
  NANSEN_ESTIMATED_COST: {
    amount: '0.001',
    currency: 'USDC' as const
  }
} as const;


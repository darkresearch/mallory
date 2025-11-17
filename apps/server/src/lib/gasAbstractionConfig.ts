/**
 * Gas Abstraction Configuration
 * 
 * Loads and validates environment variables for x402 Gas Abstraction Gateway.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.7
 */

/**
 * Gas Abstraction Gateway configuration
 */
export interface GasAbstractionConfig {
  gatewayUrl: string;
  gatewayNetwork: string;
  usdcMint: string;
  solanaRpcUrl: string;
}

/**
 * Load gas abstraction configuration from environment variables
 * 
 * @returns Configuration object
 * @throws Error if required configuration values are missing
 */
export function loadGasAbstractionConfig(): GasAbstractionConfig {
  // Load GAS_GATEWAY_URL from environment
  const gatewayUrl = process.env.GAS_GATEWAY_URL;
  if (!gatewayUrl) {
    throw new Error('GAS_GATEWAY_URL environment variable is required');
  }

  // Load GAS_GATEWAY_NETWORK with value "solana-mainnet-beta"
  const gatewayNetwork = process.env.GAS_GATEWAY_NETWORK || 'solana-mainnet-beta';
  if (gatewayNetwork !== 'solana-mainnet-beta') {
    console.warn(`GAS_GATEWAY_NETWORK is set to "${gatewayNetwork}", expected "solana-mainnet-beta"`);
  }

  // Load GAS_GATEWAY_USDC_MINT with value EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
  const usdcMint = process.env.GAS_GATEWAY_USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  if (usdcMint !== 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
    console.warn(`GAS_GATEWAY_USDC_MINT is set to "${usdcMint}", expected "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"`);
  }

  // Load SOLANA_RPC_URL from environment
  const solanaRpcUrl = process.env.SOLANA_RPC_URL;
  if (!solanaRpcUrl) {
    throw new Error('SOLANA_RPC_URL environment variable is required');
  }

  return {
    gatewayUrl,
    gatewayNetwork,
    usdcMint,
    solanaRpcUrl,
  };
}

/**
 * Validate gas abstraction configuration at startup
 * 
 * @param config - Configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateGasAbstractionConfig(config: GasAbstractionConfig): void {
  // Validate gateway URL format
  try {
    new URL(config.gatewayUrl);
  } catch (error) {
    throw new Error(`Invalid GAS_GATEWAY_URL: ${config.gatewayUrl}`);
  }

  // Validate network
  if (config.gatewayNetwork !== 'solana-mainnet-beta') {
    throw new Error(`Invalid GAS_GATEWAY_NETWORK: ${config.gatewayNetwork} (expected "solana-mainnet-beta")`);
  }

  // Validate USDC mint address format (Solana public key)
  if (!config.usdcMint || config.usdcMint.length < 32 || config.usdcMint.length > 44) {
    throw new Error(`Invalid GAS_GATEWAY_USDC_MINT: ${config.usdcMint}`);
  }

  // Validate Solana RPC URL format
  try {
    new URL(config.solanaRpcUrl);
  } catch (error) {
    throw new Error(`Invalid SOLANA_RPC_URL: ${config.solanaRpcUrl}`);
  }

  console.log('✅ Gas Abstraction configuration validated');
  console.log(`   Gateway URL: ${config.gatewayUrl}`);
  console.log(`   Network: ${config.gatewayNetwork}`);
  console.log(`   USDC Mint: ${config.usdcMint}`);
  console.log(`   Solana RPC: ${config.solanaRpcUrl}`);
}


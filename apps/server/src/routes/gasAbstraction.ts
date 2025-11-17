/**
 * Gas Abstraction API Routes
 * 
 * Provides endpoints for x402 Gas Abstraction Gateway integration:
 * - Balance queries
 * - Top-up requirements and submission
 * - Transaction sponsorship
 * 
 * Requirements: 2.1, 3.1, 4.1, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import { Router, Response } from 'express';
import { authenticateUser, type AuthenticatedRequest } from '../middleware/auth.js';
import { X402GasAbstractionService, GatewayError } from '../lib/x402GasAbstractionService.js';
import { gasTelemetry } from '../lib/telemetry.js';
import { loadGasAbstractionConfig } from '../lib/gasAbstractionConfig.js';

const router = Router();

// Initialize service with configuration
let gasService: X402GasAbstractionService | null = null;

try {
  const config = loadGasAbstractionConfig();
  gasService = new X402GasAbstractionService(config);
  console.log('✅ Gas Abstraction Service initialized');
} catch (error: any) {
  console.warn('⚠️  Gas Abstraction Service not initialized:', error.message);
  // Service will be null, routes will return errors
}

/**
 * POST /api/gas-abstraction/balance
 * Returns user's gateway balance and transaction history
 * 
 * Note: Using POST instead of GET because Grid session data needs to be sent in body
 * 
 * Body: {
 *   gridSessionSecrets: object,
 *   gridSession: object
 * }
 */
router.post('/balance', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  if (!gasService) {
    return res.status(503).json({
      error: 'Gas abstraction service not configured',
      message: 'GAS_GATEWAY_URL and SOLANA_RPC_URL must be set in environment'
    });
  }

  try {
    const { gridSessionSecrets, gridSession } = req.body;
    
    if (!gridSessionSecrets || !gridSession) {
      return res.status(400).json({
        error: 'Grid session required',
        message: 'gridSessionSecrets and gridSession must be provided in request body'
      });
    }

    // Extract wallet address from grid session
    const walletAddress = gridSession.address || gridSession.authentication?.address;
    if (!walletAddress) {
      return res.status(400).json({
        error: 'Wallet address not found',
        message: 'Grid session must contain wallet address'
      });
    }

    // Call service with retry logic
    const balance = await gasService.getBalance(
      walletAddress,
      gridSession,
      gridSessionSecrets
    );
    
    // Log success
    gasTelemetry.balanceFetchSuccess(walletAddress);
    
    res.json(balance);
  } catch (error: any) {
    // Log error
    const walletAddress = req.body?.gridSession?.address || req.user?.id;
    const errorCode = error instanceof GatewayError ? error.status : 500;
    gasTelemetry.balanceFetchError(walletAddress, errorCode);
    
    // Return error with appropriate status
    const status = error instanceof GatewayError ? error.status : 500;
    res.status(status).json({
      error: error.message || 'Failed to fetch balance',
      ...(error instanceof GatewayError && error.data && { data: error.data })
    });
  }
});

/**
 * GET /api/gas-abstraction/topup/requirements
 * Returns payment requirements for top-up (no auth required for gateway, but user auth required)
 */
router.get('/topup/requirements', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  if (!gasService) {
    return res.status(503).json({
      error: 'Gas abstraction service not configured',
      message: 'GAS_GATEWAY_URL and SOLANA_RPC_URL must be set in environment'
    });
  }

  try {
    const requirements = await gasService.getTopupRequirements();
    
    // Validate network and asset match config
    if (!gasService.validateNetworkAndAsset(requirements)) {
      return res.status(400).json({
        error: 'Network or asset mismatch',
        details: 'Gateway requirements do not match Mallory configuration',
        gatewayNetwork: requirements.network,
        expectedNetwork: process.env.GAS_GATEWAY_NETWORK,
        gatewayAsset: requirements.asset,
        expectedAsset: process.env.GAS_GATEWAY_USDC_MINT
      });
    }
    
    res.json(requirements);
  } catch (error: any) {
    const status = error instanceof GatewayError ? error.status : 500;
    res.status(status).json({
      error: error.message || 'Failed to fetch top-up requirements',
      ...(error instanceof GatewayError && error.data && { data: error.data })
    });
  }
});

/**
 * POST /api/gas-abstraction/topup
 * Submit USDC payment to credit balance
 * 
 * Body: {
 *   payment: X402Payment (base64) - OR -
 *   transaction: string (base64 unsigned), publicKey: string, amountBaseUnits: number,
 *   gridSessionSecrets: object, gridSession: object
 * }
 */
router.post('/topup', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  if (!gasService) {
    return res.status(503).json({
      error: 'Gas abstraction service not configured',
      message: 'GAS_GATEWAY_URL and SOLANA_RPC_URL must be set in environment'
    });
  }

  try {
    const walletAddress = req.body?.gridSession?.address || req.user?.id;
    
    // Log top-up start
    gasTelemetry.topupStart(walletAddress);
    
    let payment: string;
    
    // Check if payment payload is provided directly, or if we need to construct it
    if (req.body.payment) {
      // Direct payment payload (legacy format)
      payment = req.body.payment;
    } else if (req.body.transaction && req.body.publicKey && req.body.gridSessionSecrets && req.body.gridSession) {
      // New format: unsigned transaction + Grid session
      // Sign transaction using Grid, then construct x402 payment payload
      const { transaction: serializedTx, publicKey, amountBaseUnits, gridSessionSecrets, gridSession } = req.body;
      
      // Import Grid client
      const { createGridClient } = await import('../lib/gridClient.js');
      const gridClient = createGridClient();
      
      // Prepare transaction with Grid
      const transactionPayload = await gridClient.prepareArbitraryTransaction(
        gridSession.address,
        {
          transaction: serializedTx,
          fee_config: {
            currency: 'sol',
            payer_address: gridSession.address,
            self_managed_fees: false
          }
        }
      );
      
      if (!transactionPayload || !transactionPayload.data) {
        throw new Error('Failed to prepare transaction with Grid');
      }
      
      // Sign transaction using Grid
      // Note: Grid's signAndSend sends the transaction, but for top-up we need the signed tx
      // We'll use a workaround: prepare the transaction and extract the signed version
      // However, Grid doesn't expose the signed transaction directly.
      // 
      // For now, we'll accept that the transaction needs to be sent to Solana first,
      // then the x402 gateway will verify it on-chain. This is acceptable for top-up flows.
      //
      // Alternative: Use the prepared transaction payload which may contain signing info
      // But Grid's API doesn't expose this.
      //
      // For now, we'll construct the payment payload with the unsigned transaction
      // and let the x402 gateway handle verification. The user will need to sign and send
      // the transaction separately, or we can use a different flow.
      
      // Get top-up requirements to construct payment payload
      const requirements = await gasService.getTopupRequirements();
      const config = await import('../lib/gasAbstractionConfig.js').then(m => m.loadGasAbstractionConfig());
      
      // Construct x402 payment payload
      // Note: The x402 gateway expects a signed transaction in the payload.
      // Since Grid SDK doesn't support sign-only, we'll need to use a workaround.
      // For now, we'll construct the payment payload with the unsigned transaction
      // and the gateway may handle it differently, or we'll need to implement
      // a client-side signing flow using Grid's prepareArbitraryTransaction.
      //
      // TODO: Implement proper transaction signing flow
      const paymentPayload = {
        x402Version: requirements.x402Version,
        scheme: 'solana',
        network: 'solana-mainnet-beta',
        asset: config.usdcMint,
        payload: {
          transaction: serializedTx, // TODO: Should be signed transaction
          publicKey: publicKey,
        },
      };
      
      // Convert to base64 for submission
      payment = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
    } else {
      return res.status(400).json({ 
        error: 'Payment payload or transaction data required',
        message: 'Provide either "payment" (base64 x402 payload) or "transaction", "publicKey", "amountBaseUnits", "gridSessionSecrets", and "gridSession"'
      });
    }
    
    // Submit to gateway
    const result = await gasService.submitTopup(payment);
    
    // Log success
    gasTelemetry.topupSuccess(walletAddress, result.amountBaseUnits);
    
    res.json(result);
  } catch (error: any) {
    // Log failure
    const walletAddress = req.body?.gridSession?.address || req.user?.id;
    const errorCode = error instanceof GatewayError ? error.status : 500;
    gasTelemetry.topupFailure(walletAddress, errorCode);
    
    const status = error instanceof GatewayError ? error.status : 500;
    res.status(status).json({
      error: error.message || 'Top-up failed',
      ...(error instanceof GatewayError && error.data && { data: error.data })
    });
  }
});

/**
 * POST /api/gas-abstraction/sponsor
 * Request transaction sponsorship
 * 
 * Body: {
 *   transaction: string (base64-encoded unsigned VersionedTransaction),
 *   gridSessionSecrets: object,
 *   gridSession: object
 * }
 */
router.post('/sponsor', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  if (!gasService) {
    return res.status(503).json({
      error: 'Gas abstraction service not configured',
      message: 'GAS_GATEWAY_URL and SOLANA_RPC_URL must be set in environment'
    });
  }

  try {
    const { transaction, gridSessionSecrets, gridSession } = req.body;
    
    if (!transaction) {
      return res.status(400).json({ error: 'Transaction required' });
    }

    if (!gridSessionSecrets || !gridSession) {
      return res.status(400).json({
        error: 'Grid session required',
        message: 'gridSessionSecrets and gridSession must be provided in request body'
      });
    }

    // Extract wallet address
    const walletAddress = gridSession.address || gridSession.authentication?.address;
    if (!walletAddress) {
      return res.status(400).json({
        error: 'Wallet address not found',
        message: 'Grid session must contain wallet address'
      });
    }

    // Log sponsorship start
    gasTelemetry.sponsorStart(walletAddress);
    
    // Request sponsorship
    const result = await gasService.sponsorTransaction(
      transaction,
      walletAddress,
      gridSession,
      gridSessionSecrets
    );
    
    // Log success
    gasTelemetry.sponsorSuccess(walletAddress, result.billedBaseUnits);
    
    res.json(result);
  } catch (error: any) {
    // Log specific error types
    const walletAddress = req.body?.gridSession?.address || req.user?.id;
    
    if (error instanceof GatewayError && error.status === 402) {
      // Insufficient balance
      const required = error.data?.required || error.data?.requiredBaseUnits;
      const available = error.data?.available || error.data?.availableBaseUnits;
      gasTelemetry.sponsorInsufficientBalance(walletAddress, required, available);
    } else {
      // Other errors
      const errorCode = error instanceof GatewayError ? error.status : 500;
      gasTelemetry.sponsorError(walletAddress, errorCode);
    }
    
    const status = error instanceof GatewayError ? error.status : 500;
    res.status(status).json({
      error: error.message || 'Sponsorship failed',
      ...(error instanceof GatewayError && error.data && { data: error.data })
    });
  }
});

export default router;


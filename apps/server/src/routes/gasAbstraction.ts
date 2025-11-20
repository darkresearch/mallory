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
import { WalletAuthGenerator } from '../lib/walletAuthGenerator.js';
import { createTopupPaymentWithEphemeralWallet } from '../lib/gasAbstractionTopupHelper.js';
import { createGridClient } from '../lib/gridClient.js';
import type { GridTokenSender } from '@darkresearch/mallory-shared/x402/EphemeralWalletManager.js';

const router = Router();

/**
 * Create Grid token sender from session data
 * Reuses the same logic as /api/grid/send-tokens endpoint
 */
function createGridSender(sessionSecrets: any, session: any, address: string): GridTokenSender {
  return {
    async sendTokens(params: { recipient: string; amount: string; tokenMint?: string }): Promise<string> {
      // Validate inputs
      if (!address || typeof address !== 'string') {
        throw new Error(`Invalid address: ${address}`);
      }
      if (!params.recipient || typeof params.recipient !== 'string') {
        throw new Error(`Invalid recipient: ${params.recipient}`);
      }
      
      console.log('🔧 [Grid Sender] Sending tokens:', {
        from: address,
        to: params.recipient,
        amount: params.amount,
        tokenMint: params.tokenMint || 'SOL'
      });
      
      // Import dependencies
      const gridClient = createGridClient();
      const {
        PublicKey,
        SystemProgram,
        TransactionMessage,
        VersionedTransaction,
        Connection,
        LAMPORTS_PER_SOL
      } = await import('@solana/web3.js');
      
      const {
        createTransferInstruction,
        getAssociatedTokenAddress,
        createAssociatedTokenAccountInstruction,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      } = await import('@solana/spl-token');
      
      const connection = new Connection(
        process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        'confirmed'
      );

      // Build transaction (same as /api/grid/send-tokens)
      const instructions = [];
      const fromPubkey = new PublicKey(address);
      const toPubkey = new PublicKey(params.recipient);
      
      if (params.tokenMint) {
        const tokenMintPubkey = new PublicKey(params.tokenMint);
        const fromTokenAccount = await getAssociatedTokenAddress(
          tokenMintPubkey,
          fromPubkey,
          true  // allowOwnerOffCurve for Grid PDA
        );
        
        const toTokenAccount = await getAssociatedTokenAddress(
          tokenMintPubkey,
          toPubkey,
          false
        );

        // Check if recipient's ATA exists
        let toAccountInfo = null;
        try {
          toAccountInfo = await connection.getAccountInfo(toTokenAccount);
        } catch (error: any) {
          console.warn('⚠️  [Grid Sender] Could not check recipient ATA, assuming it exists:', error.message);
          toAccountInfo = { data: Buffer.from([]) };
        }
        
        if (!toAccountInfo) {
          const createAtaIx = createAssociatedTokenAccountInstruction(
            fromPubkey,
            toTokenAccount,
            toPubkey,
            tokenMintPubkey,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          );
          instructions.push(createAtaIx);
        }

        const amountInSmallestUnit = Math.floor(parseFloat(params.amount) * 1000000);
        const transferIx = createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          fromPubkey,
          amountInSmallestUnit,
          [],
          TOKEN_PROGRAM_ID
        );
        instructions.push(transferIx);
      } else {
        const amountInLamports = Math.floor(parseFloat(params.amount) * LAMPORTS_PER_SOL);
        const transferIx = SystemProgram.transfer({
          fromPubkey: fromPubkey,
          toPubkey: toPubkey,
          lamports: amountInLamports
        });
        instructions.push(transferIx);
      }

      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      const message = new TransactionMessage({
        payerKey: fromPubkey,
        recentBlockhash: blockhash,
        instructions
      }).compileToV0Message();

      const transaction = new VersionedTransaction(message);
      const serialized = Buffer.from(transaction.serialize()).toString('base64');

      // Prepare and sign via Grid (same as /api/grid/send-tokens)
      const transactionPayload = await gridClient.prepareArbitraryTransaction(
        address,
        {
          transaction: serialized,
          fee_config: {
            currency: 'sol',
            payer_address: address,
            self_managed_fees: false
          }
        }
      );

      if (!transactionPayload || !transactionPayload.data) {
        throw new Error('Failed to prepare transaction - Grid returned no data');
      }

      // Sign and send - pass session exactly as received (matching grid.ts implementation)
      console.log('🔐 [Grid Sender] Signing with Grid:', {
        hasSessionSecrets: !!sessionSecrets,
        sessionType: Array.isArray(session) ? 'array' : typeof session,
        sessionKeys: session && typeof session === 'object' ? Object.keys(session) : [],
        address
      });
      
      let result;
      try {
        result = await gridClient.signAndSend({
          sessionSecrets,
          session,
          transactionPayload: transactionPayload.data,
          address
        });
      } catch (signError: any) {
        console.error('❌ [Grid Sender] Grid signAndSend failed:', {
          error: signError.message,
          code: signError.code,
          details: signError.details,
          stack: signError.stack?.substring(0, 500),
        });
        throw new Error(`Grid signAndSend failed: ${signError.message || 'Unknown error'}`);
      }

      return result.transaction_signature || 'success';
    },
  };
}

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
    let { gridSessionSecrets, gridSession } = req.body;
    
    // Debug: Log what we received
    console.log('🔍 [Balance] Received request body:', {
      hasGridSessionSecrets: !!gridSessionSecrets,
      hasGridSession: !!gridSession,
      gridSessionSecretsType: typeof gridSessionSecrets,
      gridSessionSecretsIsArray: Array.isArray(gridSessionSecrets),
      gridSessionType: typeof gridSession
    });
    
    // If gridSessionSecrets is a string (JSON), parse it
    if (typeof gridSessionSecrets === 'string') {
      try {
        gridSessionSecrets = JSON.parse(gridSessionSecrets);
        console.log('🔍 [Balance] Parsed gridSessionSecrets from string');
      } catch (e) {
        console.error('❌ [Balance] Failed to parse gridSessionSecrets:', e);
        return res.status(400).json({
          error: 'Invalid gridSessionSecrets format',
          message: 'gridSessionSecrets must be valid JSON'
        });
      }
    }
    
    // If gridSession is a string (JSON), parse it
    if (typeof gridSession === 'string') {
      try {
        gridSession = JSON.parse(gridSession);
        console.log('🔍 [Balance] Parsed gridSession from string');
      } catch (e) {
        console.error('❌ [Balance] Failed to parse gridSession:', e);
        return res.status(400).json({
          error: 'Invalid gridSession format',
          message: 'gridSession must be valid JSON'
        });
      }
    }
    
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
    
    // Log full response from gateway for debugging
    console.log('📋 [Gateway] Raw top-up requirements response:', JSON.stringify(requirements, null, 2));
    
    // Normalize response: if top-level fields are missing, extract from accepts array
    if (!requirements.network || !requirements.asset || !requirements.scheme) {
      if (requirements.accepts && requirements.accepts.length > 0) {
        const firstAccept = requirements.accepts[0];
        requirements.network = requirements.network || firstAccept.network;
        requirements.asset = requirements.asset || firstAccept.asset;
        requirements.scheme = requirements.scheme || firstAccept.scheme;
      }
    }
    
    // Validate required fields (this should already be done in service, but double-check)
    if (!requirements.payTo) {
      console.error('❌ [Gateway] Missing payTo field in requirements after normalization:', requirements);
      console.error('   Available fields:', Object.keys(requirements || {}));
      return res.status(502).json({
        error: 'Invalid gateway response',
        message: 'Gateway did not provide payment address (payTo field missing)',
        details: 'The gas abstraction gateway returned an incomplete response. Please try again or contact support.',
        receivedFields: Object.keys(requirements || {})
      });
    }
    
    // Log what we received from gateway for debugging
    console.log('📋 [Gateway] Processed top-up requirements:', {
      network: requirements.network,
      asset: requirements.asset,
      scheme: requirements.scheme,
      x402Version: requirements.x402Version,
      hasPayTo: !!requirements.payTo,
      payToLength: requirements.payTo?.length
    });
    
    // Validate network and asset match config
    if (!gasService.validateNetworkAndAsset(requirements)) {
      // Log detailed mismatch info
      console.warn('⚠️  Network/Asset mismatch detected:', {
        gatewayNetwork: requirements.network,
        expectedNetwork: process.env.GAS_GATEWAY_NETWORK || 'solana-mainnet-beta',
        gatewayAsset: requirements.asset,
        expectedAsset: process.env.GAS_GATEWAY_USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      });
      
      return res.status(400).json({
        error: 'Network or asset mismatch',
        details: 'Gateway requirements do not match Mallory configuration',
        gatewayNetwork: requirements.network,
        expectedNetwork: process.env.GAS_GATEWAY_NETWORK || 'solana-mainnet-beta',
        gatewayAsset: requirements.asset,
        expectedAsset: process.env.GAS_GATEWAY_USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
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
 * Submit USDC payment to credit balance using ephemeral wallet
 * 
 * Body: {
 *   amountBaseUnits: number (optional, defaults to maxAmountRequired),
 *   gridSessionSecrets: object,
 *   gridSession: object
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
    const { amountBaseUnits, gridSessionSecrets, gridSession } = req.body;
    
    if (!gridSessionSecrets || !gridSession) {
      return res.status(400).json({
        error: 'Grid session required',
        message: 'gridSessionSecrets and gridSession must be provided in request body'
      });
    }

    // Log full gridSession structure for debugging
    console.log('🔍 [Topup] Grid session structure:', {
      hasGridSession: !!gridSession,
      gridSessionType: typeof gridSession,
      gridSessionIsArray: Array.isArray(gridSession),
      gridSessionKeys: gridSession && typeof gridSession === 'object' ? Object.keys(gridSession) : [],
      gridSessionAddress: gridSession?.address,
      gridSessionAuth: gridSession?.authentication,
      gridSessionAuthAddress: gridSession?.authentication?.address,
      hasUserId: !!req.user?.id,
      userId: req.user?.id,
      bodyPublicKey: req.body?.publicKey,
    });
    
    // Extract wallet address - try multiple locations (but NOT req.user?.id which is a UUID)
    let walletAddress = gridSession?.address || 
                         gridSession?.authentication?.address ||
                         req.body?.publicKey ||
                         req.body?.walletAddress;
    
    // If gridSession is an array, try first element
    if (!walletAddress && Array.isArray(gridSession) && gridSession.length > 0) {
      const firstItem = gridSession[0];
      walletAddress = firstItem?.address || firstItem?.authentication?.address;
      console.log('📋 [Topup] Tried first array element:', {
        hasAddress: !!firstItem?.address,
        hasAuthAddress: !!firstItem?.authentication?.address,
        address: walletAddress
      });
    }
    
    if (!walletAddress) {
      console.error('❌ [Topup] Wallet address not found in request:', {
        hasGridSession: !!gridSession,
        gridSessionType: typeof gridSession,
        gridSessionKeys: gridSession && typeof gridSession === 'object' ? Object.keys(gridSession) : [],
        hasAuthentication: !!gridSession?.authentication,
        authKeys: gridSession?.authentication && typeof gridSession.authentication === 'object' ? Object.keys(gridSession.authentication) : [],
        hasUserId: !!req.user?.id,
        fullGridSession: JSON.stringify(gridSession).substring(0, 500), // First 500 chars for debugging
      });
      return res.status(400).json({
        error: 'Wallet address not found',
        message: 'Grid session must contain wallet address. Please ensure gridSession.address or gridAccount.address is provided.',
        debug: {
          gridSessionKeys: gridSession && typeof gridSession === 'object' ? Object.keys(gridSession) : [],
          hasUserId: !!req.user?.id
        }
      });
    }
    
    console.log('✅ [Topup] Wallet address extracted:', walletAddress);
    
    // Validate wallet address is a valid base58 string
    try {
      const { PublicKey } = await import('@solana/web3.js');
      const pubkey = new PublicKey(walletAddress); // This will throw if invalid
      console.log('✅ [Topup] Wallet address validated:', pubkey.toBase58());
    } catch (error) {
      console.error('❌ [Topup] Invalid wallet address:', {
        address: walletAddress,
        addressType: typeof walletAddress,
        addressLength: walletAddress?.length,
        error: error instanceof Error ? error.message : String(error)
      });
      return res.status(400).json({
        error: 'Invalid wallet address',
        message: `Wallet address "${walletAddress}" is not a valid Solana address: ${error instanceof Error ? error.message : String(error)}`
      });
    }
    
    // Log top-up start
    gasTelemetry.topupStart(walletAddress);
    
    // Client should send the base64-encoded x402 payment payload
    // The client constructs the full x402 payment payload (including signed transaction and public key)
    // Backend just proxies it to the gateway
    const { payment } = req.body;
    
    if (!payment) {
      return res.status(400).json({
        error: 'Payment payload required',
        message: 'Client must provide the base64-encoded x402 payment payload in the request body.'
      });
    }
    
    console.log('📦 [Topup] Submitting payment to gateway (base64 length:', payment.length, ')...');
    
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


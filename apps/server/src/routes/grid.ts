/**
 * Grid Proxy Endpoints
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * STATELESS GRID AUTHENTICATION PATTERN
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This implementation uses the STATELESS FLOW HINT pattern for Grid authentication,
 * eliminating the need for server-side state tracking or database dependencies.
 *
 * 🔑 KEY PRINCIPLES
 * ────────────────
 * 1. **Stateless Detection**: Grid API is the source of truth, not our database
 * 2. **Flow Hint Passing**: Client passes `isExistingUser` hint between phases
 * 3. **Automatic Retry**: 3 retries with 1s delay for new user creation
 * 4. **Bidirectional Fallback**: Both flows try alternate method if primary fails
 *
 * 📋 TWO-PHASE FLOW
 * ────────────────
 *
 * Phase 1: START SIGN-IN (Send OTP)
 * ─────────────────────────────────
 * - Try createAccount() first (optimistic for new users)
 * - If "already exists" error → fallback to initAuth()
 * - Return { user, isExistingUser } to client
 * - NO DATABASE LOOKUP REQUIRED
 *
 * Phase 2: COMPLETE SIGN-IN (Verify OTP)
 * ──────────────────────────────────────
 * - Read isExistingUser hint from request body
 * - If true → completeAuth() + fallback to completeAuthAndCreateAccount()
 * - If false → completeAuthAndCreateAccount() (3 retries) + fallback to completeAuth()
 * - Sync Grid address to database after success
 *
 * 🔄 RETRY & FALLBACK LOGIC
 * ────────────────────────
 * - New users: 3 retries with 1s delay (handles rate limiting)
 * - Wrong hint: Bidirectional fallback tries alternate method
 * - Grid API validates all operations (hint is just optimization)
 *
 * 🎯 BENEFITS
 * ──────────
 * ✅ No server-side state management
 * ✅ No Supabase app_metadata dependency
 * ✅ Works in all environments (dev, test, prod)
 * ✅ Handles rate limiting gracefully
 * ✅ Robust against corrupted hints
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Router, type Request, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser } from '../middleware/auth';
import { createGridClient } from '../lib/gridClient';

const router: Router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

// Initialize Supabase admin client (only used for database sync, not auth tracking)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/grid/start-sign-in
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ENDPOINT: Start Grid Sign-In (Send OTP) - STATELESS PATTERN
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This endpoint initiates the Grid sign-in process using the STATELESS FLOW HINT
 * pattern. It automatically detects whether a user is new or returning by attempting
 * createAccount() first, then falling back to initAuth() if the account exists.
 *
 * STATELESS DETECTION LOGIC:
 * ─────────────────────────
 * 1. Always try createAccount() first (optimistic path for new users)
 * 2. If account already exists, catch error and fallback to initAuth()
 * 3. Return isExistingUser flag to guide completion flow
 * 4. NO DATABASE LOOKUP REQUIRED - Grid API is the source of truth
 *
 * NEW USER FLOW:
 * ─────────────
 * - API Call: gridClient.createAccount({ email })
 * - Result: Success → OTP sent
 * - Returns: { user, isExistingUser: false }
 *
 * EXISTING USER FLOW:
 * ──────────────────
 * - API Call: gridClient.createAccount({ email })
 * - Result: Error "account already exists"
 * - Fallback: gridClient.initAuth({ email })
 * - Result: Success → OTP sent
 * - Returns: { user, isExistingUser: true }
 *
 * FLOW HINT PATTERN:
 * ────────────────
 * The isExistingUser flag is a HINT passed from start → complete phase.
 * - Client stores this hint (sessionStorage on web)
 * - Client passes hint to complete-sign-in endpoint
 * - Backend uses hint to choose correct API method
 * - Bidirectional fallback handles wrong hints gracefully
 *
 * REQUEST:
 * ───────
 * Body: { email: string }
 * Headers: Authorization: Bearer <token>
 *
 * RESPONSE:
 * ────────
 * Success (200): {
 *   success: true,
 *   user: <Grid user object>,
 *   isExistingUser: boolean
 * }
 * Error (400/500): { success: false, error: string }
 * ═══════════════════════════════════════════════════════════════════════════════
 */
router.post('/start-sign-in', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  // Create fresh GridClient instance for this request (GridClient is stateful)
  const gridClient = createGridClient();
  
  try {
    const { email } = req.body;
    const userId = req.user!.id;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    console.log('🔐 [Grid Init] Starting sign-in (stateless pattern) for user:', userId);

    let response;
    let isExistingUser = false;

    // STEP 1: Always try createAccount() first (optimistic approach for new users)
    console.log('🆕 [Grid Init] Attempting createAccount() (optimistic path)');

    try {
      response = await gridClient.createAccount({ email });

      console.log('🔍 [Grid Init] createAccount response:', {
        success: response.success,
        hasData: !!response.data,
        hasError: !!response.error
      });

      // If createAccount succeeds, this is a NEW user
      if (response.success && response.data) {
        isExistingUser = false;
        console.log('✅ [Grid Init] New user detected - createAccount() succeeded');
      }

    } catch (error: any) {
      // STEP 2: If createAccount() fails, check if it's because account already exists
      const errorStatus = error?.response?.status || error?.status;
      const errorMessage = error?.message || '';

      console.log('🔍 [Grid Init] createAccount failed:', {
        status: errorStatus,
        message: errorMessage
      });

      // Check for existing account error
      const isExistingAccount =
        errorStatus === 400 ||
        errorMessage.includes('grid_account_already_exists_for_user') ||
        errorMessage.includes('Email associated with grid account already exists');

      if (isExistingAccount) {
        // STEP 3: Account exists - fallback to initAuth()
        console.log('🔄 [Grid Init] Account exists - falling back to initAuth()');
        response = await gridClient.initAuth({ email });
        isExistingUser = true;

        console.log('✅ [Grid Init] Existing user authenticated via initAuth()');
      } else {
        // Some other error - re-throw
        console.error('❌ [Grid Init] Unexpected error:', {
          status: errorStatus,
          message: errorMessage
        });
        throw error;
      }
    }

    // Handle case where Grid returns success: false instead of throwing
    if (!response.success && response.error) {
      const errorMessage = response.error;

      const isExistingAccount =
        errorMessage.includes('grid_account_already_exists_for_user') ||
        errorMessage.includes('Email associated with grid account already exists');

      if (isExistingAccount) {
        console.log('🔄 [Grid Init] Response indicates existing account - falling back to initAuth()');
        response = await gridClient.initAuth({ email });
        isExistingUser = true;
        console.log('✅ [Grid Init] Existing user authenticated via initAuth()');
      }
    }

    if (!response.success || !response.data) {
      return res.status(400).json({
        success: false,
        error: response.error || 'Failed to initialize Grid account'
      });
    }

    // Return Grid user object + flow hint for complete-sign-in
    res.json({
      success: true,
      user: response.data,
      isExistingUser // Flow hint: false for new users, true for existing
    });

  } catch (error) {
    console.error('❌ [Grid Init] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/grid/complete-sign-in
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ENDPOINT: Complete Grid Sign-In (Verify OTP) - WITH RETRY & BIDIRECTIONAL FALLBACK
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This endpoint completes the Grid sign-in process using the FLOW HINT from
 * start-sign-in, with retry logic for rate limiting and bidirectional fallback
 * for wrong hints.
 *
 * FLOW HINT LOGIC:
 * ───────────────
 * 1. Read isExistingUser hint from request body
 * 2. If true → Try completeAuth() (existing user path)
 * 3. If false → Try completeAuthAndCreateAccount() with retries (new user path)
 * 4. If primary method fails → Fallback to alternate method
 *
 * EXISTING USER FLOW (isExistingUser = true):
 * ──────────────────────────────────────────
 * Primary: completeAuth()
 * - Single attempt (no retry needed for existing users)
 * - Fallback: If fails, try completeAuthAndCreateAccount()
 * - Why: Handles case where hint was wrong (corrupted sessionStorage, etc.)
 *
 * NEW USER FLOW (isExistingUser = false):
 * ──────────────────────────────────────
 * Primary: completeAuthAndCreateAccount()
 * - 3 retry attempts with 1s delay (handles rate limiting)
 * - Fallback: After 3 failures, try completeAuth()
 * - Why: New account creation more prone to rate limiting
 *
 * BIDIRECTIONAL FALLBACK:
 * ──────────────────────
 * Grid API is the source of truth, not the client hint.
 * - Hint says "existing" but user is new → completeAuth() fails → completeAuthAndCreateAccount() succeeds
 * - Hint says "new" but user exists → completeAuthAndCreateAccount() fails 3x → completeAuth() succeeds
 * - Wrong OTP → Both methods fail → Return error (expected)
 *
 * REQUEST:
 * ───────
 * Body: {
 *   user: <Grid user object from start-sign-in>,
 *   otpCode: string (6-digit code),
 *   sessionSecrets: object (client-generated),
 *   isExistingUser: boolean (flow hint)
 * }
 * Headers: Authorization: Bearer <token>
 *
 * RESPONSE:
 * ────────
 * Success (200): { success: true, data: <Grid account with authentication> }
 * Error (400/500): { success: false, error: string }
 * ═══════════════════════════════════════════════════════════════════════════════
 */
router.post('/complete-sign-in', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  // Create fresh GridClient instance for this request (GridClient is stateful)
  const gridClient = createGridClient();
  
  try {
    const { user, otpCode, sessionSecrets, isExistingUser } = req.body;
    const userId = req.user!.id;

    if (!user || !otpCode || !sessionSecrets) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: user, otpCode, sessionSecrets'
      });
    }

    console.log('🔐 [Grid Verify] Starting OTP verification for user:', userId);
    console.log(`🔐 [Grid Verify] Flow hint: ${isExistingUser ? 'EXISTING USER ✅' : 'NEW USER 🆕'}`);

    let authResult: any = { success: false, error: 'Unknown error' };

    if (isExistingUser) {
      // ═══════════════════════════════════════════════════════════════════════════
      // EXISTING USER FLOW (with fallback)
      // ═══════════════════════════════════════════════════════════════════════════
      console.log('🔄 [Grid Verify] Existing user flow: completeAuth()');

      try {
        console.log('[Grid Verify] completeAuth request:', {
          user,
          otpCode,
          sessionSecrets
        });

        // Primary: Try completeAuth for existing user
        authResult = await gridClient.completeAuth({
          user,
          otpCode,
          sessionSecrets
        });

        console.log('🔍 [Grid Verify] completeAuth result:', {
          success: authResult.success,
          hasData: !!authResult.data
        });

        // Fallback: If completeAuth fails, try completeAuthAndCreateAccount
        // (Handles case where isExistingUser flag was wrong)
        if (!authResult.success || !authResult.data) {
          console.log('⚠️ [Grid Verify] completeAuth failed - trying fallback to completeAuthAndCreateAccount');
          authResult = await gridClient.completeAuthAndCreateAccount({
            user,
            otpCode,
            sessionSecrets
          });

          if (authResult.success && authResult.data) {
            console.log('✅ [Grid Verify] Fallback succeeded - user was actually new');
          }
        }
      } catch (error) {
        // Exception fallback
        console.log('⚠️ [Grid Verify] completeAuth threw exception - trying fallback');
        authResult = await gridClient.completeAuthAndCreateAccount({
          user,
          otpCode,
          sessionSecrets
        });
      }

    } else {
      // ═══════════════════════════════════════════════════════════════════════════
      // NEW USER FLOW (with retry + fallback)
      // ═══════════════════════════════════════════════════════════════════════════
      console.log('🆕 [Grid Verify] New user flow: completeAuthAndCreateAccount() with retry');
      console.log('🆕 [Grid Verify] User:', user);

      const maxRetries = 3;
      const retryDelay = 1000; // 1 second

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`🔄 [Grid Verify] Attempt ${attempt}/${maxRetries}`);

        console.log('[Grid Verify] completeAuthAndCreateAccount request:', {
          user,
          otpCode,
          sessionSecrets
        });

        authResult = await gridClient.completeAuthAndCreateAccount({
          user,
          otpCode,
          sessionSecrets
        });

        console.log(`🔍 [Grid Verify] Attempt ${attempt} result:`, {
          success: authResult.success,
          hasData: !!authResult.data,
          error: authResult.error
        });

        // Success? Break out of retry loop
        if (authResult.success && authResult.data) {
          console.log(`✅ [Grid Verify] completeAuthAndCreateAccount succeeded on attempt ${attempt}`);
          break;
        }

        // Failed? Wait and retry (unless last attempt)
        if (attempt < maxRetries) {
          console.log(`⚠️ [Grid Verify] Attempt ${attempt} failed - retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          // Final fallback: Try completeAuth in case isExistingUser was wrong
          console.log('⚠️ [Grid Verify] All retries exhausted - trying fallback to completeAuth');
          try {
            const fallbackResult = await gridClient.completeAuth({
              user,
              otpCode,
              sessionSecrets
            });

            if (fallbackResult.success && fallbackResult.data) {
              authResult = fallbackResult;
              console.log('✅ [Grid Verify] Fallback succeeded - user was actually existing');
            }
          } catch (fallbackError) {
            // Keep original error
            console.log('❌ [Grid Verify] Fallback also failed - keeping original error');
          }
        }
      }
    }

    console.log('🔐 [Grid Verify] Final result:', {
      success: authResult.success,
      hasData: !!authResult.data,
      address: authResult.data?.address
    });

    if (!authResult.success || !authResult.data) {
      return res.status(400).json({
        success: false,
        error: authResult.error || 'OTP verification failed'
      });
    }

    // STEP 2: Sync Grid address to database (with retry logic)
    const maxRetries = 3;
    let dbError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const { error } = await supabaseAdmin
        .from('users_grid')
        .upsert({
          id: userId,
          solana_wallet_address: authResult.data.address,
          account_type: 'email',
          grid_account_status: 'active',
          updated_at: new Date().toISOString()
        });

      if (!error) {
        console.log('✅ Grid address synced to database:', authResult.data.address);
        dbError = null;
        break;
      }

      dbError = error;
      console.error(`⚠️ Database sync attempt ${attempt} failed:`, error.message);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
      }
    }

    if (dbError) {
      console.error('❌ Failed to sync Grid address after all retries');
      return res.status(500).json({
        success: false,
        error: 'Grid account created but database sync failed. Please try logging in again.'
      });
    }

    // Return Grid account data
    res.json({
      success: true,
      data: authResult.data
    });

  } catch (error) {
    console.error('❌ [Grid Verify] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/grid/send-tokens
 * 
 * Proxy for Grid token transfers - builds Solana transaction and signs via Grid SDK
 * Avoids CORS issues by running all Grid SDK calls server-side
 * 
 * Body: { 
 *   recipient: string, 
 *   amount: string, 
 *   tokenMint?: string,
 *   sessionSecrets: object,
 *   session: object,
 *   address: string
 * }
 * Returns: { success: boolean, signature?: string, error?: string }
 */
router.post('/send-tokens', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  // Create fresh GridClient instance for this request (GridClient is stateful)
  const gridClient = createGridClient();
  
  try {
    const { recipient, amount, tokenMint, sessionSecrets, session, address } = req.body;
    
    if (!recipient || !amount || !sessionSecrets || !session || !address) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: recipient, amount, sessionSecrets, session, address' 
      });
    }
    
    console.log('💸 [Grid Proxy] Sending tokens:', { recipient, amount, tokenMint: tokenMint || 'SOL' });
    
    // Import Solana dependencies
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
      process.env.SOLANA_RPC_URL || process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );

    console.log('   Building Solana transaction...');

    // Build Solana transaction instructions
    const instructions = [];
    
    if (tokenMint) {
      // SPL Token transfer (with allowOwnerOffCurve for PDA wallets)
      const fromTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(tokenMint),
        new PublicKey(address),
        true  // allowOwnerOffCurve = true for Grid PDA wallets
      );
      
      const toTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(tokenMint),
        new PublicKey(recipient),
        false  // Regular wallet recipient
      );

      // Check if recipient's ATA exists, if not, create it
      const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
      
      if (!toAccountInfo) {
        console.log('   Creating ATA for recipient...');
        const createAtaIx = createAssociatedTokenAccountInstruction(
          new PublicKey(address), // payer
          toTokenAccount,          // ata
          new PublicKey(recipient), // owner
          new PublicKey(tokenMint), // mint
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        instructions.push(createAtaIx);
      }

      const amountInSmallestUnit = Math.floor(parseFloat(amount) * 1000000); // USDC has 6 decimals

      const transferIx = createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        new PublicKey(address),
        amountInSmallestUnit,
        [],
        TOKEN_PROGRAM_ID
      );
      instructions.push(transferIx);
    } else {
      // SOL transfer
      const amountInLamports = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);
      
      const transferIx = SystemProgram.transfer({
        fromPubkey: new PublicKey(address),
        toPubkey: new PublicKey(recipient),
        lamports: amountInLamports
      });
      instructions.push(transferIx);
    }

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash('confirmed');

    // Build transaction message
    const message = new TransactionMessage({
      payerKey: new PublicKey(address),
      recentBlockhash: blockhash,
      instructions
    }).compileToV0Message();

    const transaction = new VersionedTransaction(message);
    const serialized = Buffer.from(transaction.serialize()).toString('base64');

    console.log('   Preparing arbitrary transaction via Grid...');

    // Prepare transaction via Grid SDK (with fee config)
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

    console.log('   Grid prepareArbitraryTransaction response:', transactionPayload);

    if (!transactionPayload || !transactionPayload.data) {
      console.error('❌ Invalid response from prepareArbitraryTransaction:', transactionPayload);
      return res.status(500).json({
        success: false,
        error: 'Failed to prepare transaction - Grid returned no data'
      });
    }

    console.log('   Signing and sending...');

    // Sign and send using Grid SDK
    const result = await gridClient.signAndSend({
      sessionSecrets,
      session,
      transactionPayload: transactionPayload.data,
      address
    });

    console.log('✅ [Grid Proxy] Tokens sent via Grid');
    
    // Extract signature (Grid returns transaction_signature)
    const signature = result.transaction_signature || 'success';
    
    console.log('   Transaction signature:', signature);
    
    res.json({
      success: true,
      signature
    });
    
  } catch (error) {
    console.error('❌ [Grid Proxy] Send tokens error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

export default router;


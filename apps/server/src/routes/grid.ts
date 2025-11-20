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
      
      // Log the FULL response data to see what Grid is actually returning
      if (response.data) {
        console.log('🔍 [Grid Init] createAccount FULL response.data:', JSON.stringify(response.data, null, 2));
      }

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
        try {
          console.log('🔍 [Grid Init] initAuth response:', JSON.stringify({
            success: response?.success,
            hasData: !!response?.data,
            hasError: !!response?.error,
            responseType: typeof response
          }));
        } catch (e) {
          console.log('⚠️ [Grid Init] Failed to log initAuth response:', e);
        }
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
        console.log('🔑 [Grid Init] CHECKPOINT 1: initAuth() returned');
        isExistingUser = true;
        console.log('🔑 [Grid Init] CHECKPOINT 2: isExistingUser set to true');
        console.log('✅ [Grid Init] Existing user authenticated via initAuth()');
        console.log('🔑 [Grid Init] CHECKPOINT 3: About to log response');
        try {
          console.log('🔍 [Grid Init] initAuth response:', JSON.stringify({
            success: response?.success,
            hasData: !!response?.data,
            hasError: !!response?.error,
            responseType: typeof response
          }));
        } catch (e) {
          console.log('⚠️ [Grid Init] Failed to log initAuth response:', e);
        }
        console.log('🔑 [Grid Init] CHECKPOINT 4: Finished logging block');
      }
    }

    if (!response.success || !response.data) {
      console.log('❌ [Grid Init] Response validation failed:', {
        success: response.success,
        hasData: !!response.data,
        isExistingUser
      });
      return res.status(400).json({
        success: false,
        error: response.error || 'Failed to initialize Grid account'
      });
    }

    console.log('✅ [Grid Init] Returning success response with isExistingUser:', isExistingUser);
    console.log('🔍 [Grid Init] User object being returned:', JSON.stringify(response.data, null, 2));
    
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

        console.log('🔍 [Grid Verify] EXACT PARAMS BEING SENT TO GRID:');
        console.log('   Email:', user.email);
        console.log('   OTP Code:', otpCode);
        console.log('   OTP Type:', typeof otpCode);
        console.log('   OTP Length:', otpCode.length);
        console.log('   User Status:', user.status);
        console.log('   User Type:', user.type);
        console.log('   User has provider?:', !!user.provider);
        console.log('   User has otp_id?:', !!user.otp_id);

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

    // Return Grid account data
    // Note: Client stores this in secure storage, no database sync needed
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
 * POST /api/grid/sign-transaction
 * 
 * Sign a transaction using Grid SDK (for x402 payments)
 * Returns the signed transaction without submitting it
 * 
 * Body: { 
 *   transaction: string (base64),
 *   sessionSecrets: object,
 *   session: object,
 *   address: string
 * }
 * Returns: { success: boolean, signedTransaction?: string, error?: string }
 */
router.post('/sign-transaction', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  const gridClient = createGridClient();
  
  try {
    const { transaction, sessionSecrets, session, address } = req.body;
    
    if (!transaction || !sessionSecrets || !session || !address) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: transaction, sessionSecrets, session, address' 
      });
    }
    
    console.log('✍️ [Grid Proxy] Signing transaction for x402 payment (not submitting)');
    
    // For x402 payments, we need to SIGN the transaction but NOT submit it
    // The x402 gateway will handle submission and verification
    // Use Grid's sign() method (not signAndSend) to get signed transaction without submitting
    
    // Validate and normalize the transaction first
    // Grid's prepareArbitraryTransaction expects a properly formatted base64 transaction
    let normalizedTransaction = transaction;
    try {
      // Deserialize and re-serialize to ensure proper format
      const { VersionedTransaction, PublicKey } = await import('@solana/web3.js');
      const txBuffer = Buffer.from(transaction, 'base64');
      const deserializedTx = VersionedTransaction.deserialize(txBuffer);
      
      // Verify the transaction payer matches the Grid wallet address
      const message = deserializedTx.message;
      const transactionPayer = new PublicKey(message.staticAccountKeys[0]).toBase58();
      const gridAddressBase58 = new PublicKey(address).toBase58();
      
      console.log('🔍 [Grid Proxy] Transaction validation:', {
        transactionPayer,
        gridAddress: gridAddressBase58,
        payerMatches: transactionPayer === gridAddressBase58,
        numSignatures: deserializedTx.signatures?.length || 0,
        numInstructions: message.compiledInstructions?.length || 0,
      });
      
      // Verify the transaction is unsigned (no signatures)
      if (deserializedTx.signatures && deserializedTx.signatures.length > 0) {
        const hasNonZeroSignatures = deserializedTx.signatures.some(sig => 
          sig.some(byte => byte !== 0)
        );
        if (hasNonZeroSignatures) {
          console.warn('⚠️ [Grid Proxy] Transaction appears to already have signatures');
        }
      }
      
      // Warn if payer doesn't match (but continue - Grid might handle it)
      if (transactionPayer !== gridAddressBase58) {
        console.warn('⚠️ [Grid Proxy] Transaction payer does not match Grid address:', {
          transactionPayer,
          gridAddress: gridAddressBase58,
        });
      }
      
      // Re-serialize to ensure proper format
      normalizedTransaction = Buffer.from(deserializedTx.serialize()).toString('base64');
      
      console.log('✅ [Grid Proxy] Transaction validated and normalized');
    } catch (validateError: any) {
      console.error('❌ [Grid Proxy] Failed to validate transaction:', {
        error: validateError.message,
        transactionLength: transaction.length,
        stack: validateError.stack?.substring(0, 300),
      });
      return res.status(400).json({
        success: false,
        error: `Invalid transaction format: ${validateError.message || 'Failed to deserialize transaction'}`,
      });
    }
    
    // Prepare transaction with Grid
    // For x402 payments, we let Grid handle the fee payer (user's Grid wallet)
    // The gateway will verify the USDC transfer, regardless of who paid fees
    console.log('🔧 [Grid Proxy] Preparing transaction with Grid:', {
      address,
      transactionLength: normalizedTransaction.length,
      hasFeeConfig: true,
    });
    
    let transactionPayload;
    try {
      transactionPayload = await gridClient.prepareArbitraryTransaction(
      address,
      {
          transaction: normalizedTransaction,
        fee_config: {
          currency: 'sol',
          payer_address: address, // Use Grid wallet as fee payer (Grid can sign this)
          self_managed_fees: false, // Let Grid handle fees
        }
      }
    );
      
      console.log('📋 [Grid Proxy] Grid prepareArbitraryTransaction response:', {
        hasData: !!transactionPayload?.data,
        hasError: !!transactionPayload?.error,
        responseKeys: transactionPayload ? Object.keys(transactionPayload) : [],
        errorMessage: transactionPayload?.error?.message || transactionPayload?.error,
        errorCode: transactionPayload?.error?.code,
        fullResponse: JSON.stringify(transactionPayload).substring(0, 500),
      });
      
      // Check if Grid returned an error in the response
      if (transactionPayload?.error) {
        const gridError = transactionPayload.error;
        const errorMessage = gridError?.message || gridError || 'Unknown Grid error';
        
        console.error('❌ [Grid Proxy] Grid returned error in response:', {
          error: gridError,
          message: errorMessage,
          code: gridError?.code,
          details: gridError?.details,
        });
        
        // Provide more helpful error messages for common cases
        let userFriendlyError = errorMessage;
        if (errorMessage.toLowerCase().includes('simulation failed') || 
            errorMessage.toLowerCase().includes('insufficient') ||
            errorMessage.toLowerCase().includes('balance')) {
          userFriendlyError = 'Transaction simulation failed. This usually means the wallet does not have sufficient USDC balance or the token account does not exist. Please ensure you have USDC in your Grid wallet before attempting a top-up.';
        }
        
        return res.status(500).json({
          success: false,
          error: `Grid prepareArbitraryTransaction failed: ${userFriendlyError}`,
          details: gridError?.details,
          code: gridError?.code,
          gridError: gridError,
        });
      }
    } catch (prepareError: any) {
      console.error('❌ [Grid Proxy] Grid prepareArbitraryTransaction threw error:', {
        error: prepareError.message,
        code: prepareError.code,
        details: prepareError.details,
        name: prepareError.name,
        stack: prepareError.stack?.substring(0, 500),
      });
      return res.status(500).json({
        success: false,
        error: `Grid prepareArbitraryTransaction failed: ${prepareError.message || 'Unknown error'}`,
        details: prepareError.details,
        code: prepareError.code,
        name: prepareError.name,
      });
    }
    
    if (!transactionPayload || !transactionPayload.data) {
      console.error('❌ [Grid Proxy] Grid returned invalid response:', {
        transactionPayload,
        hasData: !!transactionPayload?.data,
        hasError: !!transactionPayload?.error,
        errorMessage: transactionPayload?.error?.message || transactionPayload?.error,
        responseType: typeof transactionPayload,
        responseString: JSON.stringify(transactionPayload).substring(0, 500),
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to prepare transaction with Grid',
        details: transactionPayload?.error?.message || transactionPayload?.error || 'Grid returned no data',
        gridError: transactionPayload?.error,
        gridResponse: transactionPayload,
      });
    }
    
    // For x402 payments, we need to sign the transaction with Grid SDK
    // Grid wallets are PDAs and require Grid's SDK to sign
    // Grid SDK only provides signAndSend() which submits the transaction
    // 
    // According to the x402 gateway spec (https://gist.github.com/carlos-sqds/44bc364a8f3cedd329f3ddbbc1d00d06):
    // - The gateway verifies the transaction on-chain
    // - The transaction can be submitted before sending to gateway
    // - The gateway checks if the transaction exists on-chain and verifies it
    //
    // SOLUTION: Use Grid's signAndSend to sign and submit the transaction
    // Then fetch the signed transaction from the network using the signature
    // This allows us to get the signed transaction bytes for the x402 payment
    
    console.log('🔐 [Grid Proxy] Using Grid SDK to sign transaction (will submit to Solana)...');
    console.log('📝 [Grid Proxy] Note: For x402 payments, gateway will verify transaction on-chain');
    
    // Log session structure for debugging
    console.log('🔍 [Grid Proxy] Session data structure:', {
      hasSessionSecrets: !!sessionSecrets,
      sessionSecretsType: typeof sessionSecrets,
      sessionSecretsIsArray: Array.isArray(sessionSecrets),
      sessionSecretsKeys: sessionSecrets && typeof sessionSecrets === 'object' && !Array.isArray(sessionSecrets) ? Object.keys(sessionSecrets) : [],
      sessionSecretsLength: Array.isArray(sessionSecrets) ? sessionSecrets.length : undefined,
      hasSession: !!session,
      sessionType: typeof session,
      sessionIsArray: Array.isArray(session),
      sessionKeys: session && typeof session === 'object' && !Array.isArray(session) ? Object.keys(session) : [],
      sessionLength: Array.isArray(session) ? session.length : undefined,
      address
    });
    
    // Validate session structure matches what Grid SDK expects
    // Grid SDK expects session to be the authentication object (array or object)
    // and sessionSecrets to be the secrets array
    if (!sessionSecrets) {
      return res.status(400).json({
        success: false,
        error: 'Missing sessionSecrets: required for Grid SDK signing'
      });
    }
    
    if (typeof sessionSecrets !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid sessionSecrets: must be an object or array, got ' + typeof sessionSecrets
      });
    }
    
    if (!session) {
      return res.status(400).json({
        success: false,
        error: 'Missing session: required for Grid SDK signing (should be account.authentication)'
      });
    }
    
    if (typeof session !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid session: must be an object or array (authentication), got ' + typeof session
      });
    }
    
    // Handle case where authentication is an array (new Grid format)
    // Grid SDK might need the session extracted from the array
    // Based on other working code (send-tokens, gasAbstraction), Grid SDK accepts the array directly
    // But we'll try both formats to be safe
    let normalizedSession = session;
    if (Array.isArray(session) && session.length > 0) {
      console.log('📋 [Grid Proxy] Session is array, will try both formats...');
      const firstAuth = session[0];
      // If the array entry has a nested session object, extract it for normalized format
      if (firstAuth?.session && typeof firstAuth.session === 'object') {
        normalizedSession = firstAuth.session;
        console.log('✅ [Grid Proxy] Normalized session: extracted from array entry.session');
      } else {
        // Otherwise use the first entry itself
        normalizedSession = firstAuth;
        console.log('✅ [Grid Proxy] Normalized session: using first array entry');
      }
    }
    
    // Log session structure for debugging
    console.log('🔍 [Grid Proxy] Session formats to try:', {
      original: {
        type: Array.isArray(session) ? 'array' : typeof session,
        length: Array.isArray(session) ? session.length : undefined,
        firstEntryKeys: Array.isArray(session) && session[0] ? Object.keys(session[0]) : undefined
      },
      normalized: {
        type: typeof normalizedSession,
        keys: normalizedSession && typeof normalizedSession === 'object' && !Array.isArray(normalizedSession) ? Object.keys(normalizedSession) : undefined
      }
    });
    
    // Check if sessionSecrets is an array (Grid SDK format)
    // Grid SDK expects sessionSecrets to be an array of provider entries
    if (Array.isArray(sessionSecrets)) {
      const solanaEntry = sessionSecrets.find((entry: any) => 
        entry?.provider === 'solana' || entry?.tag === 'solana'
      );
      if (!solanaEntry) {
        console.warn('⚠️ [Grid Proxy] No Solana provider entry found in sessionSecrets array');
      } else if (!solanaEntry.privateKey) {
        console.warn('⚠️ [Grid Proxy] Solana entry found but missing privateKey');
      } else {
        console.log('✅ [Grid Proxy] Found Solana entry in sessionSecrets');
      }
    }
    
    // Try both session formats - Grid SDK might accept either
    // First try with normalized session (extracted from array)
    // If that fails, try with original session (full array)
    try {
      let result;
      let lastError: any = null;
      
      // Try original format first (as used in send-tokens and other working code)
      // Then try normalized if that fails
      const sessionFormats = [
        { name: 'original', session: session }, // Try original array format first
        { name: 'normalized', session: normalizedSession },
      ];
      
      for (const format of sessionFormats) {
        try {
          console.log(`🔐 [Grid Proxy] Trying signAndSend with ${format.name} session format...`);
          console.log('   Session type:', typeof format.session, Array.isArray(format.session) ? 'array' : 'object');
          console.log('   Session keys:', format.session && typeof format.session === 'object' && !Array.isArray(format.session) ? Object.keys(format.session) : 'N/A');
          
          result = await gridClient.signAndSend({
        sessionSecrets,
            session: format.session,
        transactionPayload: transactionPayload.data,
        address
      });
          
          console.log(`✅ [Grid Proxy] signAndSend succeeded with ${format.name} session format`);
          break; // Success, exit loop
        } catch (formatError: any) {
          console.warn(`⚠️ [Grid Proxy] ${format.name} session format failed:`, formatError.message);
          lastError = formatError;
          continue; // Try next format
        }
      }
      
      if (!result) {
        // All formats failed
        throw lastError || new Error('All session formats failed');
      }
      
      if (!result || !result.transaction_signature) {
        return res.status(500).json({
          success: false,
          error: 'Grid signAndSend did not return transaction signature'
        });
      }
      
      const signature = result.transaction_signature;
      console.log('✅ [Grid Proxy] Transaction signed and submitted, signature:', signature);
      
      // Fetch the signed transaction from Solana network
      // The gateway needs the full signed transaction bytes, not just the signature
      const { Connection } = await import('@solana/web3.js');
      // Prioritize Alchemy RPC for faster responses
      const rpcUrlForConnection = process.env.SOLANA_RPC_ALCHEMY_1 || 
                                  process.env.SOLANA_RPC_ALCHEMY_2 || 
                                  process.env.SOLANA_RPC_ALCHEMY_3 ||
                                  process.env.SOLANA_RPC_URL || 
                                  process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 
                                  'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcUrlForConnection, 'confirmed');
      console.log(`🔗 [Grid Proxy] Using RPC for connection: ${rpcUrlForConnection.substring(0, 50)}...`);
      
      console.log('📥 [Grid Proxy] Fetching signed transaction from Solana network...');
      
      // Get the transaction from the network
      // Note: getTransaction may return null if transaction is not yet confirmed
      // According to x402 gateway spec, the gateway verifies transactions on-chain
      // So we MUST wait for confirmation before returning the transaction
      // The gateway will verify the transaction exists and matches the payment payload
      // IMPORTANT: We need the EXACT transaction bytes that are on-chain
      // Using direct RPC call to get raw base64 transaction bytes
      let confirmedTx = null;
      let rawTransactionBase64: string | null = null;
      const maxRetries = 15; // Increased retries for mainnet (up to 30 seconds)
      const retryDelay = 2000; // 2 seconds
      
      console.log(`⏳ [Grid Proxy] Waiting for transaction confirmation (up to ${maxRetries * retryDelay / 1000}s)...`);
      console.log(`   Signature: ${signature}`);
      
      // Get RPC URL (prioritize Alchemy, same one used to create connection)
      const rpcUrl = process.env.SOLANA_RPC_ALCHEMY_1 || 
                    process.env.SOLANA_RPC_ALCHEMY_2 || 
                    process.env.SOLANA_RPC_ALCHEMY_3 ||
                    process.env.SOLANA_RPC_URL || 
                    process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 
                    'https://api.mainnet-beta.solana.com';
      console.log(`🔗 [Grid Proxy] Using RPC for direct call: ${rpcUrl.substring(0, 50)}...`);
      
      let useBase64Encoding = true; // Prefer raw bytes for exact match
      for (let i = 0; i < maxRetries; i++) {
        // First try to get raw transaction bytes (base64 encoding)
        // This gives us the exact bytes that are on-chain
        if (useBase64Encoding) {
          try {
            // Try direct RPC call to get raw base64 transaction bytes
            // This bypasses web3.js parsing and gives us exact on-chain bytes
            console.log(`🔍 [Grid Proxy] Attempting direct RPC call for raw bytes (attempt ${i + 1})...`);
            const rpcResponse = await fetch(rpcUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getTransaction',
                params: [
                  signature,
                  {
                    encoding: 'base64',
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed'
                  }
                ]
              })
            });
            
            if (!rpcResponse.ok) {
              throw new Error(`RPC returned ${rpcResponse.status}: ${rpcResponse.statusText}`);
            }
            
            const rpcData = await rpcResponse.json();
            
            console.log(`🔍 [Grid Proxy] RPC response:`, {
              hasResult: !!rpcData.result,
              hasTransaction: !!rpcData.result?.transaction,
              transactionType: typeof rpcData.result?.transaction,
              transactionKeys: rpcData.result?.transaction ? Object.keys(rpcData.result.transaction) : [],
              error: rpcData.error,
            });
            
            if (rpcData.error) {
              throw new Error(`RPC error: ${JSON.stringify(rpcData.error)}`);
            }
            
            if (rpcData.result && rpcData.result.transaction) {
              // When encoding is 'base64', RPC returns transaction as:
              // - String: direct base64 string (some RPCs)
              // - Object: { transaction: [base64 string], meta: {...} } (other RPCs)
              // - Array: [base64 string] (some formats)
              
              let transactionBase64: string | null = null;
              
              if (typeof rpcData.result.transaction === 'string') {
                // Direct base64 string
                transactionBase64 = rpcData.result.transaction;
              } else if (Array.isArray(rpcData.result.transaction) && rpcData.result.transaction.length > 0) {
                // Array format: [base64 string]
                transactionBase64 = rpcData.result.transaction[0];
              } else if (typeof rpcData.result.transaction === 'object') {
                // Object format: check common fields
                if (rpcData.result.transaction.transaction) {
                  transactionBase64 = rpcData.result.transaction.transaction;
                } else if (rpcData.result.transaction[0]) {
                  transactionBase64 = rpcData.result.transaction[0];
                } else {
                  // Try to find any string field that looks like base64
                  for (const key in rpcData.result.transaction) {
                    if (typeof rpcData.result.transaction[key] === 'string' && rpcData.result.transaction[key].length > 100) {
                      transactionBase64 = rpcData.result.transaction[key];
                      break;
                    }
                  }
                }
              }
              
              if (transactionBase64 && typeof transactionBase64 === 'string') {
                rawTransactionBase64 = transactionBase64;
                console.log(`✅ [Grid Proxy] Got raw transaction bytes from direct RPC call (attempt ${i + 1}/${maxRetries})`);
                console.log(`   Transaction length: ${rawTransactionBase64.length} bytes (base64)`);
                // Also get parsed version for confirmation check
                confirmedTx = await connection.getTransaction(signature, {
                  maxSupportedTransactionVersion: 0,
                  commitment: 'confirmed'
                });
                break;
              } else {
                console.log(`⚠️ [Grid Proxy] Could not extract base64 string from RPC response`);
                console.log(`   Transaction structure:`, JSON.stringify(rpcData.result.transaction).substring(0, 200));
              }
            } else if (rpcData.result === null) {
              console.log(`⏳ [Grid Proxy] Transaction not yet confirmed in RPC (attempt ${i + 1})`);
            }
          } catch (e) {
            console.log(`⚠️ [Grid Proxy] Direct RPC call failed:`, e instanceof Error ? e.message : String(e));
            console.log(`   Will try web3.js method as fallback`);
          }
        }
        
        // Fallback to web3.js getTransaction
        if (!rawTransactionBase64) {
          try {
            confirmedTx = await connection.getTransaction(signature, {
              maxSupportedTransactionVersion: 0,
              commitment: 'confirmed',
              encoding: useBase64Encoding ? 'base64' : undefined
            });
            
            if (confirmedTx && confirmedTx.transaction) {
              if (typeof confirmedTx.transaction === 'string') {
                rawTransactionBase64 = confirmedTx.transaction;
                console.log(`✅ [Grid Proxy] Got raw transaction from web3.js (attempt ${i + 1}/${maxRetries})`);
                break;
              } else {
                console.log(`✅ [Grid Proxy] Transaction confirmed on attempt ${i + 1}/${maxRetries} (parsed, will reconstruct)`);
                break;
              }
            }
          } catch (e) {
            console.log(`⚠️ [Grid Proxy] getTransaction failed:`, e instanceof Error ? e.message : String(e));
          }
        }
        
        // Fallback to parsed transaction if base64 failed or not available
        if (!useBase64Encoding || !confirmedTx || !confirmedTx.transaction) {
          confirmedTx = await connection.getTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
          });
          
          if (confirmedTx && confirmedTx.transaction) {
            console.log(`✅ [Grid Proxy] Transaction confirmed on attempt ${i + 1}/${maxRetries} (parsed)`);
            break;
          }
        }
        
        if (i < maxRetries - 1) {
          console.log(`⏳ [Grid Proxy] Transaction not yet confirmed (attempt ${i + 1}/${maxRetries}), waiting ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
      
      let signedTransaction: string;
      
      // Prefer raw transaction bytes from direct RPC call (exact on-chain bytes)
      if (rawTransactionBase64) {
        signedTransaction = rawTransactionBase64;
        console.log('✅ [Grid Proxy] Using raw transaction bytes from direct RPC call (exact on-chain bytes)');
        console.log(`   Transaction length: ${signedTransaction.length} bytes (base64)`);
      } else if (confirmedTx && confirmedTx.transaction) {
        // Fallback: check if web3.js returned raw bytes
        console.log('🔍 [Grid Proxy] Transaction type check:', {
          transactionType: typeof confirmedTx.transaction,
          isString: typeof confirmedTx.transaction === 'string',
          isObject: typeof confirmedTx.transaction === 'object',
          hasMessage: typeof confirmedTx.transaction === 'object' && 'message' in confirmedTx.transaction,
          hasSignatures: typeof confirmedTx.transaction === 'object' && 'signatures' in confirmedTx.transaction,
        });
        
        if (typeof confirmedTx.transaction === 'string') {
          // Raw base64-encoded transaction bytes from web3.js
          signedTransaction = confirmedTx.transaction;
          console.log('✅ [Grid Proxy] Using raw transaction bytes from web3.js (base64)');
          console.log(`   Transaction length: ${signedTransaction.length} bytes (base64)`);
        } else {
          // Fallback: reconstruct from parsed transaction
          const { VersionedTransaction, TransactionMessage } = await import('@solana/web3.js');
          
          try {
            // Reconstruct VersionedTransaction from parsed transaction
            const parsedTx = confirmedTx.transaction;
            if (parsedTx.message && parsedTx.signatures) {
              console.log('📋 [Grid Proxy] Reconstructing VersionedTransaction from network response...');
              
              // According to x402 gateway spec, the gateway verifies transactions on-chain
              // The transaction in the payment payload must match what's on-chain exactly
              // getTransaction returns a ParsedConfirmedTransaction, which has the transaction data
              // but we need the raw serialized bytes
              
              // The parsed transaction has message and signatures
              // We need to reconstruct the VersionedTransaction and serialize it
              // This should match what's on-chain if done correctly
              const message = TransactionMessage.decompile(parsedTx.message);
              const versionedTx = new VersionedTransaction(message);
              
              // Signatures in getTransaction response are base58-encoded strings
              // We need to decode them to bytes
              const { decode: bs58Decode } = await import('bs58');
              versionedTx.signatures = parsedTx.signatures.map((sig: string) => {
                try {
                  // Signatures are base58 strings
                  return bs58Decode(sig);
                } catch (e) {
                  // If base58 decode fails, try as Uint8Array (already bytes)
                  if (sig instanceof Uint8Array) {
                    return sig;
                  }
                  // Last resort: try base64
                  return Buffer.from(sig, 'base64');
                }
              });
              
              // Serialize the reconstructed transaction
              // This should match the on-chain transaction bytes
              signedTransaction = Buffer.from(versionedTx.serialize()).toString('base64');
              console.log('✅ [Grid Proxy] Reconstructed signed transaction from network');
              console.log(`   Transaction length: ${signedTransaction.length} bytes (base64)`);
              console.log(`   Signatures count: ${versionedTx.signatures.length}`);
            } else {
              throw new Error('Unexpected transaction format from network');
            }
          } catch (reconstructError: any) {
            console.warn('⚠️ [Grid Proxy] Failed to reconstruct transaction from network:', reconstructError.message);
            console.warn('   Falling back to prepared transaction...');
            
            // Fallback to prepared transaction
            const preparedTxBase64 = transactionPayload.data.transaction || transactionPayload.data;
            if (preparedTxBase64 && typeof preparedTxBase64 === 'string') {
              signedTransaction = preparedTxBase64;
              console.log('✅ [Grid Proxy] Using prepared transaction as fallback');
            } else {
              throw new Error('Could not get transaction bytes from prepared transaction');
            }
          }
        }
      } else {
        // Transaction not confirmed after retries
        // According to x402 gateway spec, the gateway verifies transactions on-chain
        // If the transaction isn't confirmed yet, the gateway will return 402
        // We should wait longer or return an error asking the client to retry
        console.error('❌ [Grid Proxy] Transaction not confirmed after all retries');
        console.error(`   Signature: ${signature}`);
        console.error(`   Attempted ${maxRetries} times over ${maxRetries * retryDelay / 1000} seconds`);
        console.error('   The gateway requires confirmed transactions for verification');
        
        return res.status(408).json({
          success: false,
          error: 'Transaction not confirmed on-chain',
          message: `Transaction was submitted but not confirmed after ${maxRetries * retryDelay / 1000} seconds. Please wait and retry.`,
          signature: signature,
          suggestion: 'Wait 10-30 seconds for confirmation, then retry the top-up request'
        });
      }
      
      console.log('✅ [Grid Proxy] Signed transaction ready for x402 payment');
      
      // Include transaction format info in response for debugging
      const transactionFormat = rawTransactionBase64 
        ? 'raw-base64-direct-rpc' 
        : (typeof confirmedTx?.transaction === 'string' 
          ? 'raw-base64-web3js' 
          : 'reconstructed');
      
      res.json({
        success: true,
        signedTransaction,
        signature,
        note: 'Transaction was submitted to Solana. Gateway will verify it on-chain.',
        debug: {
          transactionFormat,
          transactionLength: signedTransaction.length,
          confirmedOnAttempt: confirmedTx ? 'confirmed' : 'timeout'
        }
      });
      
    } catch (signError: any) {
      console.error('❌ [Grid Proxy] Grid signAndSend failed:', {
        error: signError.message,
        code: signError.code,
        details: signError.details,
        name: signError.name,
        stack: signError.stack?.substring(0, 1000),
      });
      
      // Check if it's a signature validation error
      if (signError.message?.includes('signature') || signError.message?.includes('Invalid signature')) {
        console.error('🔍 [Grid Proxy] Signature validation error - checking session structure:', {
          sessionSecretsStructure: {
            type: typeof sessionSecrets,
            isArray: Array.isArray(sessionSecrets),
            length: Array.isArray(sessionSecrets) ? sessionSecrets.length : undefined,
            keys: !Array.isArray(sessionSecrets) && typeof sessionSecrets === 'object' ? Object.keys(sessionSecrets) : undefined,
            firstEntry: Array.isArray(sessionSecrets) && sessionSecrets[0] ? {
              keys: Object.keys(sessionSecrets[0]),
              hasProvider: !!sessionSecrets[0].provider,
              hasPrivateKey: !!sessionSecrets[0].privateKey
            } : undefined
          },
          sessionStructure: {
            type: typeof session,
            isArray: Array.isArray(session),
            length: Array.isArray(session) ? session.length : undefined,
            keys: !Array.isArray(session) && typeof session === 'object' ? Object.keys(session) : undefined
          }
        });
      }
      
      // Extract provider from session for debugging
      let sessionProvider: string | undefined;
      if (Array.isArray(session) && session.length > 0) {
        sessionProvider = session[0]?.provider;
      }
      
      // Check if sessionSecrets has matching provider
      const matchingSecret = Array.isArray(sessionSecrets) 
        ? sessionSecrets.find((s: any) => s?.provider === sessionProvider || s?.tag === sessionProvider)
        : null;
      
      return res.status(500).json({
        success: false,
        error: `Grid signAndSend failed: ${signError.message || 'Unknown error'}`,
        details: signError.details,
        code: signError.code,
        debug: {
          sessionProvider,
          sessionSecretsProviders: Array.isArray(sessionSecrets) 
            ? sessionSecrets.map((s: any) => ({ provider: s?.provider, tag: s?.tag }))
            : [],
          hasMatchingSecret: !!matchingSecret,
          sessionFormat: Array.isArray(session) ? 'array' : typeof session,
          sessionLength: Array.isArray(session) ? session.length : undefined
        }
      });
    }
    
  } catch (error: any) {
    console.error('❌ [Grid Proxy] Sign transaction error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sign transaction'
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
      let toAccountInfo = null;
      try {
        toAccountInfo = await connection.getAccountInfo(toTokenAccount);
      } catch (error: any) {
        // If RPC is rate-limited or unavailable, assume the account exists
        // (Most mainnet accounts, especially for gateways, already have USDC accounts)
        console.warn('⚠️  [Grid Proxy] Could not check recipient ATA, assuming it exists:', error.message);
        toAccountInfo = { data: Buffer.from([]) }; // Mock account info to skip creation
      }
      
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
    let result;
    try {
      result = await gridClient.signAndSend({
        sessionSecrets,
        session,
        transactionPayload: transactionPayload.data,
        address
      });
    } catch (signError: any) {
      console.error('❌ [Grid Proxy] Grid signAndSend failed:', {
        error: signError.message,
        code: signError.code,
        details: signError.details,
      });
      
      // Return detailed error to client
      return res.status(500).json({
        success: false,
        error: signError.message || 'Failed to sign and send transaction via Grid',
        code: signError.code,
        details: signError.details,
      });
    }

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


/**
 * POST /api/grid/send-tokens-gasless
 * 
 * Send tokens using gas abstraction (sponsored transaction).
 * Builds transaction, requests sponsorship, signs with Grid, and submits to Solana.
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
router.post('/send-tokens-gasless', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
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
    
    console.log('💸 [Grid Proxy] Sending tokens with gas abstraction:', { recipient, amount, tokenMint: tokenMint || 'SOL' });
    
    // Import dependencies
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

    // Build Solana transaction instructions
    const instructions = [];
    
    if (tokenMint) {
      // SPL Token transfer
      const fromTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(tokenMint),
        new PublicKey(address),
        true  // allowOwnerOffCurve = true for Grid PDA wallets
      );
      
      const toTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(tokenMint),
        new PublicKey(recipient),
        false
      );

      const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
      
      if (!toAccountInfo) {
        const createAtaIx = createAssociatedTokenAccountInstruction(
          new PublicKey(address),
          toTokenAccount,
          new PublicKey(recipient),
          new PublicKey(tokenMint),
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

    // Request sponsorship from gas abstraction service
    console.log('   Requesting sponsorship...');
    const { X402GasAbstractionService } = await import('../lib/x402GasAbstractionService.js');
    const { loadGasAbstractionConfig } = await import('../lib/gasAbstractionConfig.js');
    const gasService = new X402GasAbstractionService(loadGasAbstractionConfig());
    
    const result = await gasService.sponsorTransaction(
      serialized,
      address,
      session,
      sessionSecrets
    );
    
    // Deserialize sponsored transaction
    const sponsoredTxBuffer = Buffer.from(result.transaction, 'base64');
    const sponsoredTx = VersionedTransaction.deserialize(sponsoredTxBuffer);
    
    console.log('   Transaction sponsored, signing with Grid...');

    // Prepare sponsored transaction via Grid SDK
    const sponsoredSerialized = Buffer.from(sponsoredTx.serialize()).toString('base64');
    const transactionPayload = await gridClient.prepareArbitraryTransaction(
      address,
      {
        transaction: sponsoredSerialized,
        fee_config: {
          currency: 'sol',
          payer_address: address,
          self_managed_fees: false
        }
      }
    );

    if (!transactionPayload || !transactionPayload.data) {
      return res.status(500).json({
        success: false,
        error: 'Failed to prepare transaction - Grid returned no data'
      });
    }

    // Sign and send using Grid SDK
    const sendResult = await gridClient.signAndSend({
      sessionSecrets,
      session,
      transactionPayload: transactionPayload.data,
      address
    });

    console.log('✅ [Grid Proxy] Tokens sent via gas abstraction');
    
    const signature = sendResult.transaction_signature || 'success';
    
    res.json({
      success: true,
      signature
    });
    
  } catch (error: any) {
    console.error('❌ [Grid Proxy] Send tokens gasless error:', error);
    
    // Handle specific gas abstraction errors
    if (error.status === 402) {
      return res.status(402).json({
        success: false,
        error: 'Insufficient gas credits',
        data: error.data
      });
    }
    
    if (error.status === 400 && error.message?.includes('prohibited')) {
      return res.status(400).json({
        success: false,
        error: 'This operation is not supported by gas sponsorship.'
      });
    }
    
    if (error.status === 503) {
      return res.status(503).json({
        success: false,
        error: 'Gas sponsorship unavailable, please retry'
      });
    }
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

export default router;


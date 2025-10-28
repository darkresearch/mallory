/**
 * Grid Proxy Endpoints
 * 
 * Backend-driven Grid authentication with automatic level detection and migration.
 * All complexity lives on the backend - frontend simply calls endpoints.
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * GRID'S TWO-TIER AUTHENTICATION MODEL
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Grid uses a two-tier authentication system that determines which API methods to use:
 * 
 * 🆕 BEGINNER LEVEL (First-time users)
 * ────────────────────────────────────
 * - Triggered when: User has never completed Grid account creation
 * - Status: app_metadata['grid-advanced'] = false or undefined
 * - Flow:
 *   1. Send OTP: gridClient.createAccount(email)
 *   2. Verify OTP: gridClient.completeAuthAndCreateAccount(user, otpCode, sessionSecrets)
 * - After success: User is PERMANENTLY upgraded to Advanced level
 * 
 * ✅ ADVANCED LEVEL (Returning users)
 * ───────────────────────────────────
 * - Triggered when: User has previously completed Grid account creation
 * - Status: app_metadata['grid-advanced'] = true
 * - Flow:
 *   1. Send OTP: gridClient.initAuth(email)
 *   2. Verify OTP: gridClient.completeAuth(user, otpCode, sessionSecrets)
 * - Once a user reaches this level, they stay here FOREVER
 * 
 * 🔄 MIGRATION SCENARIO (Existing users without app_metadata)
 * ───────────────────────────────────────────────────────────
 * - Problem: Users who created accounts before we implemented app_metadata tracking
 * - Detection: createAccount() fails with "grid_account_already_exists_for_user"
 * - Solution: 
 *   1. Catch the error
 *   2. Upgrade user to Advanced level in app_metadata
 *   3. Retry with initAuth()
 *   4. Everything happens transparently to the user
 * 
 * 📊 TRACKING METHOD
 * ─────────────────
 * - We track the user's level in Supabase auth app_metadata['grid-advanced']
 * - app_metadata is server-side only (users cannot tamper with it)
 * - This is a security/auth flag, not user preference data
 * - Default: false (beginner level)
 * - Upgraded to: true (advanced level) after first successful verification
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Router, type Request, type Response } from 'express';
import { GridClient } from '@sqds/grid';
import { authenticateUser } from '../middleware/auth';

const router: Router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

// Initialize Grid client
const gridClient = new GridClient({
  environment: (process.env.GRID_ENV || 'production') as 'sandbox' | 'production',
  apiKey: process.env.GRID_API_KEY!,
  baseUrl: 'https://grid.squads.xyz'
});

/**
 * Helper: Update user's Grid auth level in app_metadata
 * 
 * This function upgrades or downgrades a user between the two Grid auth levels:
 * - false/undefined = BEGINNER level (first-time user)
 * - true = ADVANCED level (returning user)
 * 
 * WHEN TO CALL:
 * 1. After successful beginner verification (upgrade to advanced)
 * 2. During migration when we detect existing Grid account (upgrade to advanced)
 * 
 * SECURITY NOTE:
 * - Uses Supabase Admin API (requires service role key)
 * - app_metadata is server-side only - clients cannot modify it
 * - This prevents users from manipulating their auth level
 * 
 * @param userId - Supabase user ID
 * @param isAdvanced - true = advanced level, false = beginner level
 * @throws Error if Supabase update fails
 */
async function updateGridAuthLevel(userId: string, isAdvanced: boolean): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { 'grid-advanced': isAdvanced }
  });
  
  if (error) {
    console.error('❌ Failed to update grid auth level:', error);
    throw error;
  }
  
  console.log(`✅ User ${userId} grid level updated to: ${isAdvanced ? 'ADVANCED ✅' : 'BEGINNER 🆕'}`);
}

/**
 * Helper: Get user's current Grid auth level from app_metadata
 * 
 * Determines which Grid auth flow to use by checking app_metadata['grid-advanced']:
 * - true = ADVANCED level → use initAuth() + completeAuth()
 * - false/undefined = BEGINNER level → use createAccount() + completeAuthAndCreateAccount()
 * 
 * This is the single source of truth for auth level detection.
 * 
 * @param userId - Supabase user ID
 * @returns true if advanced level, false if beginner level
 * @throws Error if user lookup fails (defaults to beginner level on error)
 */
async function getGridAuthLevel(userId: string): Promise<boolean> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  
  if (error || !data?.user) {
    console.error('❌ Failed to get user auth level:', error);
    return false; // Default to beginner if we can't determine
  }
  
  return data.user.app_metadata?.['grid-advanced'] === true;
}

/**
 * POST /api/grid/init-account
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * ENDPOINT: Start Grid Sign-In (Send OTP)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This endpoint initiates the Grid sign-in process for both first-time and
 * returning users. It automatically detects which Grid API flow to use based
 * on the user's auth level stored in app_metadata.
 * 
 * FLOW DECISION LOGIC:
 * ───────────────────
 * 1. Check app_metadata['grid-advanced']
 * 2. If false/undefined → BEGINNER: Call gridClient.createAccount(email)
 * 3. If true → ADVANCED: Call gridClient.initAuth(email)
 * 
 * BEGINNER FLOW (First-time users):
 * ─────────────────────────────────
 * - API Call: gridClient.createAccount({ email })
 * - Purpose: Creates new Grid account and sends OTP
 * - Next Step: User receives OTP via email
 * - Success: Returns Grid user object for OTP verification
 * 
 * ADVANCED FLOW (Returning users):
 * ────────────────────────────────
 * - API Call: gridClient.initAuth({ email })
 * - Purpose: Re-authenticates existing Grid account and sends OTP
 * - Next Step: User receives OTP via email
 * - Success: Returns Grid user object for OTP verification
 * 
 * MIGRATION SCENARIO:
 * ──────────────────
 * If createAccount() fails with "grid_account_already_exists_for_user":
 * 1. User has existing Grid account but is marked as beginner (data migration case)
 * 2. Automatically upgrade user to advanced level
 * 3. Retry with initAuth() to send OTP
 * 4. Everything happens transparently - frontend doesn't know migration occurred
 * 
 * REQUEST:
 * ───────
 * Body: { email: string }
 * Headers: Authorization: Bearer <token>
 * 
 * RESPONSE:
 * ────────
 * Success (200): { success: true, user: <Grid user object> }
 * Error (400/500): { success: false, error: string }
 * 
 * The returned user object is needed for OTP verification in /verify-otp endpoint.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
router.post('/init-account', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email } = req.body;
    const userId = req.user!.id;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email is required' 
      });
    }
    
    console.log('🔐 [Grid Init] Starting for user:', userId);
    
    // STEP 1: Determine user's current auth level from app_metadata
    const isAdvanced = await getGridAuthLevel(userId);
    
    console.log(`🔐 [Grid Init] User level: ${isAdvanced ? 'ADVANCED ✅' : 'BEGINNER 🆕'}`);
    
    let response;
    
    if (isAdvanced) {
      // ADVANCED FLOW: Use initAuth (for returning users)
      console.log('🔄 [Grid Init] Advanced Flow: initAuth()');
      response = await gridClient.initAuth({ email });
    } else {
      // BEGINNER FLOW: Use createAccount (for first-time users)
      console.log('🆕 [Grid Init] Beginner Flow: createAccount()');
      
      try {
        response = await gridClient.createAccount({ email });
      } catch (error: any) {
        // MIGRATION SCENARIO: Account already exists but user is marked as beginner
        // This happens for existing users before we implemented app_metadata tracking
        const errorBody = error?.response?.data || error?.message || String(error);
        const errorString = typeof errorBody === 'string' ? errorBody : JSON.stringify(errorBody);
        
        if (errorString.includes('grid_account_already_exists_for_user')) {
          console.log('📈 [Grid Migration] Account exists - upgrading to advanced level');
          
          // Upgrade user to advanced level permanently
          await updateGridAuthLevel(userId, true);
          
          // Retry with advanced flow (initAuth sends OTP automatically)
          console.log('🔄 [Grid Migration] Retrying with initAuth()');
          response = await gridClient.initAuth({ email });
          
          console.log('✅ [Grid Migration] Successfully migrated user to advanced flow');
        } else {
          // Some other error - re-throw
          throw error;
        }
      }
    }
    
    if (!response.success || !response.data) {
      return res.status(400).json({
        success: false,
        error: response.error || 'Failed to initialize Grid account'
      });
    }
    
    // Return Grid user object (client uses this for OTP verification)
    res.json({
      success: true,
      user: response.data
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
 * POST /api/grid/verify-otp
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * ENDPOINT: Complete Grid Sign-In (Verify OTP)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This endpoint completes the Grid sign-in process by verifying the OTP code.
 * It automatically detects which Grid API flow to use based on the user's auth
 * level, and upgrades beginner users to advanced level after successful verification.
 * 
 * FLOW DECISION LOGIC:
 * ───────────────────
 * 1. Check app_metadata['grid-advanced']
 * 2. If false/undefined → BEGINNER: Call gridClient.completeAuthAndCreateAccount()
 * 3. If true → ADVANCED: Call gridClient.completeAuth()
 * 
 * BEGINNER FLOW (First-time users):
 * ─────────────────────────────────
 * - API Call: gridClient.completeAuthAndCreateAccount({ user, otpCode, sessionSecrets })
 * - Purpose: Verifies OTP and creates Grid account
 * - On Success:
 *   1. Grid account is fully created
 *   2. Backend sets app_metadata['grid-advanced'] = true
 *   3. User is PERMANENTLY upgraded to advanced level
 *   4. Grid address is synced to database
 *   5. Returns authentication data
 * 
 * ADVANCED FLOW (Returning users):
 * ────────────────────────────────
 * - API Call: gridClient.completeAuth({ user, otpCode, sessionSecrets })
 * - Purpose: Verifies OTP and re-authenticates existing Grid account
 * - On Success:
 *   1. Grid account is authenticated
 *   2. Grid address is synced to database (idempotent)
 *   3. Returns authentication data
 * 
 * POST-VERIFICATION ACTIONS:
 * ─────────────────────────
 * After successful verification (both flows):
 * 1. Sync Grid address to users_grid table (with retry logic)
 * 2. Store account data for future transactions
 * 3. Return authentication data to client
 * 
 * REQUEST:
 * ───────
 * Body: {
 *   user: <Grid user object from /init-account>,
 *   otpCode: string (6-digit code),
 *   sessionSecrets: object (client-generated)
 * }
 * Headers: Authorization: Bearer <token>
 * 
 * RESPONSE:
 * ────────
 * Success (200): { success: true, data: <Grid account with authentication> }
 * Error (400/500): { success: false, error: string }
 * 
 * The returned data includes:
 * - address: Solana wallet address
 * - authentication: Session data for future transactions
 * ═══════════════════════════════════════════════════════════════════════════════
 */
router.post('/verify-otp', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user, otpCode, sessionSecrets } = req.body;
    const userId = req.user!.id;
    
    if (!user || !otpCode || !sessionSecrets) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: user, otpCode, sessionSecrets' 
      });
    }
    
    console.log('🔐 [Grid Verify] Starting OTP verification for user:', userId);
    
    // STEP 1: Determine user's current auth level from app_metadata
    const isAdvanced = await getGridAuthLevel(userId);
    
    console.log(`🔐 [Grid Verify] User level: ${isAdvanced ? 'ADVANCED ✅' : 'BEGINNER 🆕'}`);
    
    let authResult;
    
    if (isAdvanced) {
      // ADVANCED FLOW: Use completeAuth (for returning users)
      console.log('🔄 [Grid Verify] Advanced Flow: completeAuth()');
      authResult = await gridClient.completeAuth({
        user,
        otpCode,
        sessionSecrets
      });
    } else {
      // BEGINNER FLOW: Use completeAuthAndCreateAccount (for first-time users)
      console.log('🆕 [Grid Verify] Beginner Flow: completeAuthAndCreateAccount()');
      authResult = await gridClient.completeAuthAndCreateAccount({
        user,
        otpCode,
        sessionSecrets
      });
      
      // UPGRADE USER: After successful beginner verification, upgrade to advanced level
      if (authResult.success && authResult.data) {
        console.log('📈 [Grid Verify] Beginner flow complete - upgrading to advanced level');
        await updateGridAuthLevel(userId, true);
      }
    }
    
    console.log('🔐 [Grid Verify] Result:', { 
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
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const maxRetries = 3;
    let dbError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const { error } = await supabase
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


/**
 * Grid Proxy Endpoints
 * 
 * Minimal proxy to avoid CORS issues with Grid SDK in browser
 * ONLY proxies account initialization - everything else stays client-side
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
 * POST /api/grid/init-account
 * 
 * Proxy for Grid account initialization (both new accounts and re-auth)
 * Avoids CORS issues by running Grid SDK server-side
 * 
 * Body: { email: string, isReauth?: boolean }
 * Returns: Grid user object for OTP verification
 */
router.post('/init-account', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, isReauth } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email is required' 
      });
    }
    
    console.log('🔐 [Grid Proxy] Initializing account:', { email, isReauth: !!isReauth });
    
    let response;
    
    if (isReauth) {
      // Existing account - use initAuth
      console.log('🔐 [Grid Proxy] Using initAuth for existing account');
      response = await gridClient.initAuth({ email });
    } else {
      // New account - use createAccount
      console.log('🔐 [Grid Proxy] Using createAccount for new account');
      response = await gridClient.createAccount({ email });
    }
    
    console.log('🔐 [Grid Proxy] Grid API response:', response);
    
    if (!response.success || !response.data) {
      return res.status(400).json({
        success: false,
        error: response.error || 'Failed to initialize Grid account'
      });
    }
    
    // Return Grid user object (needed for OTP verification)
    res.json({
      success: true,
      user: response.data
    });
    
  } catch (error) {
    console.error('❌ [Grid Proxy] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/grid/verify-otp
 * 
 * Proxy for OTP verification (both new accounts and re-auth)
 * Avoids CORS issues by running Grid SDK server-side
 * Also syncs Grid address to database
 * 
 * Body: { user: object, otpCode: string, sessionSecrets: object, isReauth?: boolean }
 * Returns: Grid account data with authentication
 */
router.post('/verify-otp', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user, otpCode, sessionSecrets, isReauth } = req.body;
    
    if (!user || !otpCode || !sessionSecrets) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: user, otpCode, sessionSecrets' 
      });
    }
    
    console.log('🔐 [Grid Proxy] Verifying OTP:', { isReauth: !!isReauth });
    
    let authResult;
    
    if (isReauth) {
      // Existing account - use completeAuth
      console.log('🔐 [Grid Proxy] Using completeAuth for existing account');
      authResult = await gridClient.completeAuth({
        user,
        otpCode,
        sessionSecrets
      });
    } else {
      // New account - use completeAuthAndCreateAccount
      console.log('🔐 [Grid Proxy] Using completeAuthAndCreateAccount for new account');
      authResult = await gridClient.completeAuthAndCreateAccount({
        user,
        otpCode,
        sessionSecrets
      });
    }
    
    console.log('🔐 [Grid Proxy] Verification result:', { 
      success: authResult.success,
      hasData: !!authResult.data,
      address: authResult.data?.address
    });
    
    // DETAILED LOGGING FOR DEBUGGING
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔐 [Grid Proxy] RAW GRID SDK RESPONSE STRUCTURE:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Data keys:', authResult.data ? Object.keys(authResult.data) : []);
    console.log('Authentication type:', typeof authResult.data?.authentication);
    console.log('Authentication is array:', Array.isArray(authResult.data?.authentication));
    console.log('Authentication keys:', authResult.data?.authentication ? Object.keys(authResult.data.authentication) : []);
    console.log('Authentication value:', authResult.data?.authentication);
    console.log('Full data object:', JSON.stringify(authResult.data, null, 2));
    console.log('═══════════════════════════════════════════════════════════');
    console.log();
    
    if (!authResult.success || !authResult.data) {
      return res.status(400).json({
        success: false,
        error: authResult.error || 'OTP verification failed'
      });
    }
    
    // Sync Grid address to database (using service role to bypass RLS)
    // Retry logic: 3 attempts with exponential backoff
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const maxRetries = 3;
    let dbError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🔄 [Grid Proxy] Database sync attempt ${attempt}/${maxRetries}`);
      
      const { error } = await supabase
        .from('users_grid')
        .upsert({
          id: req.user!.id,
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
      console.error(`⚠️ Database sync attempt ${attempt} failed:`, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
      // Wait before retrying (exponential backoff: 100ms, 200ms, 400ms)
      if (attempt < maxRetries) {
        const delayMs = 100 * Math.pow(2, attempt - 1);
        console.log(`⏳ Waiting ${delayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    if (dbError) {
      console.error('❌ Failed to sync Grid address after all retries:', dbError);
      // Return error to client - Grid account exists but DB sync failed
      // User can use recovery endpoint or retry login to fix this
      return res.status(500).json({
        success: false,
        error: 'Grid account created but database sync failed. Please try logging in again.',
        gridAccountCreated: true,
        address: authResult.data.address
      });
    }
    
    // Return Grid account data
    res.json({
      success: true,
      data: authResult.data
    });
    
  } catch (error) {
    console.error('❌ [Grid Proxy] Verification error:', error);
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

/**
 * POST /api/grid/sync-account
 * 
 * Recovery endpoint for users stuck without users_grid records
 * Manually syncs Grid address to database for authenticated user
 * 
 * Use cases:
 * - User has Supabase auth + Grid account but missing users_grid record
 * - Database sync failed during OTP verification
 * - Support/admin recovery tool
 * 
 * Body: { address: string }
 * Returns: { success: boolean }
 */
router.post('/sync-account', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ 
        success: false, 
        error: 'Grid wallet address is required' 
      });
    }
    
    console.log('🔄 [Grid Recovery] Syncing account for user:', req.user!.id);
    console.log('   Address:', address);
    
    // Validate address format (basic Solana address validation)
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Solana address format'
      });
    }
    
    // Use service role to bypass RLS
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Sync to database with retry logic
    const maxRetries = 3;
    let dbError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🔄 [Grid Recovery] Database sync attempt ${attempt}/${maxRetries}`);
      
      const { error } = await supabase
        .from('users_grid')
        .upsert({
          id: req.user!.id,
          solana_wallet_address: address,
          account_type: 'email',
          grid_account_status: 'active',
          updated_at: new Date().toISOString()
        });
      
      if (!error) {
        console.log('✅ [Grid Recovery] Grid address synced successfully:', address);
        dbError = null;
        break;
      }
      
      dbError = error;
      console.error(`⚠️ [Grid Recovery] Sync attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        const delayMs = 100 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    if (dbError) {
      console.error('❌ [Grid Recovery] Failed to sync after all retries:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Database sync failed. Please contact support.',
        details: dbError.message
      });
    }
    
    res.json({
      success: true,
      message: 'Grid account synced successfully',
      address
    });
    
  } catch (error) {
    console.error('❌ [Grid Recovery] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

export default router;


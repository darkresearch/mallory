/**
 * Test-specific Grid Client
 * 
 * Same as production gridClientService but uses testStorage instead of secureStorage
 */

import { GridClient } from '@sqds/grid';
import { testStorage } from './test-storage';

const gridEnv = process.env.EXPO_PUBLIC_GRID_ENV || 'sandbox';

// Note: Grid API key should NOT be accessible to client code
// All Grid operations should go through backend API proxy (same as production)
// This client is only used for generateSessionSecrets() which doesn't need the API key

/**
 * Test Grid Client Service
 * Mirrors production gridClientService but works in test environment
 */
class TestGridClientService {
  public client: GridClient;  // Make public for direct access
  
  constructor() {
    this.client = new GridClient({
      environment: gridEnv as 'sandbox' | 'production',
      apiKey: 'not-used-client-side',
      baseUrl: 'https://grid.squads.xyz'
    });
    
    console.log('🔐 Test Grid client initialized:', gridEnv);
  }

  /**
   * Create Grid account with email-based authentication
   * Generates and stores session secrets locally (never sent to backend)
   */
  async createAccount(email: string) {
    try {
      console.log('🔐 Creating Grid account for:', email);
      
      // Initiate account creation - Grid sends OTP to email
      const response = await this.client.createAccount({ email });
      console.log('   Grid createAccount response:', response);
      
      // Generate session secrets (stored client-side only)
      const sessionSecrets = await this.client.generateSessionSecrets();
      console.log('   Session secrets generated');
      
      // Store session secrets securely (using testStorage in tests)
      await testStorage.setItem('grid_session_secrets', JSON.stringify(sessionSecrets));
      
      console.log('✅ Grid account creation initiated, OTP sent');
      console.log('   User data:', response.data);
      
      return { 
        user: response.data, 
        sessionSecrets 
      };
    } catch (error) {
      console.error('❌ Grid account creation error:', error);
      throw error;
    }
  }

  /**
   * Verify OTP code and complete account setup
   */
  async verifyAccount(user: any, otpCode: string) {
    try {
      console.log('🔐 Verifying Grid account with OTP');
      console.log('   User:', user);
      console.log('   OTP:', otpCode);
      
      // Retrieve session secrets from storage
      const sessionSecretsJson = await testStorage.getItem('grid_session_secrets');
      if (!sessionSecretsJson) {
        throw new Error('Session secrets not found. Please create account first.');
      }
      
      const sessionSecrets = JSON.parse(sessionSecretsJson);
      console.log('   Session secrets loaded');
      
      // Complete authentication and create account
      console.log('   Calling Grid API...');
      const authResult = await this.client.completeAuthAndCreateAccount({
        user,
        otpCode,
        sessionSecrets
      });
      
      console.log('   Grid API response:', {
        success: authResult.success,
        hasData: !!authResult.data,
        error: authResult.error || 'none'
      });
      
      if (authResult.success && authResult.data) {
        // Store account data
        await testStorage.setItem('grid_account', JSON.stringify(authResult.data));
        
        console.log('✅ Grid account verified:', authResult.data.address);
      } else {
        console.error('❌ Verification failed:', authResult);
      }
      
      return authResult;
    } catch (error) {
      console.error('❌ Grid verification error:', error);
      throw error;
    }
  }

  /**
   * Get stored Grid account
   */
  async getAccount() {
    const accountJson = await testStorage.getItem('grid_account');
    return accountJson ? JSON.parse(accountJson) : null;
  }

  /**
   * Send tokens (SOL or SPL) from Grid wallet
   * Uses Grid SDK's prepareArbitraryTransaction + signAndSend
   */
  async sendTokens(params: {
    recipient: string;
    amount: string;
    tokenMint?: string;
  }): Promise<string> {
    try {
      console.log('💸 Sending tokens via Grid:', params);

      const { recipient, amount, tokenMint } = params;
      
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
      
      // Retrieve session secrets and account
      const sessionSecretsJson = await testStorage.getItem('grid_session_secrets');
      if (!sessionSecretsJson) {
        throw new Error('Session secrets not found');
      }
      
      const sessionSecrets = JSON.parse(sessionSecretsJson);
      
      const accountJson = await testStorage.getItem('grid_account');
      if (!accountJson) {
        throw new Error('Grid account not found');
      }
      
      const account = JSON.parse(accountJson);

      const connection = new Connection(
        process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        'confirmed'
      );

      console.log('   Building Solana transaction...');

      // Build Solana transaction instructions
      const instructions = [];
      
      if (tokenMint) {
        // SPL Token transfer (with allowOwnerOffCurve for PDA wallets)
        const fromTokenAccount = await getAssociatedTokenAddress(
          new PublicKey(tokenMint),
          new PublicKey(account.address),
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
            new PublicKey(account.address), // payer
            toTokenAccount,                  // ata
            new PublicKey(recipient),        // owner
            new PublicKey(tokenMint),        // mint
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          );
          instructions.push(createAtaIx);
        }

        const amountInSmallestUnit = Math.floor(parseFloat(amount) * 1000000); // USDC has 6 decimals

        const transferIx = createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          new PublicKey(account.address),
          amountInSmallestUnit,
          [],
          TOKEN_PROGRAM_ID
        );
        instructions.push(transferIx);
      } else {
        // SOL transfer
        const amountInLamports = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);
        
        const transferIx = SystemProgram.transfer({
          fromPubkey: new PublicKey(account.address),
          toPubkey: new PublicKey(recipient),
          lamports: amountInLamports
        });
        instructions.push(transferIx);
      }

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash('confirmed');

      // Build transaction message
      const message = new TransactionMessage({
        payerKey: new PublicKey(account.address),
        recentBlockhash: blockhash,
        instructions
      }).compileToV0Message();

      const transaction = new VersionedTransaction(message);
      const serialized = Buffer.from(transaction.serialize()).toString('base64');

      console.log('   Preparing arbitrary transaction via Grid...');

      // Prepare transaction via Grid SDK (with fee config)
      const transactionPayload = await this.client.prepareArbitraryTransaction(
        account.address,
        {
          transaction: serialized,
          fee_config: {
            currency: 'sol',
            payer_address: account.address,
            self_managed_fees: false
          }
        }
      );

      console.log('   Grid prepareArbitraryTransaction response:', transactionPayload);

      if (!transactionPayload || !transactionPayload.data) {
        console.error('❌ Invalid response from prepareArbitraryTransaction:', transactionPayload);
        throw new Error('Failed to prepare transaction - Grid returned no data');
      }

      console.log('   Signing and sending...');

      // Sign and send using Grid SDK
      const result = await this.client.signAndSend({
        sessionSecrets,
        session: account.authentication,
        transactionPayload: transactionPayload.data,
        address: account.address
      });

      console.log('✅ Tokens sent via Grid');
      
      // Extract signature (Grid returns transaction_signature)
      const signature = result.transaction_signature || 'success';
      
      console.log('   Transaction signature:', signature);
      
      return signature;
    } catch (error) {
      console.error('❌ Token send error:', error);
      throw error;
    }
  }

  /**
   * Get account balances
   */
  async getAccountBalances(address: string) {
    try {
      const balances = await this.client.getAccountBalances(address);
      return balances;
    } catch (error) {
      console.error('❌ Balance fetch error:', error);
      throw error;
    }
  }

  /**
   * Re-authenticate existing account (when session expires)
   * Uses /auth endpoint instead of /account
   */
  async reauthenticate(email: string): Promise<any> {
    try {
      console.log('🔄 Re-authenticating Grid account for:', email);
      
      // Use Grid SDK's initAuth for existing accounts
      const response = await this.client.initAuth({ email });
      console.log('   Init auth response:', response);
      
      if (!response.success || !response.data) {
        throw new Error('Failed to initiate re-auth');
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Grid re-auth error:', error);
      throw error;
    }
  }

  /**
   * Complete re-authentication with OTP
   */
  async completeReauth(authData: any, otpCode: string): Promise<any> {
    try {
      console.log('🔄 Completing re-authentication with OTP');
      
      // Get existing session secrets
      const sessionSecretsJson = await testStorage.getItem('grid_session_secrets');
      if (!sessionSecretsJson) {
        throw new Error('Session secrets not found');
      }
      
      const sessionSecrets = JSON.parse(sessionSecretsJson);
      
      // Complete auth (for existing account, use completeAuth not completeAuthAndCreateAccount)
      const result = await this.client.completeAuth({
        user: authData,
        otpCode,
        sessionSecrets
      });
      
      if (result.success && result.data) {
        // Update stored account
        await testStorage.setItem('grid_account', JSON.stringify(result.data));
        console.log('✅ Re-authentication successful');
        console.log('   Address:', result.data.address);
        
        // Update cache
        const gridSession = {
          address: result.data.address,
          authentication: result.data.authentication,
          sessionSecrets,
        };
        await testStorage.setItem('grid_session_cache', JSON.stringify(gridSession));
      }
      
      return result;
    } catch (error) {
      console.error('❌ Re-auth completion error:', error);
      throw error;
    }
  }
}

export const gridTestClient = new TestGridClientService();


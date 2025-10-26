import {
  Keypair,
  Connection,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import {
  createTransferInstruction,
  createCloseAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { gridClientService } from '../grid';
import { X402_CONSTANTS } from '@darkresearch/mallory-shared';

/**
 * Ephemeral Wallet Manager (Client-Side)
 * Copied from Researcher but adapted for client-side Grid integration
 * 
 * Creates temporary keypairs for x402 payments with ZERO DUST guarantee.
 * Lifecycle: create → fund from Grid → use for payment → sweep back to Grid
 */
export class EphemeralWalletManager {
  private static connection = new Connection(X402_CONSTANTS.getSolanaRpcUrl(), 'confirmed');

  /**
   * Create ephemeral keypair (in-memory only, never persisted)
   */
  static create(): { keypair: Keypair; address: string } {
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();

    console.log('🔑 [Ephemeral] Created ephemeral keypair:', { address });

    return { keypair, address };
  }

  /**
   * Fund ephemeral wallet from Grid
   * Uses Grid's signAndSend to transfer USDC + SOL
   */
  static async fund(
    ephemeralAddress: string,
    usdcAmount: string,
    solAmount: string
  ): Promise<{ usdcSignature: string; solSignature: string }> {
    try {
      console.log('💰 [Ephemeral] Funding from Grid:', {
        ephemeralAddress,
        usdcAmount,
        solAmount
      });

      const account = await gridClientService.getAccount();
      if (!account) {
        throw new Error('Grid account not found');
      }

      // Send USDC using Grid
      // Grid will handle building the transaction internally
      const usdcSignature = await gridClientService.sendTokens({
        recipient: ephemeralAddress,
        amount: usdcAmount,
        tokenMint: X402_CONSTANTS.USDC_MINT
      });

      // Send SOL using Grid
      const solSignature = await gridClientService.sendTokens({
        recipient: ephemeralAddress,
        amount: solAmount
        // No tokenMint = native SOL
      });

      console.log('✅ [Ephemeral] Funding complete:', {
        usdcSignature,
        solSignature
      });

      return { usdcSignature, solSignature };

    } catch (error) {
      console.error('💰 [Ephemeral] Funding failed:', error);
      throw new Error(`Failed to fund ephemeral wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sweep ALL funds back to Grid wallet
   * ZERO DUST: Recovers all USDC + SOL + rent from closed accounts
   * Copied exactly from Researcher's EphemeralWalletManager.sweepAll()
   */
  static async sweepAll(
    ephemeralKeypair: Keypair,
    gridWalletAddress: string,
    tokenMint?: string
  ): Promise<{
    swept: {
      tokens: number;
      sol: number;
      rentRecovered: number;
    }
  }> {
    try {
      console.log('🧹 [Ephemeral] Starting sweep to Grid:', {
        from: ephemeralKeypair.publicKey.toBase58(),
        to: gridWalletAddress,
        tokenMint
      });

      const instructions = [];
      let tokensSwept = 0;
      let rentRecovered = 0;

      // Step 1: Sweep token balance (if token mint provided)
      if (tokenMint) {
        try {
          const fromTokenAccount = await getAssociatedTokenAddress(
            new PublicKey(tokenMint),
            ephemeralKeypair.publicKey
          );

          const toTokenAccount = await getAssociatedTokenAddress(
            new PublicKey(tokenMint),
            new PublicKey(gridWalletAddress)
          );

          const tokenBalance = await this.connection.getTokenAccountBalance(fromTokenAccount);
          const tokenAmount = parseInt(tokenBalance.value.amount);

          if (tokenAmount > 0) {
            console.log('🧹 [Ephemeral] Sweeping tokens:', {
              amount: tokenAmount,
              decimals: tokenBalance.value.decimals,
              uiAmount: tokenBalance.value.uiAmountString
            });

            instructions.push(
              createTransferInstruction(
                fromTokenAccount,
                toTokenAccount,
                ephemeralKeypair.publicKey,
                tokenAmount,
                [],
                TOKEN_PROGRAM_ID
              )
            );

            tokensSwept = tokenAmount;
          }

          // Step 2: Close token account to recover rent (~0.00203928 SOL)
          console.log('🧹 [Ephemeral] Closing token account to recover rent...');
          
          instructions.push(
            createCloseAccountInstruction(
              fromTokenAccount,
              new PublicKey(gridWalletAddress),
              ephemeralKeypair.publicKey,
              [],
              TOKEN_PROGRAM_ID
            )
          );

          rentRecovered = 0.00203928;

        } catch (error) {
          console.log('🧹 [Ephemeral] No token account to sweep:', error);
        }
      }

      // Step 3: Sweep remaining SOL
      const solBalance = await this.connection.getBalance(ephemeralKeypair.publicKey);
      
      console.log('🧹 [Ephemeral] Current SOL balance:', {
        lamports: solBalance,
        sol: solBalance / LAMPORTS_PER_SOL
      });

      const feeReserve = 5000; // Reserve for transaction fee
      const solToSweep = solBalance - feeReserve;

      if (solToSweep > 0) {
        console.log('🧹 [Ephemeral] Sweeping SOL:', {
          lamports: solToSweep,
          sol: solToSweep / LAMPORTS_PER_SOL
        });

        instructions.push(
          SystemProgram.transfer({
            fromPubkey: ephemeralKeypair.publicKey,
            toPubkey: new PublicKey(gridWalletAddress),
            lamports: solToSweep
          })
        );
      }

      // Execute sweep transaction
      if (instructions.length > 0) {
        const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');

        const message = new TransactionMessage({
          payerKey: ephemeralKeypair.publicKey,
          recentBlockhash: blockhash,
          instructions
        }).compileToV0Message();

        const transaction = new VersionedTransaction(message);
        transaction.sign([ephemeralKeypair]);

        console.log('🧹 [Ephemeral] Submitting sweep transaction...');

        const signature = await this.connection.sendTransaction(transaction, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3
        });

        await this.connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed');

        console.log('✅ [Ephemeral] Sweep complete:', { signature });
      } else {
        console.log('🧹 [Ephemeral] No funds to sweep');
      }

      const result = {
        tokens: tokensSwept,
        sol: solToSweep / LAMPORTS_PER_SOL,
        rentRecovered
      };

      console.log('✅ [Ephemeral] Sweep summary:', result);

      return { swept: result };

    } catch (error) {
      console.error('🧹 [Ephemeral] Sweep failed:', error);
      console.error('⚠️ [Ephemeral] WARNING: Funds may be stuck in ephemeral wallet');
      
      return {
        swept: {
          tokens: 0,
          sol: 0,
          rentRecovered: 0
        }
      };
    }
  }
}


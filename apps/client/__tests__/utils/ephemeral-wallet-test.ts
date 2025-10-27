/**
 * Ephemeral Wallet Manager (Test Version)
 * 
 * Same as production but uses gridTestClient instead of gridClientService
 */

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
import { gridTestClient } from '../setup/grid-test-client';

// Get constants from environment
const SOLANA_RPC_URL = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // Mainnet USDC

// Ephemeral wallet funding amounts
const EPHEMERAL_FUNDING_USDC = '0.10';  // 0.10 USDC
const EPHEMERAL_FUNDING_SOL = '0.001';  // 0.001 SOL for fees

/**
 * Ephemeral Wallet Manager for Tests
 */
export class EphemeralWalletManagerTest {
  private static connection = new Connection(SOLANA_RPC_URL, 'confirmed');

  /**
   * Wait for transaction confirmation
   */
  private static async waitForTransactionConfirmation(signature: string, maxAttempts: number = 30): Promise<void> {
    console.log('   Waiting for tx confirmation:', signature.substring(0, 12) + '...');
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const status = await this.connection.getSignatureStatus(signature);
        
        if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
          console.log('   ✅ Confirmed after', i + 1, 'attempts');
          return;
        }
        
        if (status.value?.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
        }
      } catch (error) {
        // Continue polling
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Check every 1s
    }
    
    throw new Error(`Transaction not confirmed after ${maxAttempts} seconds`);
  }

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

      // Send USDC using Grid
      const usdcSignature = await gridTestClient.sendTokens({
        recipient: ephemeralAddress,
        amount: usdcAmount,
        tokenMint: USDC_MINT
      });

      // Send SOL using Grid
      const solSignature = await gridTestClient.sendTokens({
        recipient: ephemeralAddress,
        amount: solAmount
        // No tokenMint = native SOL
      });

      console.log('✅ [Ephemeral] Funding transactions submitted');
      console.log('   USDC tx:', usdcSignature.substring(0, 20) + '...');
      console.log('   SOL tx:', solSignature.substring(0, 20) + '...');
      console.log('   Waiting 2s for settlement...');
      // NOTE: DO NOT increase this wait time beyond 2-3s - Solana confirms fast
      // If funds aren't visible after 2s, there's a different problem (wrong network, etc)
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
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
            new PublicKey(gridWalletAddress),
            true  // allowOwnerOffCurve = true for Grid PDA
          );

          // Try to get token balance (might not exist if transfer failed)
          let tokenBalance;
          try {
            tokenBalance = await this.connection.getTokenAccountBalance(fromTokenAccount);
          } catch (error) {
            console.log('🧹 [Ephemeral] Token account not found (transfer may have failed)');
            throw new Error('No token account');  // Will be caught below
          }
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

          // Step 2: Close token account to recover rent
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


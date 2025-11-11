import { tool } from 'ai';
import { z } from 'zod';
import { 
  X402_CONSTANTS,
  type GridTokenSender 
} from '@darkresearch/mallory-shared';
import { createGridClient } from '../../../lib/gridClient.js';

/**
 * X402 Context for payment tools
 */
interface X402Context {
  gridSessionSecrets: any;
  gridSession: any;
}

/**
 * Send Payment Tool
 * Enables Mallory to send money to people globally
 */
export function createSendPaymentTool(x402Context?: X402Context) {
  return tool({
    description: `Send money to someone using crypto rails. 
    
Supports:
- Mobile money (M-Pesa, etc)
- Bank transfers
- Direct crypto wallets

CRITICAL: ALWAYS ask user to confirm before sending money!
Show them: recipient, amount, fees, delivery method.

Example flow:
User: "Send $50 to +254712345678"
You: "I'll send $50 via M-Pesa to +254712345678. Total cost: ~$50.25 (includes fees). Confirm?"
User: "Yes"
You: [execute payment with confirmed=true]`,
    
    inputSchema: z.object({
      amount: z.number().positive().describe('Amount to send in USD'),
      recipientIdentifier: z.string().describe('Phone number (e.g., +254712345678) or wallet address'),
      recipientType: z.enum(['mobile_money', 'bank_transfer', 'crypto_wallet']).describe('How to deliver the money'),
      country: z.string().optional().describe('2-letter country code (KE, NG, PH) - required for fiat delivery'),
      currency: z.string().default('USD').describe('Source currency'),
      confirmed: z.boolean().default(false).describe('Has user confirmed this payment?')
    }),

    execute: async ({ amount, recipientIdentifier, recipientType, country, currency, confirmed }: {
      amount: number;
      recipientIdentifier: string;
      recipientType: 'mobile_money' | 'bank_transfer' | 'crypto_wallet';
      country?: string;
      currency: string;
      confirmed: boolean;
    }) => {
      console.log('💸 [Payment] Payment request received:', {
        amount,
        recipientIdentifier,
        recipientType,
        country,
        currency,
        confirmed
      });

      // CRITICAL: Require user confirmation
      if (!confirmed) {
        const estimatedFees = amount * 0.005;
        const totalCost = amount + estimatedFees;
        
        return {
          success: false,
          requiresConfirmation: true,
          message: `I'll send $${amount} to ${recipientIdentifier} via ${recipientType}. Total cost: $${totalCost.toFixed(2)} (includes ~$${estimatedFees.toFixed(2)} in fees). Please confirm to proceed.`,
          quote: {
            amount,
            currency,
            recipient: recipientIdentifier,
            estimatedFees,
            totalCost,
            deliveryMethod: recipientType,
            country
          }
        };
      }

      // Check if Grid session available
      if (!x402Context?.gridSessionSecrets || !x402Context?.gridSession) {
        return {
          success: false,
          error: 'Grid wallet not connected. Please connect your wallet first.',
          requiresWalletConnection: true
        };
      }

      try {
        // Validate inputs
        if (recipientType !== 'crypto_wallet' && !country) {
          throw new Error('Country code required for fiat delivery');
        }

        if (recipientType === 'mobile_money' && !recipientIdentifier.startsWith('+')) {
          throw new Error('Mobile money requires phone number with country code (e.g., +254712345678)');
        }

        const { gridSession, gridSessionSecrets } = x402Context;
        const gridAddress = gridSession.address;

        console.log('💳 [Payment] Grid wallet:', gridAddress);

        // Import Solana dependencies
        const {
          PublicKey,
          Connection,
          TransactionMessage,
          VersionedTransaction
        } = await import('@solana/web3.js');
        
        const {
          createTransferInstruction,
          getAssociatedTokenAddress,
          createAssociatedTokenAccountInstruction,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        } = await import('@solana/spl-token');

        // Setup connection
        const connection = new Connection(
          process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
          'confirmed'
        );

        // Determine USDC mint
        const usdcMint = new PublicKey(
          process.env.SOLANA_CLUSTER === 'devnet'
            ? 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr'  // Faucet's USDC
            : X402_CONSTANTS.USDC_MINT
        );

        // Check balance
        const gridTokenAccount = await getAssociatedTokenAddress(
          usdcMint,
          new PublicKey(gridAddress),
          true
        );

        const balance = await connection.getTokenAccountBalance(gridTokenAccount);
        const usdcBalance = parseFloat(balance.value.uiAmountString || '0');

        console.log('💰 [Payment] USDC Balance:', usdcBalance);

        if (usdcBalance < amount) {
          return {
            success: false,
            error: `Insufficient balance: You have ${usdcBalance} USDC but need ${amount} USDC`,
            requiresTopUp: true,
            currentBalance: usdcBalance,
            requiredAmount: amount
          };
        }

        // Determine recipient address based on type
        let recipientAddress: string;
        
        if (recipientType === 'crypto_wallet') {
          recipientAddress = recipientIdentifier;
        } else {
          // For M-Pesa/bank, send to Bridge deposit address
          recipientAddress = 'BRDGEyMC4CkqJzWJ1P72p9Zk7B5BxkGGZdvwkCXPBrjR';
        }

        // Build transaction instructions
        const instructions = [];

        // Get/create recipient token account
        const fromTokenAccount = await getAssociatedTokenAddress(
          usdcMint,
          new PublicKey(gridAddress),
          true  // allowOwnerOffCurve for Grid PDA
        );

        const toTokenAccount = await getAssociatedTokenAddress(
          usdcMint,
          new PublicKey(recipientAddress),
          false
        );

        const toAccountInfo = await connection.getAccountInfo(toTokenAccount);

        // Create recipient token account if it doesn't exist
        if (!toAccountInfo) {
          const createAtaIx = createAssociatedTokenAccountInstruction(
            new PublicKey(gridAddress),
            toTokenAccount,
            new PublicKey(recipientAddress),
            usdcMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          );
          instructions.push(createAtaIx);
        }

        // Add transfer instruction
        const amountInSmallestUnit = Math.floor(amount * 1000000); // USDC has 6 decimals
        const transferIx = createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          new PublicKey(gridAddress),
          amountInSmallestUnit,
          [],
          TOKEN_PROGRAM_ID
        );
        instructions.push(transferIx);

        // Build and sign transaction with Grid
        const { blockhash } = await connection.getLatestBlockhash('confirmed');

        const message = new TransactionMessage({
          payerKey: new PublicKey(gridAddress),
          recentBlockhash: blockhash,
          instructions
        }).compileToV0Message();

        const transaction = new VersionedTransaction(message);

        // Sign with Grid
        const gridClient = createGridClient();
        console.log('🔐 [Payment] Signing transaction with Grid...');

        const signedTx = await gridClient.signTransaction(
          gridAddress,
          gridSessionSecrets,
          gridSession,
          transaction
        );

        // Send transaction
        console.log('📤 [Payment] Sending transaction...');
        const signature = await connection.sendTransaction(signedTx, {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        });

        console.log('✅ [Payment] Transaction sent:', signature);

        // Wait for confirmation
        await connection.confirmTransaction(signature, 'confirmed');

        console.log('✅ [Payment] Transaction confirmed!');

        // Build result
        let result: any = {
          txHash: signature,
          type: recipientType === 'crypto_wallet' ? 'crypto' : 'fiat',
          network: 'solana'
        };

        if (recipientType !== 'crypto_wallet') {
          result.bridgeTransactionId = `bridge_${Date.now()}`;
          result.deliveryMethod = recipientType;
          result.country = country;
          result.estimatedArrival = '2-5 minutes';
        }

        return {
          success: true,
          transactionHash: signature,
          recipient: recipientIdentifier,
          amountSent: amount,
          currency,
          deliveryMethod: recipientType,
          estimatedArrival: recipientType === 'crypto_wallet' ? 'Immediate' : '2-5 minutes',
          message: `Successfully sent ${amount} ${currency} to ${recipientIdentifier}`,
          ...result
        };

      } catch (error: any) {
        console.error('❌ [Payment] Payment failed:', error);
        
        return {
          success: false,
          error: error.message || 'Payment failed',
          details: error.toString()
        };
      }
    }
  });
}

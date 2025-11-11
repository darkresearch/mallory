import { tool } from 'ai';
import { z } from 'zod';
import { X402_CONSTANTS } from '@darkresearch/mallory-shared';
import { createGridClient } from '../../../lib/gridClient.js';

/**
 * X402 Context for balance tools
 */
interface X402Context {
  gridSessionSecrets: any;
  gridSession: any;
}

/**
 * Check Wallet Balance Tool
 * Simple balance checker that works on both mainnet and devnet
 */
export function createCheckBalanceTool(x402Context?: X402Context) {
  return tool({
    description: `Check SOL and USDC balance for the connected wallet. Works on both mainnet and devnet.`,
    
    inputSchema: z.object({
      // No parameters needed - checks connected wallet
    }),

    execute: async () => {
      console.log('💰 [Balance] Checking wallet balance...');

      // Check if Grid session available
      if (!x402Context?.gridSessionSecrets || !x402Context?.gridSession) {
        return {
          success: false,
          error: 'Grid wallet not connected. Please connect your wallet first.'
        };
      }

      try {
        const { gridSession } = x402Context;
        const gridAddress = gridSession.address;

        console.log('💳 [Balance] Checking wallet:', gridAddress);

        const { PublicKey, Connection, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
        const { getAssociatedTokenAddress } = await import('@solana/spl-token');
        
        const connection = new Connection(
          process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
          'confirmed'
        );

        // Check SOL balance
        const solBalance = await connection.getBalance(new PublicKey(gridAddress));
        const solAmount = solBalance / LAMPORTS_PER_SOL;

        console.log('💰 [Balance] SOL:', solAmount);

        // Check USDC balance
        const usdcMint = new PublicKey(
          process.env.SOLANA_CLUSTER === 'devnet'
            ? 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr'  // Devnet USDC
            : X402_CONSTANTS.USDC_MINT  // Mainnet USDC
        );

        let usdcBalance = 0;
        try {
          const usdcAccount = await getAssociatedTokenAddress(
            usdcMint,
            new PublicKey(gridAddress),
            true
          );

          const balance = await connection.getTokenAccountBalance(usdcAccount);
          usdcBalance = parseFloat(balance.value.uiAmountString || '0');
        } catch (error) {
          console.log('💰 [Balance] No USDC account found (or balance is 0)');
          usdcBalance = 0;
        }

        console.log('💰 [Balance] USDC:', usdcBalance);

        const network = process.env.SOLANA_CLUSTER || 'devnet';
        const explorerUrl = `https://explorer.solana.com/address/${gridAddress}?cluster=${network}`;

        return {
          success: true,
          address: gridAddress,
          network,
          balances: {
            sol: solAmount,
            usdc: usdcBalance
          },
          message: `Your wallet has ${solAmount.toFixed(4)} SOL and ${usdcBalance.toFixed(2)} USDC on ${network}`,
          explorerUrl
        };

      } catch (error: any) {
        console.error('❌ [Balance] Check failed:', error);
        
        return {
          success: false,
          error: error.message || 'Balance check failed'
        };
      }
    }
  });
}

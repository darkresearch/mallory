/**
 * X402 Payment Service (Shared)
 * 
 * Used by both backend and tests
 * Proven to work - originally from test implementation
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { EphemeralWalletManager, type GridTokenSender } from './EphemeralWalletManager';
import type { X402PaymentRequirement } from './types';

export class X402PaymentService {
  private solanaRpcUrl: string;
  private solanaCluster: 'mainnet-beta' | 'devnet' | 'testnet';
  private usdcMint: string;
  private ephemeralFundingUsdc: string;
  private ephemeralFundingSol: string;
  private connection: Connection;

  constructor(config: {
    solanaRpcUrl: string;
    solanaCluster: 'mainnet-beta' | 'devnet' | 'testnet';
    usdcMint: string;
    ephemeralFundingUsdc: string;
    ephemeralFundingSol: string;
  }) {
    this.solanaRpcUrl = config.solanaRpcUrl;
    this.solanaCluster = config.solanaCluster;
    this.usdcMint = config.usdcMint;
    this.ephemeralFundingUsdc = config.ephemeralFundingUsdc;
    this.ephemeralFundingSol = config.ephemeralFundingSol;
    this.connection = new Connection(this.solanaRpcUrl, 'confirmed');
  }

  static shouldAutoApprove(amount: string, currency: string): boolean {
    // Auto-approve threshold: < 0.01 USD
    const numAmount = parseFloat(amount);
    return currency.toUpperCase() === 'USDC' && numAmount < 0.01;
  }

  async payAndFetchData(
    requirements: X402PaymentRequirement,
    gridWalletAddress: string,
    gridSender: GridTokenSender
  ): Promise<any> {
    const { apiUrl, method, headers, body } = requirements;

    console.log('🔄 [x402] Starting payment flow with ephemeral wallet...');
    console.log('✅ [x402] Grid address:', gridWalletAddress);

    // Create ephemeral wallet manager
    const walletManager = new EphemeralWalletManager(this.solanaRpcUrl, gridSender);

    // Step 1: Create ephemeral keypair
    const { keypair: ephemeralKeypair, address: ephemeralAddress } = walletManager.create();

    try {
      // Step 2: Fund ephemeral wallet from Grid
      console.log('💰 [x402] Funding ephemeral wallet from Grid...');
      const funding = await walletManager.fund(
        ephemeralAddress,
        this.ephemeralFundingUsdc,
        this.ephemeralFundingSol,
        this.usdcMint
      );
      
      console.log('✅ [x402] Funded ephemeral wallet');
      console.log('   USDC tx:', funding.usdcSignature.substring(0, 20) + '...');
      console.log('   SOL tx:', funding.solSignature.substring(0, 20) + '...');

      // Step 3: Load Faremeter libraries
      console.log('🔧 [x402] Loading Faremeter libraries...');
      const [
        { createLocalWallet },
        { createPaymentHandler },
        { wrap: wrapFetch },
        solanaInfo
      ] = await Promise.all([
        import('@faremeter/wallet-solana'),
        import('@faremeter/payment-solana/exact'),
        import('@faremeter/fetch'),
        import('@faremeter/info/solana')
      ]);

      // Step 4: Create Faremeter wallet from ephemeral keypair
      const corbitsWallet = await createLocalWallet(
        this.solanaCluster,  // "mainnet-beta"
        ephemeralKeypair as any
      );
      console.log('✅ [x402] Faremeter wallet created');

      // Step 5: Verify funds before creating payment handler
      console.log('🔍 [x402] Verifying funds are on-chain...');
      const verifySol = await this.connection.getBalance(ephemeralKeypair.publicKey);
      console.log('   SOL:', (verifySol / LAMPORTS_PER_SOL).toFixed(6));
      
      try {
        const verifyUsdAta = await getAssociatedTokenAddress(
          new PublicKey(this.usdcMint),
          ephemeralKeypair.publicKey
        );
        const verifyUsdBal = await this.connection.getTokenAccountBalance(verifyUsdAta);
        console.log('   USDC:', verifyUsdBal.value.uiAmountString);
        
        if (parseFloat(verifyUsdBal.value.uiAmountString || '0') < 0.001) {
          throw new Error('USDC still not visible - Grid transfer may have failed');
        }
      } catch (error: any) {
        if (error.message?.includes('could not find')) {
          throw new Error('USDC ATA not found - Grid transfer did not complete');
        }
        throw error;
      }
      console.log('✅ [x402] Funds confirmed on-chain!');

      // Step 6: Setup payment handler
      const usdcInfo = solanaInfo.lookupKnownSPLToken(this.solanaCluster, 'USDC');
      if (!usdcInfo) {
        throw new Error('USDC token info not found');
      }

      const mint = new PublicKey(usdcInfo.address);
      const paymentHandler = createPaymentHandler(
        corbitsWallet,
        mint,
        this.connection as any
      );
      console.log('✅ [x402] Payment handler created');

      // Step 7: Wrap fetch with payment handler
      const fetchWithPayer = wrapFetch(fetch, {
        handlers: [paymentHandler]
      });

      console.log('🌐 [x402] Making request (Faremeter will handle 402 automatically)...');

      // Step 8: Make request - Faremeter automatically handles payment
      const response = await fetchWithPayer(apiUrl, {
        method,
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`x402 API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ [x402] Data received successfully');

      // Step 9: Sweep funds back to Grid
      console.log('🧹 [x402] Sweeping ephemeral wallet back to Grid...');
      console.log('   Waiting 5s for funds to settle before sweep...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      try {
        const sweepResult = await walletManager.sweepAll(
          ephemeralKeypair,
          gridWalletAddress,
          this.usdcMint
        );
        console.log('✅ [x402] Sweep complete');
        console.log('   Recovered:', sweepResult.swept);
      } catch (sweepError) {
        console.warn('⚠️ [x402] Sweep failed:', sweepError);
        console.warn('   Funds may be stuck in:', ephemeralAddress);
      }

      console.log('✅ [x402] Payment flow complete!');
      return data;

    } catch (error) {
      console.error('❌ [x402] Payment flow FAILED:', error);
      
      // Attempt emergency cleanup
      console.log('🧹 [x402] Attempting emergency cleanup...');
      try {
        const walletManager = new EphemeralWalletManager(this.solanaRpcUrl, gridSender);
        await walletManager.sweepAll(
          ephemeralKeypair,
          gridWalletAddress,
          this.usdcMint
        );
        console.log('✅ [x402] Emergency cleanup successful');
      } catch (cleanupError) {
        console.warn('⚠️ [x402] Emergency cleanup failed (funds may be stuck):', ephemeralAddress);
      }
      
      throw error;
    }
  }
}


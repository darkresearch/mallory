import type { X402PaymentRequirement } from '@darkresearch/mallory-shared';
import { X402_CONSTANTS, PaymentUtils } from '@darkresearch/mallory-shared';
import { EphemeralWalletManager } from './EphemeralWalletManager';
import { gridClientService } from '../grid';
import { Connection, PublicKey } from '@solana/web3.js';

export class X402PaymentService {
  static shouldAutoApprove(amount: string, currency: string): boolean {
    return PaymentUtils.shouldAutoApprove(amount, currency);
  }

  static async payAndFetchData(requirements: X402PaymentRequirement, gridWalletAddress: string): Promise<any> {
    const { apiUrl, method, headers, body } = requirements;

    console.log('🔄 [x402] Starting payment flow with ephemeral wallet...');
    console.log('✅ [x402] Grid address (from WalletContext):', gridWalletAddress);

    // Step 1: Create ephemeral keypair
    const { keypair: ephemeralKeypair, address: ephemeralAddress } = EphemeralWalletManager.create();

    try {
      // Step 2: Fund ephemeral wallet from Grid
      console.log('💰 [x402] Funding ephemeral wallet from Grid...');
      await EphemeralWalletManager.fund(
        ephemeralAddress,
        X402_CONSTANTS.EPHEMERAL_FUNDING_USDC,
        X402_CONSTANTS.EPHEMERAL_FUNDING_SOL
      );

      // Wait for confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Load Faremeter libraries
      console.log('🔧 [x402] Loading Faremeter libraries...');
      const [
        { createLocalWallet },
        { createPaymentHandler, lookupX402Network },
        { wrap: wrapFetch },
        solanaInfo
      ] = await Promise.all([
        import('@faremeter/wallet-solana'),
        import('@faremeter/payment-solana/exact'),
        import('@faremeter/fetch'),
        import('@faremeter/info/solana')
      ]);

      // Step 4: Create Faremeter wallet from ephemeral keypair
      const x402Network = lookupX402Network(X402_CONSTANTS.SOLANA_CLUSTER);
      const corbitsWallet = await createLocalWallet(
        x402Network,
        ephemeralKeypair as any // Type assertion for @solana/web3.js version compatibility
      );
      console.log('✅ [x402] Faremeter wallet created');

      // Step 5: Setup payment handler
      const usdcInfo = solanaInfo.lookupKnownSPLToken(X402_CONSTANTS.SOLANA_CLUSTER, 'USDC');
      if (!usdcInfo) {
        throw new Error('USDC token info not found');
      }

      const connection = new Connection(X402_CONSTANTS.getSolanaRpcUrl(), 'confirmed');

      const mint = new PublicKey(usdcInfo.address);
      const paymentHandler = createPaymentHandler(
        corbitsWallet, 
        mint, 
        connection as any // Type assertion for Connection version compatibility
      );
      console.log('✅ [x402] Payment handler created');

      // Step 6: Wrap fetch with payment handler
      const fetchWithPayer = wrapFetch(fetch, {
        handlers: [paymentHandler]
      });

      console.log('🌐 [x402] Making request (Faremeter will handle 402 automatically)...');

      // Step 7: Make request - Faremeter automatically handles payment
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

      // Step 8: Sweep funds back to Grid
      console.log('🧹 [x402] Sweeping ephemeral wallet back to Grid...');
      await EphemeralWalletManager.sweepAll(
        ephemeralKeypair,
        gridWalletAddress,
        X402_CONSTANTS.USDC_MINT
      );

      console.log('✅ [x402] Payment flow complete!');
      return data;

    } catch (error) {
      console.error('❌ [x402] Payment flow FAILED:', error);
      
      // Attempt emergency cleanup
      console.log('🧹 [x402] Attempting emergency cleanup...');
      try {
        await EphemeralWalletManager.sweepAll(
          ephemeralKeypair,
          gridWalletAddress,
          X402_CONSTANTS.USDC_MINT
        );
        console.log('✅ [x402] Emergency cleanup successful');
      } catch (cleanupError) {
        console.error('⚠️ [x402] Emergency cleanup FAILED:', cleanupError);
        console.error('⚠️ WARNING: Funds may be stuck in ephemeral wallet:', ephemeralAddress);
      }
      
      throw error;
    }
  }
}


/**
 * X402 Payment Service (Test Version)
 * 
 * Same as production X402PaymentService but uses test-compatible dependencies
 * Based on apps/client/features/x402/x402PaymentService.ts
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { EphemeralWalletManagerTest } from './ephemeral-wallet-test';

// Get constants from environment
const SOLANA_RPC_URL = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // Mainnet USDC
const SOLANA_CLUSTER = 'mainnet-beta';

// Ephemeral wallet funding amounts (minimal for testing)
const EPHEMERAL_FUNDING_USDC = '0.01';   // 0.01 USDC (enough for ~10 Nansen calls)
const EPHEMERAL_FUNDING_SOL = '0.001';   // 0.001 SOL (enough for transaction fees)

export interface X402PaymentRequirement {
  needsPayment: true;
  toolName: string;
  apiUrl: string;
  method: string;
  headers: Record<string, string>;
  body: any;
  estimatedCost: {
    amount: string;
    currency: string;
  };
}

export class X402PaymentServiceTest {
  static shouldAutoApprove(amount: string, currency: string): boolean {
    // Auto-approve threshold: < 0.01 USD
    const numAmount = parseFloat(amount);
    return currency.toUpperCase() === 'USD' && numAmount < 0.01;
  }

  static async payAndFetchData(
    requirements: X402PaymentRequirement, 
    gridWalletAddress: string
  ): Promise<any> {
    const { apiUrl, method, headers, body } = requirements;

    console.log('🔄 [x402] Starting payment flow with ephemeral wallet...');
    console.log('✅ [x402] Grid address:', gridWalletAddress);

    // Step 1: Create ephemeral keypair
    const { keypair: ephemeralKeypair, address: ephemeralAddress } = 
      EphemeralWalletManagerTest.create();

    try {
      // Step 2: Fund ephemeral wallet from Grid
      console.log('💰 [x402] Funding ephemeral wallet from Grid...');
      const funding = await EphemeralWalletManagerTest.fund(
        ephemeralAddress,
        EPHEMERAL_FUNDING_USDC,
        EPHEMERAL_FUNDING_SOL
      );
      
      console.log('✅ [x402] Funded ephemeral wallet');
      console.log('   USDC tx:', funding.usdcSignature.substring(0, 20) + '...');
      console.log('   SOL tx:', funding.solSignature.substring(0, 20) + '...');
      console.log('   (Funds confirmed by Grid, should be on-chain)\n');

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
      // CRITICAL: Use "mainnet-beta" NOT "solana-mainnet-beta"
      // Faremeter's example uses "devnet" directly, not "solana-devnet"
      // The handler will match against wallet.network, so use the base cluster name
      const corbitsWallet = await createLocalWallet(
        SOLANA_CLUSTER,  // "mainnet-beta" not "solana-mainnet-beta"
        ephemeralKeypair as any
      );
      console.log('✅ [x402] Faremeter wallet created');
      console.log('   Ephemeral address:', ephemeralKeypair.publicKey.toBase58());
      console.log('   Wallet network:', (corbitsWallet as any).network);

      // Step 5: Wait 2s for funds to be on-chain (like Researcher)
      // NOTE: DO NOT increase this beyond 2-3s - if funds aren't visible, there's a different issue
      console.log('\n⏳ [x402] Waiting 2s for funds to settle (Solana is fast)...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify funds are visible before creating payment handler
      console.log('🔍 [x402] Verifying funds before creating payment handler...');
      const { Connection: VerifyConn, PublicKey: VerifyPK } = await import('@solana/web3.js');
      const { getAssociatedTokenAddress: getVerifyATA } = await import('@solana/spl-token');
      
      const verifyConn = new VerifyConn(SOLANA_RPC_URL, 'confirmed');
      const verifySOL = await verifyConn.getBalance(ephemeralKeypair.publicKey);
      console.log('   SOL:', (verifySOL / 1000000000).toFixed(6));
      
      try {
        const verifyUSDATA = await getVerifyATA(new VerifyPK(USDC_MINT), ephemeralKeypair.publicKey);
        const verifyUSDBal = await verifyConn.getTokenAccountBalance(verifyUSDATA);
        console.log('   USDC:', verifyUSDBal.value.uiAmountString);
        
        if (parseFloat(verifyUSDBal.value.uiAmountString || '0') < 0.001) {
          throw new Error('USDC still not visible - Grid transfer may have failed');
        }
      } catch (error: any) {
        if (error.message?.includes('could not find')) {
          throw new Error('USDC ATA not found - Grid transfer did not complete');
        }
        throw error;
      }
      console.log('✅ [x402] Funds confirmed on-chain!\n');

      // Step 6: Setup payment handler (AFTER verifying funds)
      console.log('🔧 [x402] Creating payment handler...');
      const usdcInfo = solanaInfo.lookupKnownSPLToken(SOLANA_CLUSTER, 'USDC');
      if (!usdcInfo) {
        throw new Error('USDC token info not found');
      }

      // Create connection for payment handler
      // CRITICAL: This is the connection Faremeter uses to check balances!
      const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
      const mint = new PublicKey(usdcInfo.address);
      
      console.log('   Payment handler config:');
      console.log('   - Wallet address:', ephemeralKeypair.publicKey.toBase58());
      console.log('   - USDC mint:', usdcInfo.address);
      console.log('   - Connection RPC:', SOLANA_RPC_URL);
      console.log('   - Connection commitment:', 'confirmed');
      
      const originalHandler = createPaymentHandler(
        corbitsWallet, 
        mint, 
        connection as any
      );
      console.log('✅ [x402] Original payment handler created');
      
      // Wrap handler with logging to debug why it returns 0 execers
      const paymentHandler = async (ctx: any, accepts: any[]) => {
        console.log('\n🔍 [DEBUG] Payment handler called');
        console.log('   Context:', ctx);
        console.log('   Accepts length:', accepts.length);
        console.log('   First accept:', JSON.stringify(accepts[0], null, 2));
        
        // Call original handler
        const result = await originalHandler(ctx, accepts);
        
        console.log('   Handler returned:', result.length, 'execers');
        
        if (result.length === 0) {
          console.log('\n❌ [DEBUG] Handler rejected all requirements!');
          console.log('   Handler expects:');
          console.log('     scheme: "exact"');
          console.log('     network:', (corbitsWallet as any).network);
          console.log('     asset:', mint.toBase58());
          console.log();
          console.log('   Nansen 402 provides:');
          console.log('     scheme:', accepts[0].scheme);
          console.log('     network:', accepts[0].network);
          console.log('     asset:', accepts[0].asset);
          console.log();
          console.log('   The filter/map logic rejected this.');
          console.log('   Possible reasons:');
          console.log('   1. Extra field validation failed');
          console.log('   2. Case sensitivity issue in matcher');
          console.log('   3. Version incompatibility');
          console.log();
          console.log('   Extra field:', JSON.stringify(accepts[0].extra));
        }
        
        return result;
      };
      
      console.log('   Handler wrapped with debug logging');
      
      // DEBUG: Let's see what Faremeter thinks about balances
      console.log('\n🔍 [x402] Testing if Faremeter can see balances...');
      console.log('   Checking via same connection Faremeter will use...');
      const debugSOL = await connection.getBalance(ephemeralKeypair.publicKey);
      console.log('   SOL (via Faremeter connection):', (debugSOL / 1000000000).toFixed(6));
      
      const { getAssociatedTokenAddress: debugGetATA } = await import('@solana/spl-token');
      const debugUSDATA = await debugGetATA(mint, ephemeralKeypair.publicKey);
      try {
        const debugUSDBal = await connection.getTokenAccountBalance(debugUSDATA);
        console.log('   USDC (via Faremeter connection):', debugUSDBal.value.uiAmountString);
      } catch (e: any) {
        console.log('   USDC error:', e.message);
      }

      // Step 6: MANUAL x402 PAYMENT (bypass wrap() to debug)
      console.log('🌐 [x402] Making initial request to get 402 response...');
      console.log('   URL:', apiUrl);
      console.log('   Method:', method);
      
      const initialResponse = await fetch(apiUrl, {
        method,
        headers,
        body: JSON.stringify(body)
      });
      
      console.log('   Response status:', initialResponse.status);
      
      if (initialResponse.status !== 402) {
        throw new Error(`Expected 402 but got ${initialResponse.status} - endpoint doesn't require payment?`);
      }
      
      // Parse 402 requirements
      console.log('\n🔍 [x402] Parsing 402 payment requirements...');
      const body402Text = await initialResponse.text();
      const payResp = JSON.parse(body402Text);
      console.log('   x402Version:', payResp.x402Version);
      console.log('   Accepts:', payResp.accepts.length, 'payment methods');
      console.log('   First accept:', JSON.stringify(payResp.accepts[0], null, 2));
      
      // Call handler DIRECTLY (this is what wrap() does internally)
      console.log('\n🔧 [x402] Calling payment handler directly...');
      const ctx = { request: apiUrl };
      const execers = await paymentHandler(ctx, payResp.accepts);
      
      console.log('   Handler returned:', execers.length, 'execers');
      
      if (execers.length === 0) {
        console.error('❌ PROBLEM: Handler returned 0 execers!');
        console.error('   Handler config:');
        console.error('     wallet.network:', (corbitsWallet as any).network);
        console.error('     mint:', usdcInfo.address);
        console.error('   402 requirement:');
        console.error('     scheme:', payResp.accepts[0].scheme);
        console.error('     network:', payResp.accepts[0].network);
        console.error('     asset:', payResp.accepts[0].asset);
        throw new Error('Payment handler did not match 402 requirements');
      }
      
      // Execute payment (build and sign transaction)
      console.log('\n💰 [x402] Executing payment...');
      const payer = execers[0];
      console.log('   Matched requirement:', payer.requirements.scheme, payer.requirements.network);
      
      const paymentResult = await payer.exec();
      console.log('✅ [x402] Payment transaction built');
      console.log('   Payload keys:', Object.keys(paymentResult.payload));
      
      // Build X-PAYMENT header manually
      console.log('\n🔐 [x402] Building X-PAYMENT header...');
      const xPaymentPayload = {
        x402Version: payResp.x402Version,
        scheme: payer.requirements.scheme,
        network: payer.requirements.network,
        asset: payer.requirements.asset,
        payload: paymentResult.payload
      };
      const xPaymentHeader = Buffer.from(JSON.stringify(xPaymentPayload)).toString('base64');
      console.log('   X-PAYMENT header length:', xPaymentHeader.length);
      
      // Retry request with payment
      console.log('\n🌐 [x402] Retrying request with payment header...');
      const response = await fetch(apiUrl, {
        method,
        headers: {
          ...headers,
          'X-PAYMENT': xPaymentHeader
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`x402 API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ [x402] Data received successfully');

      // Step 8: Sweep funds back to Grid
      console.log('🧹 [x402] Sweeping ephemeral wallet back to Grid...');
      console.log('   Waiting 5s for funds to be fully settled before sweep...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      try {
        const sweepResult = await EphemeralWalletManagerTest.sweepAll(
          ephemeralKeypair,
          gridWalletAddress,
          USDC_MINT
        );
        console.log('✅ [x402] Sweep complete');
        console.log('   Recovered:', sweepResult.swept);
      } catch (sweepError) {
        console.warn('⚠️  [x402] Sweep failed:', sweepError);
        console.warn('   Funds may be stuck in:', ephemeralAddress);
      }

      console.log('✅ [x402] Payment flow complete!');
      return data;

    } catch (error) {
      console.error('❌ [x402] Payment flow FAILED:', error);
      
      // Attempt emergency cleanup (best effort)
      console.log('🧹 [x402] Attempting emergency cleanup...');
      try {
        await EphemeralWalletManagerTest.sweepAll(
          ephemeralKeypair,
          gridWalletAddress,
          USDC_MINT
        );
        console.log('✅ [x402] Emergency cleanup successful');
      } catch (cleanupError) {
        console.warn('⚠️ [x402] Emergency cleanup failed (funds may be stuck):', ephemeralAddress);
      }
      
      throw error;
    }
  }
}


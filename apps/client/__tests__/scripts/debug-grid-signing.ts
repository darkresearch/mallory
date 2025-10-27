/**
 * Debug Grid Signing Issue
 * 
 * Tests the exact Grid signing flow used in x402 payments
 * Uses test account credentials to debug why production fails
 * 
 * Usage: cd apps/client/__tests__ && bun run scripts/debug-grid-signing.ts
 */

import '../setup/test-env';
import { loadGridSession } from '../setup/test-helpers';
import { GridClient } from '@sqds/grid';
import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  Connection,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';

// Grid SDK instance
const gridClient = new GridClient({
  environment: (process.env.EXPO_PUBLIC_GRID_ENV || 'production') as 'sandbox' | 'production',
  apiKey: process.env.EXPO_PUBLIC_GRID_API_KEY!,
  baseUrl: 'https://grid.squads.xyz'
});

async function testGridSigning() {
  console.log('🧪 Testing Grid Signing (Debug x402 Issue)');
  console.log('===========================================\n');

  // Load test Grid session
  console.log('📋 Step 1: Loading test Grid session...');
  const gridSession = await loadGridSession();
  
  console.log('✅ Grid session loaded:');
  console.log('   Address:', gridSession.address);
  console.log('   Has session secrets:', !!gridSession.sessionSecrets);
  console.log('   Has authentication:', !!gridSession.authentication);
  console.log('   Auth keys:', Object.keys(gridSession.authentication));
  console.log();

  // Create a test transaction (send tiny amount of SOL)
  const connection = new Connection(
    process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    'confirmed'
  );

  const TEST_RECIPIENT = 'DKyLy3xtdz2CxARorAruBYsQgpWjE2TErzye9X8iLMy6'; // Random test address
  const SOL_AMOUNT = '0.001'; // Tiny test amount

  console.log('📋 Step 2: Building test transaction...');
  console.log('   From:', gridSession.address);
  console.log('   To:', TEST_RECIPIENT);
  console.log('   Amount:', SOL_AMOUNT, 'SOL');
  console.log();

  try {
    // Build SOL transfer instruction
    const lamports = parseFloat(SOL_AMOUNT) * LAMPORTS_PER_SOL;
    const instruction = SystemProgram.transfer({
      fromPubkey: new PublicKey(gridSession.address),
      toPubkey: new PublicKey(TEST_RECIPIENT),
      lamports
    });

    const { blockhash } = await connection.getLatestBlockhash('confirmed');

    const message = new TransactionMessage({
      payerKey: new PublicKey(gridSession.address),
      recentBlockhash: blockhash,
      instructions: [instruction]
    }).compileToV0Message();

    const transaction = new VersionedTransaction(message);
    const serialized = Buffer.from(transaction.serialize()).toString('base64');

    console.log('✅ Transaction built successfully');
    console.log();

    // Step 3: Prepare with Grid
    console.log('📋 Step 3: Preparing transaction with Grid SDK...');
    const transactionPayload = await gridClient.prepareArbitraryTransaction(
      gridSession.address,
      {
        transaction: serialized,
        fee_config: {
          currency: 'sol',
          payer_address: gridSession.address,
          self_managed_fees: false
        }
      }
    );

    if (!transactionPayload || !transactionPayload.data) {
      throw new Error('Failed to prepare transaction');
    }

    console.log('✅ Transaction prepared with Grid');
    console.log();

    // Step 4: Sign and send (THIS IS WHERE IT FAILS IN PRODUCTION)
    console.log('📋 Step 4: Signing and sending with Grid SDK...');
    console.log('   Session secrets keys:', Object.keys(gridSession.sessionSecrets));
    console.log('   Session auth keys:', Object.keys(gridSession.authentication));
    console.log();

    const result = await gridClient.signAndSend({
      sessionSecrets: gridSession.sessionSecrets,
      session: gridSession.authentication,
      transactionPayload: transactionPayload.data,
      address: gridSession.address
    });

    console.log('✅ Transaction signed and sent successfully!');
    console.log('   Signature:', result.transaction_signature);
    console.log();
    console.log('🎉 SUCCESS! Grid signing works with test credentials.');
    console.log();
    console.log('📊 Analysis:');
    console.log('   - Test account Grid signing: ✅ Works');
    console.log('   - Production account Grid signing: ❌ Fails');
    console.log();
    console.log('💡 Next steps:');
    console.log('   1. Compare test vs production Grid session structure');
    console.log('   2. Check if production session needs refresh');
    console.log('   3. Verify production session secrets are valid');

  } catch (error: any) {
    console.error('❌ Grid signing FAILED!\n');
    console.error('Error type:', error.constructor.name);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error();
    
    if (error.details) {
      console.error('Error details:', JSON.stringify(error.details, null, 2));
      console.error();
    }

    if (error.provider) {
      console.error('Provider:', error.provider);
      console.error();
    }
    
    console.error('Full error object:');
    console.error(error);
    console.error();
    
    console.error('📊 Analysis:');
    console.error('   This is the SAME error production sees!');
    console.error();
    console.error('💡 Possible causes:');
    console.error('   1. Session secrets expired or invalid');
    console.error('   2. Authentication object missing required fields');
    console.error('   3. Grid account needs re-authentication');
    console.error('   4. Privy provider configuration issue');
    console.error();
    console.error('🔧 Try this:');
    console.error('   bun run scripts/refresh-grid-session.ts');
    
    process.exit(1);
  }
}

testGridSigning();


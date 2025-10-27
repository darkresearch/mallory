/**
 * Test Grid Signing for x402 Payments
 * 
 * This script tests the exact same Grid signing flow that x402 uses,
 * but runs directly on the backend for faster debugging.
 * 
 * Usage: bun run test-grid-signing.ts
 */

import { GridClient } from '@sqds/grid';
import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  Connection,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';

// Grid SDK instance
const gridClient = new GridClient({
  environment: (process.env.GRID_ENV || 'production') as 'sandbox' | 'production',
  apiKey: process.env.GRID_API_KEY!,
  baseUrl: 'https://grid.squads.xyz'
});

async function testGridSigning() {
  console.log('🧪 Testing Grid Signing for x402 Payments');
  console.log('==========================================\n');

  // Get Grid session data from environment or prompt
  const GRID_ADDRESS = process.env.TEST_GRID_ADDRESS || 'CyDU8g1fLDzUDd5whq4BVEdBrUPYgeC1TRinGase38b3';
  const GRID_SESSION_SECRETS = process.env.TEST_GRID_SESSION_SECRETS;
  const GRID_SESSION_AUTH = process.env.TEST_GRID_SESSION_AUTH;

  if (!GRID_SESSION_SECRETS || !GRID_SESSION_AUTH) {
    console.error('❌ Missing required environment variables:');
    console.error('   - TEST_GRID_SESSION_SECRETS');
    console.error('   - TEST_GRID_SESSION_AUTH');
    console.error('\nTo get these values:');
    console.error('   1. Login to the app through browser');
    console.error('   2. Open browser console');
    console.error('   3. Run: await (await import("../lib/storage")).secureStorage.getItem("grid_session_secrets")');
    console.error('   4. Run: await (await import("../lib/storage")).secureStorage.getItem("grid_account")');
    console.error('   5. Set the env vars and run this script again');
    process.exit(1);
  }

  const sessionSecrets = JSON.parse(GRID_SESSION_SECRETS);
  const session = JSON.parse(GRID_SESSION_AUTH);

  console.log('📋 Test Configuration:');
  console.log('   Grid Address:', GRID_ADDRESS);
  console.log('   Has Session Secrets:', !!sessionSecrets);
  console.log('   Has Session Auth:', !!session);
  console.log('   Session Keys:', Object.keys(session));
  console.log();

  // Create a test transaction (send tiny amount of SOL to self)
  const connection = new Connection(
    process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    'confirmed'
  );

  const TEST_RECIPIENT = 'DKyLy3xtdz2CxARorAruBYsQgpWjE2TErzye9X8iLMy6'; // Random address
  const SOL_AMOUNT = '0.001'; // 0.001 SOL test

  console.log('🔨 Building test transaction...');
  console.log('   From:', GRID_ADDRESS);
  console.log('   To:', TEST_RECIPIENT);
  console.log('   Amount:', SOL_AMOUNT, 'SOL');
  console.log();

  try {
    // Build SOL transfer instruction
    const lamports = parseFloat(SOL_AMOUNT) * LAMPORTS_PER_SOL;
    const instruction = SystemProgram.transfer({
      fromPubkey: new PublicKey(GRID_ADDRESS),
      toPubkey: new PublicKey(TEST_RECIPIENT),
      lamports
    });

    const { blockhash } = await connection.getLatestBlockhash('confirmed');

    const message = new TransactionMessage({
      payerKey: new PublicKey(GRID_ADDRESS),
      recentBlockhash: blockhash,
      instructions: [instruction]
    }).compileToV0Message();

    const transaction = new VersionedTransaction(message);
    const serialized = Buffer.from(transaction.serialize()).toString('base64');

    console.log('✅ Transaction built');
    console.log('   Blockhash:', blockhash.substring(0, 20) + '...');
    console.log('   Serialized length:', serialized.length, 'bytes');
    console.log();

    // Step 1: Prepare transaction with Grid
    console.log('📤 Step 1: Preparing transaction with Grid...');
    const transactionPayload = await gridClient.prepareArbitraryTransaction(
      GRID_ADDRESS,
      {
        transaction: serialized,
        fee_config: {
          currency: 'sol',
          payer_address: GRID_ADDRESS,
          self_managed_fees: false
        }
      }
    );

    if (!transactionPayload || !transactionPayload.data) {
      throw new Error('Failed to prepare transaction');
    }

    console.log('✅ Transaction prepared with Grid');
    console.log('   Payload keys:', Object.keys(transactionPayload.data));
    console.log();

    // Step 2: Sign and send
    console.log('✍️  Step 2: Signing and sending...');
    console.log('   Using session secrets');
    console.log('   Session auth structure:', Object.keys(session));
    console.log();

    const result = await gridClient.signAndSend({
      sessionSecrets,
      session,
      transactionPayload: transactionPayload.data,
      address: GRID_ADDRESS
    });

    console.log('✅ Transaction signed and sent!');
    console.log('   Signature:', result.transaction_signature);
    console.log();
    console.log('🎉 SUCCESS! Grid signing works correctly.');
    console.log('   The issue must be elsewhere in the x402 flow.');

  } catch (error: any) {
    console.error('❌ Grid signing FAILED');
    console.error();
    console.error('Error details:');
    console.error('   Message:', error.message);
    console.error('   Code:', error.code);
    console.error('   Provider:', error.provider);
    console.error();
    
    if (error.details) {
      console.error('   Details:', JSON.stringify(error.details, null, 2));
    }
    
    console.error();
    console.error('Full error:', error);
    console.error();
    console.error('💡 Debugging suggestions:');
    console.error('   1. Check if session secrets are current (may need to re-auth)');
    console.error('   2. Verify session authentication object structure');
    console.error('   3. Check Grid account status in Grid dashboard');
    console.error('   4. Try refreshing the Grid session');
    
    process.exit(1);
  }
}

testGridSigning().catch(console.error);


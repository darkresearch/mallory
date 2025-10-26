#!/usr/bin/env node

/**
 * AI Agent Test Runner
 * 
 * Simplified test runner that works in Node.js environment
 * Tests x402 payment flow using file-based storage
 */

const { TestGridClientService, checkTestEnvironment } = require('../utils/test-storage.ts');
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { getAssociatedTokenAddress } = require('@solana/spl-token');

// Configuration
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const NETWORK = process.env.TEST_NETWORK || 'mainnet';
const RPC_URL = NETWORK === 'mainnet'
  ? process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
  : 'https://api.devnet.solana.com';

async function main() {
  console.log('🧪 AI Agent x402 Test Runner\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Step 1: Check environment
  console.log('📋 Step 1: Checking test environment...\n');
  const envCheck = await checkTestEnvironment();
  
  console.log(envCheck.details);
  console.log('');
  
  if (!envCheck.ready) {
    console.error('❌ Test environment not ready!');
    console.error('\nMissing:');
    envCheck.missing.forEach(item => console.error(`  - ${item}`));
    console.error('\n📚 See AI_AGENT_TEST_SETUP.md for setup instructions\n');
    process.exit(1);
  }

  console.log('✅ Test environment ready!\n');

  // Step 2: Load Grid wallet
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Step 2: Loading Grid wallet...\n');

  const testClient = new TestGridClientService();
  const account = await testClient.getAccount();
  
  if (!account || !account.address) {
    console.error('❌ Failed to load Grid account');
    process.exit(1);
  }

  const walletAddress = account.address;
  console.log('✅ Grid wallet loaded');
  console.log('📍 Address:', walletAddress);
  console.log('');

  // Step 3: Check balances
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Step 3: Checking wallet balances...\n');

  const connection = new Connection(RPC_URL, 'confirmed');
  console.log('🌐 Network:', NETWORK);
  console.log('🔗 RPC:', RPC_URL);
  console.log('');

  // Check SOL balance
  const solBalance = await connection.getBalance(new PublicKey(walletAddress));
  const sol = solBalance / LAMPORTS_PER_SOL;
  
  console.log('💰 SOL Balance:', sol.toFixed(4), 'SOL');

  if (sol < 0.01) {
    console.error('❌ Insufficient SOL balance! Need at least 0.01 SOL');
    console.error('   Send SOL to:', walletAddress);
    process.exit(1);
  }

  // Check USDC balance
  try {
    const usdcMint = new PublicKey(USDC_MINT);
    const tokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      new PublicKey(walletAddress)
    );
    
    const usdcBalance = await connection.getTokenAccountBalance(tokenAccount);
    const usdc = parseFloat(usdcBalance.value.uiAmountString || '0');
    
    console.log('💵 USDC Balance:', usdc.toFixed(2), 'USDC');
    console.log('');

    if (usdc < 0.5) {
      console.error('❌ Insufficient USDC balance! Need at least 0.5 USDC');
      console.error('   Send USDC to:', walletAddress);
      process.exit(1);
    }

    console.log('✅ Wallet has sufficient funds for testing!\n');

  } catch (error) {
    console.error('❌ Error checking USDC balance:', error.message);
    console.error('   USDC token account may not exist');
    console.error('   Send USDC to:', walletAddress);
    process.exit(1);
  }

  // Step 4: Ready to test
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ All checks passed! Ready to run x402 tests\n');

  console.log('💡 Next steps:');
  console.log('   1. Grid wallet is configured and funded');
  console.log('   2. Can now run full x402 payment tests');
  console.log('   3. Tests will use real mainnet transactions');
  console.log('   4. Small amounts will be used (~$0.10 per test)\n');

  console.log('📊 Summary:');
  console.log('   Wallet:', walletAddress);
  console.log('   SOL:', sol.toFixed(4));
  console.log('   USDC:', usdc.toFixed(2));
  console.log('   Network:', NETWORK);
  console.log('   Status: ✅ READY\n');
}

main().catch(error => {
  console.error('\n❌ Test runner failed:', error);
  process.exit(1);
});

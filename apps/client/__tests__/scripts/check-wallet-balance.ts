#!/usr/bin/env bun

/**
 * Check Test Wallet Balance
 * 
 * Quick utility to check the current balance of the test Grid wallet.
 */

import { gridClientService } from '../features/grid/services/gridClient';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { X402_CONSTANTS } from '@darkresearch/mallory-shared';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  log('\n╔════════════════════════════════════════╗', 'bright');
  log('║       Test Wallet Balance Check        ║', 'bright');
  log('╚════════════════════════════════════════╝\n', 'bright');

  // Get Grid account
  const account = await gridClientService.getAccount();
  
  if (!account) {
    log('❌ No Grid wallet found in test environment', 'red');
    log('\nRun setup first:', 'yellow');
    log('  bun run test:setup:interactive\n', 'blue');
    process.exit(1);
  }

  const address = account.address;
  log(`📍 Wallet Address: ${address}\n`, 'bright');

  // Connect to network
  const network = process.env.TEST_NETWORK || 'mainnet';
  const rpcUrl = network === 'mainnet' 
    ? 'https://api.mainnet-beta.solana.com'
    : 'https://api.devnet.solana.com';
  
  const connection = new Connection(rpcUrl, 'confirmed');
  log(`🌐 Network: ${network}`, 'blue');
  log(`🔗 RPC: ${rpcUrl}\n`, 'blue');

  // Check SOL balance
  log('💰 Checking SOL balance...', 'blue');
  const solBalance = await connection.getBalance(new PublicKey(address));
  const sol = solBalance / LAMPORTS_PER_SOL;
  log(`   ${sol.toFixed(6)} SOL`, sol >= 0.01 ? 'green' : 'red');

  // Check USDC balance
  log('\n💵 Checking USDC balance...', 'blue');
  let usdc = 0;
  try {
    const usdcMint = new PublicKey(X402_CONSTANTS.USDC_MINT);
    const tokenAccount = await getAssociatedTokenAddress(usdcMint, new PublicKey(address));
    const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);
    usdc = parseFloat(tokenBalance.value.uiAmountString || '0');
    log(`   ${usdc.toFixed(2)} USDC`, usdc >= 1.0 ? 'green' : 'red');
  } catch (error) {
    log('   No USDC token account found', 'red');
  }

  // Check if sufficient for testing
  log('\n╔════════════════════════════════════════╗', 'bright');
  log('║            Status Summary              ║', 'bright');
  log('╚════════════════════════════════════════╝\n', 'bright');

  const minSol = parseFloat(process.env.TEST_WALLET_MIN_SOL || '0.01');
  const minUsdc = parseFloat(process.env.TEST_WALLET_MIN_USDC || '1.0');

  const solSufficient = sol >= minSol;
  const usdcSufficient = usdc >= minUsdc;

  log(`SOL:  ${solSufficient ? '✅' : '❌'} ${sol.toFixed(6)} SOL (min: ${minSol})`, 
      solSufficient ? 'green' : 'red');
  log(`USDC: ${usdcSufficient ? '✅' : '❌'} ${usdc.toFixed(2)} USDC (min: ${minUsdc})`, 
      usdcSufficient ? 'green' : 'red');

  if (solSufficient && usdcSufficient) {
    log('\n✅ Wallet is ready for testing!', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Wallet needs more funds', 'yellow');
    
    if (!solSufficient) {
      log(`   • Send ${(minSol - sol).toFixed(6)} more SOL`, 'yellow');
    }
    if (!usdcSufficient) {
      log(`   • Send ${(minUsdc - usdc).toFixed(2)} more USDC`, 'yellow');
    }
    
    log(`\n📍 Send to: ${address}\n`, 'blue');
    process.exit(1);
  }
}

main().catch((error) => {
  log('\n❌ Error checking wallet:', 'red');
  log(error instanceof Error ? error.message : String(error), 'red');
  process.exit(1);
});

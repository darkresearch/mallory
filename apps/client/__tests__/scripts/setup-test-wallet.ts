#!/usr/bin/env bun

/**
 * Interactive Test Wallet Setup Script
 * 
 * This script helps set up a Grid wallet for e2e testing.
 * It handles:
 * 1. Grid account creation
 * 2. OTP verification
 * 3. Session secrets storage
 * 4. Balance verification
 */

import { gridClientService } from '../features/grid/services/gridClient';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { X402_CONSTANTS } from '@darkresearch/mallory-shared';
import * as readline from 'readline';

// Terminal colors
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

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${colors.blue}${question}${colors.reset} `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  log('\n╔════════════════════════════════════════╗', 'bright');
  log('║  Grid Test Wallet Setup (Interactive) ║', 'bright');
  log('╚════════════════════════════════════════╝\n', 'bright');

  // Step 1: Check if wallet already exists
  log('📋 Step 1: Checking for existing Grid wallet...', 'blue');
  const existingAccount = await gridClientService.getAccount();
  
  if (existingAccount) {
    log('\n✅ Grid wallet already exists!', 'green');
    log(`📍 Address: ${existingAccount.address}`, 'bright');
    
    const useExisting = await prompt('\nUse this wallet for testing? (y/n):');
    
    if (useExisting.toLowerCase() !== 'y') {
      log('\n⚠️  Clearing existing wallet...', 'yellow');
      await gridClientService.clearAccount();
      log('✅ Wallet cleared. Proceeding with new setup...', 'green');
    } else {
      await verifyAndDisplayBalance(existingAccount.address);
      return;
    }
  }

  // Step 2: Create new Grid account
  log('\n📋 Step 2: Creating Grid account...', 'blue');
  log('This will send an OTP code to your email.\n', 'yellow');
  
  const email = await prompt('Enter test email address:');
  
  if (!email.includes('@')) {
    log('\n❌ Invalid email address', 'red');
    process.exit(1);
  }

  log(`\n🔐 Creating Grid account for: ${email}...`, 'blue');
  
  try {
    const { user, sessionSecrets } = await gridClientService.createAccount(email);
    
    log('\n✅ Account creation initiated!', 'green');
    log('📧 Check your email for the OTP code.', 'bright');
    
    // Step 3: Verify OTP
    log('\n📋 Step 3: Verifying OTP...', 'blue');
    const otpCode = await prompt('Enter OTP code from email:');
    
    if (!otpCode || otpCode.length < 4) {
      log('\n❌ Invalid OTP code', 'red');
      process.exit(1);
    }

    log('\n🔐 Verifying OTP...', 'blue');
    const authResult = await gridClientService.verifyAccount(user, otpCode);
    
    if (!authResult.success || !authResult.data) {
      log('\n❌ OTP verification failed', 'red');
      log(`Error: ${JSON.stringify(authResult)}`, 'red');
      process.exit(1);
    }

    log('\n✅ Grid account created successfully!', 'green');
    log(`📍 Address: ${authResult.data.address}`, 'bright');
    
    // Step 4: Display funding instructions
    await displayFundingInstructions(authResult.data.address);
    
    // Step 5: Wait for funding
    log('\n📋 Step 4: Waiting for wallet funding...', 'blue');
    await waitForFunding(authResult.data.address);
    
    // Step 6: Verify balance
    await verifyAndDisplayBalance(authResult.data.address);
    
    // Step 7: Success
    log('\n╔════════════════════════════════════════╗', 'green');
    log('║     Test Wallet Setup Complete! ✅     ║', 'green');
    log('╚════════════════════════════════════════╝\n', 'green');
    
    log('You can now run e2e tests:', 'bright');
    log('  bun test __tests__/e2e/', 'blue');
    log('');

  } catch (error) {
    log('\n❌ Error during setup:', 'red');
    log(error instanceof Error ? error.message : String(error), 'red');
    process.exit(1);
  }
}

async function displayFundingInstructions(address: string) {
  log('\n╔════════════════════════════════════════╗', 'yellow');
  log('║       IMPORTANT: Fund Test Wallet      ║', 'yellow');
  log('╚════════════════════════════════════════╝\n', 'yellow');
  
  log('📍 Wallet Address:', 'bright');
  log(`   ${address}\n`, 'green');
  
  log('💰 Required Funding:', 'bright');
  log('   • 0.1 SOL (for transaction fees)', 'yellow');
  log('   • 5 USDC (for x402 test payments)\n', 'yellow');
  
  log('📲 How to fund:', 'bright');
  log('   1. Open any Solana wallet (Phantom, Solflare, etc.)', 'blue');
  log('   2. Send 0.1 SOL to the address above', 'blue');
  log('   3. Send 5 USDC to the address above', 'blue');
  log('   4. Wait for confirmation (~30 seconds)\n', 'blue');
  
  log('💡 Tip: You can use https://solscan.io to verify transfers\n', 'yellow');
}

async function waitForFunding(address: string) {
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  const maxAttempts = 60; // 5 minutes
  let attempts = 0;
  
  log('⏳ Waiting for SOL and USDC deposits...', 'blue');
  log('   (This will check every 5 seconds)\n', 'yellow');
  
  while (attempts < maxAttempts) {
    attempts++;
    
    try {
      // Check SOL balance
      const solBalance = await connection.getBalance(new PublicKey(address));
      const sol = solBalance / LAMPORTS_PER_SOL;
      
      // Check USDC balance
      let usdc = 0;
      try {
        const usdcMint = new PublicKey(X402_CONSTANTS.USDC_MINT);
        const tokenAccount = await getAssociatedTokenAddress(usdcMint, new PublicKey(address));
        const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);
        usdc = parseFloat(tokenBalance.value.uiAmountString || '0');
      } catch (error) {
        // Token account doesn't exist yet
      }
      
      // Display current status
      process.stdout.write(`\r   SOL: ${sol.toFixed(4)} | USDC: ${usdc.toFixed(2)} `);
      
      // Check if funded
      if (sol >= 0.05 && usdc >= 1.0) {
        log('\n\n✅ Wallet funded!', 'green');
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } catch (error) {
      // Continue waiting
    }
  }
  
  log('\n\n⚠️  Timeout waiting for funding', 'yellow');
  log('You can manually verify the balance later with:', 'yellow');
  log('  bun run test:wallet:check\n', 'blue');
}

async function verifyAndDisplayBalance(address: string) {
  log('\n📋 Verifying wallet balance...', 'blue');
  
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  
  // SOL balance
  const solBalance = await connection.getBalance(new PublicKey(address));
  const sol = solBalance / LAMPORTS_PER_SOL;
  
  // USDC balance
  let usdc = 0;
  try {
    const usdcMint = new PublicKey(X402_CONSTANTS.USDC_MINT);
    const tokenAccount = await getAssociatedTokenAddress(usdcMint, new PublicKey(address));
    const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);
    usdc = parseFloat(tokenBalance.value.uiAmountString || '0');
  } catch (error) {
    log('\n⚠️  USDC token account not found', 'yellow');
  }
  
  log('\n╔════════════════════════════════════════╗', 'bright');
  log('║         Current Wallet Balance         ║', 'bright');
  log('╚════════════════════════════════════════╝\n', 'bright');
  
  log(`💰 SOL Balance:  ${sol.toFixed(4)} SOL`, sol >= 0.05 ? 'green' : 'red');
  log(`💵 USDC Balance: ${usdc.toFixed(2)} USDC\n`, usdc >= 1.0 ? 'green' : 'red');
  
  // Check if sufficient
  const sufficient = sol >= 0.05 && usdc >= 1.0;
  
  if (sufficient) {
    log('✅ Wallet has sufficient funds for testing!', 'green');
  } else {
    log('⚠️  Wallet needs more funds:', 'yellow');
    if (sol < 0.05) {
      log(`   • Need ${(0.05 - sol).toFixed(4)} more SOL`, 'yellow');
    }
    if (usdc < 1.0) {
      log(`   • Need ${(1.0 - usdc).toFixed(2)} more USDC`, 'yellow');
    }
  }
  
  log('');
}

// Run the script
main().catch((error) => {
  log('\n❌ Fatal error:', 'red');
  log(error instanceof Error ? error.message : String(error), 'red');
  process.exit(1);
});

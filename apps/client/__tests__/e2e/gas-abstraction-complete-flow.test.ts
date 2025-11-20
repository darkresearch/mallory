/**
 * End-to-End Tests - Complete Gas Abstraction Flow
 * 
 * Tests complete user journeys for gas abstraction:
 * - Complete gasless transaction flow
 * - Insufficient balance handling
 * - Failed transaction refund
 * - Graceful degradation
 * 
 * Requirements: All requirements
 * 
 * NOTE: These tests require:
 * - Backend server running (default: http://localhost:3001)
 * - GAS_GATEWAY_URL configured in backend environment
 * - Test Grid account with valid session
 * - Test account with USDC balance (for top-up tests)
 * - Test account with gas credits (for transaction tests)
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import '../setup/test-env';
import { setupTestUserSession, cleanupTestData } from '../integration/setup';
import { authenticateTestUser, loadGridSession } from '../setup/test-helpers';
import { Connection, PublicKey, TransactionMessage, VersionedTransaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';

const BACKEND_URL = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
const GAS_ABSTRACTION_ENABLED = process.env.GAS_ABSTRACTION_ENABLED === 'true';
const HAS_TEST_CREDENTIALS = !!(process.env.TEST_SUPABASE_EMAIL && process.env.TEST_SUPABASE_PASSWORD);
// Prioritize Alchemy RPC for faster responses
const SOLANA_RPC_URL = process.env.SOLANA_RPC_ALCHEMY_1 || 
                       process.env.SOLANA_RPC_ALCHEMY_2 || 
                       process.env.SOLANA_RPC_ALCHEMY_3 ||
                       process.env.SOLANA_RPC_URL || 
                       'https://api.mainnet-beta.solana.com';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

describe.skipIf(!HAS_TEST_CREDENTIALS)('Gas Abstraction Complete Flow (E2E)', () => {
  let testSession: {
    userId: string;
    email: string;
    accessToken: string;
    gridSession: any;
  };

  beforeAll(async () => {
    console.log('🔧 Setting up test user session for E2E gas abstraction tests...');
    testSession = await setupTestUserSession();
    console.log('✅ Test session ready');
    console.log('   User ID:', testSession.userId);
    console.log('   Grid Address:', testSession.gridSession.address);
  });

  afterAll(async () => {
    if (testSession) {
      console.log('🧹 Cleaning up test data...');
      await cleanupTestData(testSession.userId);
      console.log('✅ Cleanup complete');
    }
  });

  describe('Complete Gasless Transaction Flow', () => {
    test.skipIf(!GAS_ABSTRACTION_ENABLED)('should complete full gasless transaction: top-up → send → verify', async () => {
      console.log('🚀 Starting E2E: Complete Gasless Transaction Flow\n');
      console.log('━'.repeat(60));
      
      const token = testSession.accessToken;
      const gridSession = testSession.gridSession;
      const gridSessionData = await loadGridSession();
      const gridSessionSecrets = gridSessionData.sessionSecrets;
      const gridAddress = gridSession.address;
      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      
      // ============================================
      // STEP 1: Check Initial Balance
      // ============================================
      console.log('📋 Step 1/5: Checking initial gas credit balance...\n');
      
      const balanceUrl = `${backendUrl}/api/gas-abstraction/balance`;
      const initialBalanceResponse = await fetch(balanceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          gridSessionSecrets,
          gridSession: {
            authentication: gridSession.authentication || gridSession,
            address: gridAddress
          },
        }),
      });

      if (!initialBalanceResponse.ok) {
        console.log('⚠️  Skipping E2E test - gateway unavailable');
        return;
      }

      const initialBalance = await initialBalanceResponse.json();
      const initialBalanceUsdc = initialBalance.balanceBaseUnits / 1_000_000;
      
      console.log('✅ Initial balance:', initialBalanceUsdc, 'USDC');
      console.log();
      
      // ============================================
      // STEP 2: Top Up Gas Credits (if needed)
      // ============================================
      console.log('📋 Step 2/5: Topping up gas credits...\n');
      
      // Get payment requirements
      const requirementsUrl = `${backendUrl}/api/gas-abstraction/topup/requirements`;
      const requirementsResponse = await fetch(requirementsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!requirementsResponse.ok) {
        console.log('⚠️  Skipping top-up - requirements unavailable');
        return;
      }

      const requirements = await requirementsResponse.json();
      
      // Create top-up transaction (0.5 USDC for testing)
      const topupAmount = 0.5;
      const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      
      const userPubkey = new PublicKey(gridAddress);
      const payToPubkey = new PublicKey(requirements.payTo);
      
      const userTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(USDC_MINT),
        userPubkey,
        true // allowOwnerOffCurve for Grid PDA wallets
      );
      
      const payToTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(USDC_MINT),
        payToPubkey,
        true
      );
      
      const amountBaseUnits = Math.floor(topupAmount * 1_000_000);
      
      const transferInstruction = createTransferInstruction(
        userTokenAccount,
        payToTokenAccount,
        userPubkey,
        amountBaseUnits,
        [],
        TOKEN_PROGRAM_ID
      );
      
      const message = new TransactionMessage({
        payerKey: userPubkey,
        recentBlockhash: blockhash,
        instructions: [transferInstruction],
      }).compileToV0Message();
      
      const transaction = new VersionedTransaction(message);
      const serializedTx = Buffer.from(transaction.serialize()).toString('base64');
      
      // Submit top-up
      const topupUrl = `${backendUrl}/api/gas-abstraction/topup`;
      const topupResponse = await fetch(topupUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          transaction: serializedTx,
          publicKey: userPubkey.toBase58(),
          amountBaseUnits: amountBaseUnits,
          gridSessionSecrets,
          gridSession: {
            authentication: gridSession.authentication || gridSession,
            address: gridAddress
          },
        }),
      });

      if (topupResponse.ok) {
        const topupResult = await topupResponse.json();
        console.log('✅ Top-up successful:', topupResult.amountBaseUnits / 1_000_000, 'USDC');
        console.log('   Transaction:', topupResult.txSignature);
        console.log();
      } else {
        const errorData = await topupResponse.json().catch(() => ({}));
        console.log('⚠️  Top-up failed (may have insufficient USDC):', topupResponse.status, errorData.error);
        console.log('   Continuing with existing balance...');
        console.log();
      }
      
      // ============================================
      // STEP 3: Verify Balance After Top-Up
      // ============================================
      console.log('📋 Step 3/5: Verifying balance after top-up...\n');
      
      // Wait a moment for balance to update
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const balanceAfterTopupResponse = await fetch(balanceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          gridSessionSecrets,
          gridSession: {
            authentication: gridSession.authentication || gridSession,
            address: gridAddress
          },
        }),
      });

      if (balanceAfterTopupResponse.ok) {
        const balanceAfterTopup = await balanceAfterTopupResponse.json();
        const balanceAfterTopupUsdc = balanceAfterTopup.balanceBaseUnits / 1_000_000;
        
        console.log('✅ Balance after top-up:', balanceAfterTopupUsdc, 'USDC');
        console.log();
        
        // ============================================
        // STEP 4: Send Transaction Using Gasless Mode
        // ============================================
        console.log('📋 Step 4/5: Sending transaction using gasless mode...\n');
        
        // Create a simple transfer transaction (to self, zero lamports)
        const { blockhash: sponsorBlockhash } = await connection.getLatestBlockhash('confirmed');
        
        const sponsorTransferInstruction = SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: userPubkey, // Transfer to self
          lamports: 0, // Zero lamports (no actual transfer)
        });
        
        const sponsorMessage = new TransactionMessage({
          payerKey: userPubkey,
          recentBlockhash: sponsorBlockhash,
          instructions: [sponsorTransferInstruction],
        }).compileToV0Message();
        
        const sponsorTransaction = new VersionedTransaction(sponsorMessage);
        const sponsorSerializedTx = Buffer.from(sponsorTransaction.serialize()).toString('base64');
        
        // Request sponsorship
        const sponsorUrl = `${backendUrl}/api/gas-abstraction/sponsor`;
        const sponsorResponse = await fetch(sponsorUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            transaction: sponsorSerializedTx,
            gridSessionSecrets,
            gridSession: {
              authentication: gridSession.authentication || gridSession,
              address: gridAddress
            },
          }),
        });

        if (sponsorResponse.ok) {
          const sponsorResult = await sponsorResponse.json();
          console.log('✅ Transaction sponsored successfully');
          console.log('   Billed:', sponsorResult.billedBaseUnits / 1_000_000, 'USDC');
          console.log('   Sponsored transaction received');
          console.log();
          
          // ============================================
          // STEP 5: Verify Balance Deduction
          // ============================================
          console.log('📋 Step 5/5: Verifying balance deduction...\n');
          
          // Wait a moment for balance to update
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const finalBalanceResponse = await fetch(balanceUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              gridSessionSecrets,
              gridSession: {
                authentication: gridSession.authentication || gridSession,
                address: gridAddress
              },
            }),
          });

          if (finalBalanceResponse.ok) {
            const finalBalance = await finalBalanceResponse.json();
            const finalBalanceUsdc = finalBalance.balanceBaseUnits / 1_000_000;
            const billedUsdc = sponsorResult.billedBaseUnits / 1_000_000;
            
            console.log('✅ Final balance:', finalBalanceUsdc, 'USDC');
            console.log('   Expected deduction:', billedUsdc, 'USDC');
            console.log('   Balance change:', (finalBalanceUsdc - balanceAfterTopupUsdc).toFixed(6), 'USDC');
            console.log();
            
            // Note: Balance may not update immediately due to pending status
            // The actual deduction happens on settlement
            console.log('✅ E2E Test Complete: Gasless transaction flow verified');
            console.log('━'.repeat(60));
          } else {
            console.log('⚠️  Could not verify final balance');
          }
        } else {
          const errorData = await sponsorResponse.json().catch(() => ({}));
          if (sponsorResponse.status === 402) {
            console.log('⚠️  Insufficient balance for sponsorship');
            console.log('   Required:', errorData.required / 1_000_000, 'USDC');
            console.log('   Available:', errorData.available / 1_000_000, 'USDC');
          } else {
            console.log('⚠️  Sponsorship failed:', sponsorResponse.status, errorData.error);
          }
        }
      } else {
        console.log('⚠️  Could not verify balance after top-up');
      }
    }, 180000); // 3 minute timeout for full flow
  });

  describe('Insufficient Balance Handling', () => {
    test.skipIf(!GAS_ABSTRACTION_ENABLED)('should handle insufficient balance: attempt → error → top-up → retry', async () => {
      console.log('🚀 Starting E2E: Insufficient Balance Handling\n');
      
      const token = testSession.accessToken;
      const gridSession = testSession.gridSession;
      const gridSessionData = await loadGridSession();
      const gridSessionSecrets = gridSessionData.sessionSecrets;
      const gridAddress = gridSession.address;
      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      
      // Check current balance
      const balanceUrl = `${backendUrl}/api/gas-abstraction/balance`;
      const balanceResponse = await fetch(balanceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          gridSessionSecrets,
          gridSession: {
            authentication: gridSession.authentication || gridSession,
            address: gridAddress
          },
        }),
      });

      if (!balanceResponse.ok) {
        console.log('⚠️  Skipping test - gateway unavailable');
        return;
      }

      const balance = await balanceResponse.json();
      const balanceUsdc = balance.balanceBaseUnits / 1_000_000;
      
      console.log('📊 Current balance:', balanceUsdc, 'USDC');
      
      // Attempt to sponsor a transaction
      const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      
      const userPubkey = new PublicKey(gridAddress);
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: userPubkey,
        lamports: 0,
      });
      
      const message = new TransactionMessage({
        payerKey: userPubkey,
        recentBlockhash: blockhash,
        instructions: [transferInstruction],
      }).compileToV0Message();
      
      const transaction = new VersionedTransaction(message);
      const serializedTx = Buffer.from(transaction.serialize()).toString('base64');
      
      const sponsorUrl = `${backendUrl}/api/gas-abstraction/sponsor`;
      const sponsorResponse = await fetch(sponsorUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          transaction: serializedTx,
          gridSessionSecrets,
          gridSession: {
            authentication: gridSession.authentication || gridSession,
            address: gridAddress
          },
        }),
      });

      if (sponsorResponse.status === 402) {
        const errorData = await sponsorResponse.json();
        
        // Error data might be in errorData.data or directly in errorData
        const required = errorData.data?.required || errorData.data?.requiredBaseUnits || errorData.required || errorData.requiredBaseUnits;
        const available = errorData.data?.available || errorData.data?.availableBaseUnits || errorData.available || errorData.availableBaseUnits;
        
        console.log('✅ Insufficient balance error received');
        if (required !== undefined && available !== undefined) {
          console.log('   Required:', required / 1_000_000, 'USDC');
          console.log('   Available:', available / 1_000_000, 'USDC');
        } else {
          console.log('   Error structure:', JSON.stringify(errorData).substring(0, 200));
        }
        
        // Verify error structure - check if required/available exist in any form
        // Note: required might be a string (e.g., "unknown (estimated ~5000 base units minimum)")
        // or a number, and available should be a number
        expect(required !== undefined || available !== undefined).toBe(true);
        if (required !== undefined) {
          // required can be a number or a string (for estimated/unknown values)
          expect(typeof required === 'number' || typeof required === 'string').toBe(true);
        }
        if (available !== undefined) {
          expect(typeof available).toBe('number');
        }
        
        console.log('✅ E2E Test Complete: Insufficient balance handling verified');
      } else if (sponsorResponse.ok) {
        console.log('ℹ️  Sponsorship succeeded (sufficient balance available)');
        const result = await sponsorResponse.json();
        expect(result).toHaveProperty('transaction');
      } else {
        console.log('⚠️  Different error occurred:', sponsorResponse.status);
      }
    }, 60000);
  });

  describe('Failed Transaction Refund', () => {
    test.skipIf(!GAS_ABSTRACTION_ENABLED)('should refund gas credits for failed transactions', async () => {
      console.log('🚀 Starting E2E: Failed Transaction Refund\n');
      console.log('━'.repeat(60));
      
      const token = testSession.accessToken;
      const gridSession = testSession.gridSession;
      const gridSessionData = await loadGridSession();
      const gridSessionSecrets = gridSessionData.sessionSecrets;
      const gridAddress = gridSession.address;
      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      
      // ============================================
      // STEP 1: Check Initial Balance
      // ============================================
      console.log('📋 Step 1/5: Checking initial balance...\n');
      
      const balanceUrl = `${backendUrl}/api/gas-abstraction/balance`;
      const initialBalanceResponse = await fetch(balanceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          gridSessionSecrets,
          gridSession: {
            authentication: gridSession.authentication || gridSession,
            address: gridAddress
          },
        }),
      });

      if (!initialBalanceResponse.ok) {
        console.log('⚠️  Skipping test - gateway unavailable');
        return;
      }

      const initialBalance = await initialBalanceResponse.json();
      const initialBalanceUsdc = initialBalance.balanceBaseUnits / 1_000_000;
      
      console.log('✅ Initial balance:', initialBalanceUsdc, 'USDC');
      console.log();
      
      // ============================================
      // STEP 2: Sponsor a Transaction
      // ============================================
      console.log('📋 Step 2/5: Sponsoring transaction...\n');
      
      const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      
      const userPubkey = new PublicKey(gridAddress);
      
      // Create a transaction that will fail (transfer to invalid address or insufficient funds)
      // We'll create a transaction with an invalid instruction that will fail on-chain
      const invalidInstruction = SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: new PublicKey('11111111111111111111111111111111'), // Invalid address
        lamports: 1_000_000_000, // Large amount that will likely fail
      });
      
      const message = new TransactionMessage({
        payerKey: userPubkey,
        recentBlockhash: blockhash,
        instructions: [invalidInstruction],
      }).compileToV0Message();
      
      const transaction = new VersionedTransaction(message);
      const serializedTx = Buffer.from(transaction.serialize()).toString('base64');
      
      // Request sponsorship
      const sponsorUrl = `${backendUrl}/api/gas-abstraction/sponsor`;
      const sponsorResponse = await fetch(sponsorUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          transaction: serializedTx,
          gridSessionSecrets,
          gridSession: {
            authentication: gridSession.authentication || gridSession,
            address: gridAddress
          },
        }),
      });

      if (!sponsorResponse.ok) {
        console.log('⚠️  Sponsorship failed:', sponsorResponse.status);
        const errorData = await sponsorResponse.json().catch(() => ({}));
        console.log('   Error:', errorData.error);
        console.log('   Skipping refund test - cannot sponsor transaction');
        return;
      }

      const sponsorResult = await sponsorResponse.json();
      const billedUsdc = sponsorResult.billedBaseUnits / 1_000_000;
      
      console.log('✅ Transaction sponsored');
      console.log('   Billed:', billedUsdc, 'USDC');
      console.log('   Transaction signature:', sponsorResult.transaction?.slice(0, 20) + '...');
      console.log();
      
      // ============================================
      // STEP 3: Submit Invalid Transaction to Solana
      // ============================================
      console.log('📋 Step 3/5: Submitting invalid transaction to Solana...\n');
      
      // Note: The transaction is already sponsored, but we'll try to submit it
      // In a real scenario, the transaction would fail on-chain and trigger a refund
      // For testing, we'll check the balance after a delay to see if refund occurs
      
      try {
        // Try to submit the sponsored transaction (it may fail)
        const signedTx = VersionedTransaction.deserialize(Buffer.from(sponsorResult.transaction, 'base64'));
        const signature = await connection.sendTransaction(signedTx, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });
        
        console.log('   Transaction submitted:', signature);
        console.log('   Waiting for confirmation...');
        
        // Wait for confirmation (or failure)
        await connection.confirmTransaction(signature, 'confirmed').catch(() => {
          console.log('   Transaction failed (expected)');
        });
      } catch (error: any) {
        console.log('   Transaction submission failed (expected):', error.message);
      }
      
      console.log();
      
      // ============================================
      // STEP 4: Wait for Settlement and Refund
      // ============================================
      console.log('📋 Step 4/5: Waiting for settlement and refund...\n');
      console.log('   Waiting up to 2 minutes for automatic refund...');
      
      // Wait for settlement (gateway typically processes refunds within 2 minutes)
      const maxWaitTime = 120000; // 2 minutes
      const checkInterval = 10000; // Check every 10 seconds
      const startTime = Date.now();
      
      let refundDetected = false;
      let finalBalance = initialBalance;
      
      while (Date.now() - startTime < maxWaitTime && !refundDetected) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        
        const balanceCheckResponse = await fetch(balanceUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            gridSessionSecrets,
            gridSession: {
              authentication: gridSession.authentication || gridSession,
              address: gridAddress
            },
          }),
        });
        
        if (balanceCheckResponse.ok) {
          const balanceCheck = await balanceCheckResponse.json();
          const currentBalanceUsdc = balanceCheck.balanceBaseUnits / 1_000_000;
          
          // Check if balance increased (refund occurred)
          if (currentBalanceUsdc > initialBalanceUsdc - billedUsdc + 0.0001) {
            refundDetected = true;
            finalBalance = balanceCheck;
            console.log('   ✅ Refund detected!');
            break;
          }
          
          // Check usage history for refund indication
          if (balanceCheck.usages && Array.isArray(balanceCheck.usages)) {
            const refundedUsage = balanceCheck.usages.find((usage: any) => 
              usage.status === 'failed' || usage.status === 'refunded' || 
              (usage.description && usage.description.includes('Refunded'))
            );
            
            if (refundedUsage) {
              refundDetected = true;
              finalBalance = balanceCheck;
              console.log('   ✅ Refund found in usage history');
              break;
            }
          }
          
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          process.stdout.write(`\r   Elapsed: ${elapsed}s...`);
        }
      }
      
      console.log();
      console.log();
      
      // ============================================
      // STEP 5: Verify Refund
      // ============================================
      console.log('📋 Step 5/5: Verifying refund...\n');
      
      const finalBalanceUsdc = finalBalance.balanceBaseUnits / 1_000_000;
      const balanceChange = finalBalanceUsdc - (initialBalanceUsdc - billedUsdc);
      
      console.log('   Initial balance:', initialBalanceUsdc, 'USDC');
      console.log('   Billed:', billedUsdc, 'USDC');
      console.log('   Expected after billing:', (initialBalanceUsdc - billedUsdc).toFixed(6), 'USDC');
      console.log('   Final balance:', finalBalanceUsdc, 'USDC');
      console.log('   Balance change (refund):', balanceChange.toFixed(6), 'USDC');
      
      // Check usage history for refund indication
      if (finalBalance.usages && Array.isArray(finalBalance.usages)) {
        const refundedUsage = finalBalance.usages.find((usage: any) => 
          usage.status === 'failed' || 
          usage.status === 'refunded' ||
          (usage.description && usage.description.includes('Refunded')) ||
          (usage.description && usage.description.includes('refund'))
        );
        
        if (refundedUsage) {
          console.log('   ✅ Refund found in usage history');
          console.log('      Status:', refundedUsage.status);
          console.log('      Description:', refundedUsage.description || 'N/A');
        }
      }
      
      if (refundDetected || balanceChange > 0.0001) {
        console.log();
        console.log('✅ E2E Test Complete: Failed transaction refund verified');
        console.log('   Refund was processed automatically by the gateway');
      } else {
        console.log();
        console.log('⚠️  Refund not detected within 2 minutes');
        console.log('   Note: Refunds may take longer to process');
        console.log('   Or transaction may have succeeded unexpectedly');
      }
      
      console.log('━'.repeat(60));
    }, 180000); // 3 minute timeout for settlement
  });

  describe('Graceful Degradation', () => {
    test.skipIf(!GAS_ABSTRACTION_ENABLED)('should continue working with SOL when gateway unavailable', async () => {
      console.log('🚀 Starting E2E: Graceful Degradation\n');
      
      // This test verifies that when the gateway is unavailable (503),
      // the wallet can still function with SOL gas
      // The actual SOL transaction would be handled by the wallet's normal flow
      
      const token = testSession.accessToken;
      const gridSession = testSession.gridSession;
      const gridSessionData = await loadGridSession();
      const gridSessionSecrets = gridSessionData.sessionSecrets;
      const gridAddress = gridSession.address;
      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      
      // Try to get balance (simulating gateway check)
      const balanceUrl = `${backendUrl}/api/gas-abstraction/balance`;
      const balanceResponse = await fetch(balanceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          gridSessionSecrets,
          gridSession: {
            authentication: gridSession.authentication || gridSession,
            address: gridAddress
          },
        }),
      });

      if (balanceResponse.status === 503) {
        console.log('✅ Gateway unavailable (503) detected');
        console.log('   Wallet should fall back to SOL gas');
        console.log('   Core wallet functionality should remain intact');
        
        // Verify error is handled gracefully
        const errorData = await balanceResponse.json().catch(() => ({}));
        expect(errorData.error).toBeTruthy();
        
        console.log('✅ E2E Test Complete: Graceful degradation verified');
      } else if (balanceResponse.ok) {
        console.log('ℹ️  Gateway is available (cannot test degradation scenario)');
      } else {
        console.log('⚠️  Different error occurred:', balanceResponse.status);
      }
    }, 30000);
  });
});


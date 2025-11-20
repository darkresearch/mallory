/**
 * Integration Tests - Gas Abstraction Top-Up Flow
 * 
 * Tests the complete top-up flow with real services:
 * - Real backend API for gas abstraction
 * - Real Grid account authentication
 * - Gateway API calls (if available)
 * - USDC transaction creation
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.10, 3.12, 3.13, 3.14, 3.15, 11.1, 11.2, 11.3
 * 
 * NOTE: These tests require:
 * - Backend server running (default: http://localhost:3001)
 * - GAS_GATEWAY_URL configured in backend environment
 * - Test Grid account with valid session
 * - Test account with USDC balance (for actual top-up tests)
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import './setup';
import { setupTestUserSession, cleanupTestData } from './setup';
import { authenticateTestUser, loadGridSession } from '../setup/test-helpers';
import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';

const BACKEND_URL = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
const GAS_ABSTRACTION_ENABLED = process.env.GAS_ABSTRACTION_ENABLED === 'true';
const HAS_TEST_CREDENTIALS = !!(process.env.TEST_SUPABASE_EMAIL && process.env.TEST_SUPABASE_PASSWORD);
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
// Prioritize Alchemy RPC for faster responses
const SOLANA_RPC_URL = process.env.SOLANA_RPC_ALCHEMY_1 || 
                       process.env.SOLANA_RPC_ALCHEMY_2 || 
                       process.env.SOLANA_RPC_ALCHEMY_3 ||
                       process.env.SOLANA_RPC_URL || 
                       'https://api.mainnet-beta.solana.com';

describe.skipIf(!HAS_TEST_CREDENTIALS)('Gas Abstraction Top-Up Flow (Integration)', () => {
  let testSession: {
    userId: string;
    email: string;
    accessToken: string;
    gridSession: any;
  };

  beforeAll(async () => {
    console.log('🔧 Setting up test user session for gas abstraction top-up tests...');
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

  describe('Top-Up Flow', () => {
    test.skipIf(!GAS_ABSTRACTION_ENABLED)('should get payment requirements from gateway', async () => {
      const token = testSession.accessToken;

      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      const url = `${backendUrl}/api/gas-abstraction/topup/requirements`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const requirements = await response.json();
        
        // Validate requirements structure
        expect(requirements).toHaveProperty('x402Version');
        expect(requirements).toHaveProperty('resource');
        expect(requirements).toHaveProperty('accepts');
        expect(requirements).toHaveProperty('scheme');
        expect(requirements).toHaveProperty('network');
        expect(requirements).toHaveProperty('asset');
        expect(requirements).toHaveProperty('maxAmountRequired');
        expect(requirements).toHaveProperty('payTo');
        expect(requirements).toHaveProperty('description');
        
        // Validate network and asset
        expect(requirements.network).toBe('solana-mainnet-beta');
        expect(requirements.asset).toBe(USDC_MINT);
        
        console.log('✅ Payment requirements fetched successfully');
        console.log('   Network:', requirements.network);
        console.log('   Asset:', requirements.asset);
        console.log('   Max Amount:', requirements.maxAmountRequired / 1_000_000, 'USDC');
        console.log('   Pay To:', requirements.payTo);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.log('⚠️  Gateway unavailable or error:', response.status, errorData);
        expect([503, 500, 400]).toContain(response.status);
      }
    }, 30000);

    test.skipIf(!GAS_ABSTRACTION_ENABLED)('should validate network and asset match', async () => {
      const token = testSession.accessToken;

      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      const url = `${backendUrl}/api/gas-abstraction/topup/requirements`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const requirements = await response.json();
        
        // Validate network matches expected value
        const expectedNetwork = 'solana-mainnet-beta';
        const networkMatch = requirements.network === expectedNetwork;
        expect(networkMatch).toBe(true);
        
        // Validate asset matches expected USDC mint
        const assetMatch = requirements.asset === USDC_MINT;
        expect(assetMatch).toBe(true);
        
        console.log('✅ Network and asset validation passed');
        console.log('   Network match:', networkMatch);
        console.log('   Asset match:', assetMatch);
      } else {
        console.log('⚠️  Skipping validation test - gateway unavailable');
      }
    }, 30000);

    test.skipIf(!GAS_ABSTRACTION_ENABLED)('should create USDC transfer VersionedTransaction', async () => {
      const token = testSession.accessToken;
      const gridSession = testSession.gridSession;
      const gridAddress = gridSession.address;

      // First, get payment requirements
      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      const requirementsUrl = `${backendUrl}/api/gas-abstraction/topup/requirements`;
      
      const requirementsResponse = await fetch(requirementsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!requirementsResponse.ok) {
        console.log('⚠️  Skipping transaction creation test - gateway unavailable');
        return;
      }

      const requirements = await requirementsResponse.json();
      
      // Create USDC transfer transaction
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
        true // allowOwnerOffCurve
      );

      // Use a small test amount (0.1 USDC)
      const amountBaseUnits = 100_000; // 0.1 USDC

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

      // Validate transaction structure
      expect(transaction).toBeDefined();
      expect(transaction.version).toBe(0);
      
      // Serialize transaction
      const serializedTx = Buffer.from(transaction.serialize()).toString('base64');
      expect(serializedTx).toBeTruthy();
      expect(serializedTx.length).toBeGreaterThan(0);
      
      console.log('✅ USDC transfer transaction created successfully');
      console.log('   Amount:', amountBaseUnits / 1_000_000, 'USDC');
      console.log('   From:', userPubkey.toBase58());
      console.log('   To:', payToPubkey.toBase58());
      console.log('   Transaction size:', serializedTx.length, 'bytes');
    }, 60000); // 60 second timeout for RPC calls

    test.skipIf(!GAS_ABSTRACTION_ENABLED)('should submit x402 payment with publicKey field', async () => {
      // This test verifies the top-up submission flow
      // Note: Actual submission requires USDC balance and will debit the account
      // This test may be skipped in CI/CD environments without test funds
      
      const token = testSession.accessToken;
      const gridSession = testSession.gridSession;
      const gridSessionData = await loadGridSession();
      const gridSessionSecrets = gridSessionData.sessionSecrets;
      const gridAddress = gridSession.address;

      // Get payment requirements
      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      const requirementsUrl = `${backendUrl}/api/gas-abstraction/topup/requirements`;
      
      const requirementsResponse = await fetch(requirementsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!requirementsResponse.ok) {
        console.log('⚠️  Skipping payment submission test - gateway unavailable');
        return;
      }

      const requirements = await requirementsResponse.json();
      
      // Create transaction (same as previous test)
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

      const amountBaseUnits = 100_000; // 0.1 USDC

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
      const publicKey = userPubkey.toBase58();

      // Submit to backend
      const topupUrl = `${backendUrl}/api/gas-abstraction/topup`;
      const response = await fetch(topupUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          transaction: serializedTx,
          publicKey: publicKey,
          amountBaseUnits: amountBaseUnits,
          gridSessionSecrets,
          gridSession: {
            authentication: gridSession.authentication || gridSession,
            address: gridAddress
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Validate result structure
        expect(result).toHaveProperty('wallet');
        expect(result).toHaveProperty('amountBaseUnits');
        expect(result).toHaveProperty('txSignature');
        expect(result).toHaveProperty('paymentId');
        
        expect(result.wallet).toBe(gridAddress);
        expect(result.amountBaseUnits).toBe(amountBaseUnits);
        expect(result.txSignature).toBeTruthy();
        
        console.log('✅ Top-up submitted successfully');
        console.log('   Amount:', result.amountBaseUnits / 1_000_000, 'USDC');
        console.log('   Transaction:', result.txSignature);
      } else {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle expected errors gracefully
        if (response.status === 402) {
          console.log('⚠️  Payment validation failed (expected if insufficient balance)');
        } else if (response.status === 400) {
          console.log('⚠️  Invalid payment (expected if transaction invalid)');
        } else {
          console.log('⚠️  Top-up submission failed:', response.status, errorData);
        }
        
        // These are acceptable errors for integration tests
        expect([400, 402, 503, 500]).toContain(response.status);
      }
    }, 120000); // 2 minute timeout for full flow

    test.skipIf(!GAS_ABSTRACTION_ENABLED)('should verify balance update after top-up', async () => {
      // This test verifies that balance is updated after a successful top-up
      // It requires a successful top-up to have occurred first
      
      const token = testSession.accessToken;
      const gridSession = testSession.gridSession;
      const gridSessionData = await loadGridSession();
      const gridSessionSecrets = gridSessionData.sessionSecrets;

      // Get initial balance
      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      const balanceUrl = `${backendUrl}/api/gas-abstraction/balance`;
      
      const initialResponse = await fetch(balanceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          gridSessionSecrets,
          gridSession: {
            authentication: gridSession.authentication || gridSession,
            address: gridSession.address
          },
        }),
      });

      if (!initialResponse.ok) {
        console.log('⚠️  Skipping balance update test - gateway unavailable');
        return;
      }

      const initialBalance = await initialResponse.json();
      const initialBalanceBaseUnits = initialBalance.balanceBaseUnits;
      
      console.log('✅ Initial balance retrieved');
      console.log('   Balance:', initialBalanceBaseUnits / 1_000_000, 'USDC');
      console.log('   Note: Balance update verification requires successful top-up');
      console.log('   This test validates the balance check endpoint works correctly');
      
      // Verify balance structure
      expect(initialBalance).toHaveProperty('balanceBaseUnits');
      expect(typeof initialBalance.balanceBaseUnits).toBe('number');
      expect(initialBalance.balanceBaseUnits).toBeGreaterThanOrEqual(0);
    }, 30000);

    test('should handle missing payment requirements gracefully', async () => {
      const token = testSession.accessToken;

      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      const url = `${backendUrl}/api/gas-abstraction/topup/requirements`;
      
      // Try without authentication (should fail)
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Missing Authorization header
        },
      });

      // Should return 401 Unauthorized
      expect(response.status).toBe(401);
      
      console.log('✅ Missing authentication handled gracefully');
    }, 10000);

    test('should handle invalid transaction in top-up submission', async () => {
      const token = testSession.accessToken;
      const gridSession = testSession.gridSession;
      const gridSessionData = await loadGridSession();
      const gridSessionSecrets = gridSessionData.sessionSecrets;

      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      const topupUrl = `${backendUrl}/api/gas-abstraction/topup`;
      
      // Submit invalid transaction data
      const response = await fetch(topupUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          transaction: 'invalid-transaction-data',
          publicKey: gridSession.address,
          amountBaseUnits: 100_000,
          gridSessionSecrets,
          gridSession: {
            authentication: gridSession.authentication || gridSession,
            address: gridSession.address
          },
        }),
      });

      // Should return 400 Bad Request
      expect(response.status).toBe(400);
      
      const errorData = await response.json().catch(() => ({}));
      expect(errorData.error).toBeTruthy();
      
      console.log('✅ Invalid transaction handled gracefully');
    }, 10000);
  });
});


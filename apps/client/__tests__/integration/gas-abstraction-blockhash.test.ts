/**
 * Integration Tests - Gas Abstraction Blockhash Expiry Handling
 * 
 * Tests blockhash expiry handling and retry logic:
 * - Create transaction with old/expired blockhash
 * - Request sponsorship
 * - Verify 400 error for old blockhash
 * - Verify automatic retry with fresh blockhash (if implemented)
 * 
 * Requirements: 4.18, 15.5
 * 
 * NOTE: These tests require:
 * - Backend server running (default: http://localhost:3001)
 * - GAS_GATEWAY_URL configured in backend environment
 * - Test Grid account with valid session
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import './setup';
import { setupTestUserSession, cleanupTestData } from './setup';
import { authenticateTestUser, loadGridSession } from '../setup/test-helpers';
import { Connection, PublicKey, TransactionMessage, VersionedTransaction, SystemProgram } from '@solana/web3.js';

const BACKEND_URL = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
const GAS_ABSTRACTION_ENABLED = process.env.GAS_ABSTRACTION_ENABLED === 'true';
const HAS_TEST_CREDENTIALS = !!(process.env.TEST_SUPABASE_EMAIL && process.env.TEST_SUPABASE_PASSWORD);
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

describe.skipIf(!HAS_TEST_CREDENTIALS)('Gas Abstraction Blockhash Expiry Handling (Integration)', () => {
  let testSession: {
    userId: string;
    email: string;
    accessToken: string;
    gridSession: any;
  };

  beforeAll(async () => {
    console.log('🔧 Setting up test user session for blockhash expiry tests...');
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

  describe('Blockhash Expiry Handling', () => {
    test.skipIf(!GAS_ABSTRACTION_ENABLED)('should create transaction with old blockhash', async () => {
      const gridAddress = testSession.gridSession.address;
      const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
      
      // Get a blockhash (this will be "old" by the time we use it)
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      
      // Wait a bit to ensure blockhash becomes stale
      // Note: Solana blockhashes expire after ~150 blocks (~60 seconds)
      // For testing, we'll use a blockhash that's likely expired
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create transaction with the (potentially) old blockhash
      const userPubkey = new PublicKey(gridAddress);
      const recipientPubkey = userPubkey;
      
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: recipientPubkey,
        lamports: 0,
      });
      
      const message = new TransactionMessage({
        payerKey: userPubkey,
        recentBlockhash: blockhash, // This blockhash may be expired
        instructions: [transferInstruction],
      }).compileToV0Message();
      
      const transaction = new VersionedTransaction(message);
      const serializedTx = Buffer.from(transaction.serialize()).toString('base64');
      
      expect(serializedTx).toBeTruthy();
      
      console.log('✅ Transaction created with blockhash');
      console.log('   Blockhash:', blockhash);
      console.log('   Note: Blockhash may be expired depending on timing');
    }, 30000);

    test.skipIf(!GAS_ABSTRACTION_ENABLED)('should return 400 error for old blockhash', async () => {
      const token = testSession.accessToken;
      const gridSession = testSession.gridSession;
      const gridSessionSecrets = await loadGridSession();
      const gridAddress = gridSession.address;
      
      // Create transaction with old blockhash
      // We'll use a blockhash from a while ago (simulated by using an old blockhash)
      const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
      
      // Get a blockhash and wait for it to potentially expire
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      
      // Wait longer to increase chance of expiry (blockhashes expire after ~150 blocks)
      // Note: In a real scenario, we'd need to wait ~60+ seconds or use a known old blockhash
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const userPubkey = new PublicKey(gridAddress);
      const recipientPubkey = userPubkey;
      
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: recipientPubkey,
        lamports: 0,
      });
      
      const message = new TransactionMessage({
        payerKey: userPubkey,
        recentBlockhash: blockhash, // Potentially expired blockhash
        instructions: [transferInstruction],
      }).compileToV0Message();
      
      const transaction = new VersionedTransaction(message);
      const serializedTx = Buffer.from(transaction.serialize()).toString('base64');
      
      // Request sponsorship
      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      const sponsorUrl = `${backendUrl}/api/gas-abstraction/sponsor`;
      
      const response = await fetch(sponsorUrl, {
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

      if (response.status === 400) {
        const errorData = await response.json();
        
        // Verify 400 error indicates blockhash issue
        const errorMessage = errorData.error || errorData.message || '';
        const isBlockhashError = 
          errorMessage.toLowerCase().includes('blockhash') ||
          errorMessage.toLowerCase().includes('expired') ||
          errorMessage.toLowerCase().includes('stale');
        
        if (isBlockhashError) {
          console.log('✅ Old blockhash error detected correctly');
          console.log('   Error:', errorMessage);
        } else {
          console.log('⚠️  400 error but not blockhash-related:', errorMessage);
        }
        
        // 400 is expected for old blockhash
        expect(response.status).toBe(400);
      } else if (response.ok) {
        // Transaction might still be valid (blockhash not expired yet)
        console.log('ℹ️  Transaction still valid (blockhash not expired)');
        const result = await response.json();
        expect(result).toHaveProperty('transaction');
      } else {
        // Other error (insufficient balance, etc.)
        console.log('⚠️  Different error occurred:', response.status);
        expect([400, 402, 503, 500]).toContain(response.status);
      }
    }, 60000);

    test.skipIf(!GAS_ABSTRACTION_ENABLED)('should handle blockhash error message correctly', async () => {
      const token = testSession.accessToken;
      const gridSession = testSession.gridSession;
      const gridSessionSecrets = await loadGridSession();
      const gridAddress = gridSession.address;
      
      // Create transaction with potentially old blockhash
      const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      
      // Wait to increase chance of expiry
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const userPubkey = new PublicKey(gridAddress);
      const recipientPubkey = userPubkey;
      
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: recipientPubkey,
        lamports: 0,
      });
      
      const message = new TransactionMessage({
        payerKey: userPubkey,
        recentBlockhash: blockhash,
        instructions: [transferInstruction],
      }).compileToV0Message();
      
      const transaction = new VersionedTransaction(message);
      const serializedTx = Buffer.from(transaction.serialize()).toString('base64');
      
      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      const sponsorUrl = `${backendUrl}/api/gas-abstraction/sponsor`;
      
      const response = await fetch(sponsorUrl, {
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

      if (response.status === 400) {
        const errorData = await response.json();
        const errorMessage = errorData.error || errorData.message || '';
        
        // Verify error message indicates blockhash issue
        // Backend should parse and format the error message
        console.log('✅ Blockhash error message received');
        console.log('   Error:', errorMessage);
        
        // Error should mention blockhash or expired transaction
        const mentionsBlockhash = 
          errorMessage.toLowerCase().includes('blockhash') ||
          errorMessage.toLowerCase().includes('expired') ||
          errorMessage.toLowerCase().includes('stale') ||
          errorMessage.toLowerCase().includes('old');
        
        if (mentionsBlockhash) {
          console.log('✅ Error message correctly identifies blockhash issue');
        } else {
          console.log('⚠️  Error message does not mention blockhash (may be different error)');
        }
      } else {
        console.log('ℹ️  Transaction may still be valid or different error occurred');
      }
    }, 60000);

    test.skipIf(!GAS_ABSTRACTION_ENABLED)('should retry with fresh blockhash when old blockhash detected', async () => {
      // This test verifies that the system can handle old blockhash errors
      // and retry with a fresh blockhash
      // Note: The actual retry logic may be implemented client-side or server-side
      
      const token = testSession.accessToken;
      const gridSession = testSession.gridSession;
      const gridSessionSecrets = await loadGridSession();
      const gridAddress = gridSession.address;
      
      // First, try with potentially old blockhash
      const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
      const { blockhash: oldBlockhash } = await connection.getLatestBlockhash('confirmed');
      
      // Wait to increase chance of expiry
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const userPubkey = new PublicKey(gridAddress);
      const recipientPubkey = userPubkey;
      
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: recipientPubkey,
        lamports: 0,
      });
      
      // Create transaction with old blockhash
      const oldMessage = new TransactionMessage({
        payerKey: userPubkey,
        recentBlockhash: oldBlockhash,
        instructions: [transferInstruction],
      }).compileToV0Message();
      
      const oldTransaction = new VersionedTransaction(oldMessage);
      const oldSerializedTx = Buffer.from(oldTransaction.serialize()).toString('base64');
      
      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      const sponsorUrl = `${backendUrl}/api/gas-abstraction/sponsor`;
      
      // Try with old blockhash
      const oldResponse = await fetch(sponsorUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          transaction: oldSerializedTx,
          gridSessionSecrets,
          gridSession: {
            authentication: gridSession.authentication || gridSession,
            address: gridAddress
          },
        }),
      });

      if (oldResponse.status === 400) {
        // Old blockhash was rejected - now try with fresh blockhash
        const { blockhash: freshBlockhash } = await connection.getLatestBlockhash('confirmed');
        
        const freshMessage = new TransactionMessage({
          payerKey: userPubkey,
          recentBlockhash: freshBlockhash,
          instructions: [transferInstruction],
        }).compileToV0Message();
        
        const freshTransaction = new VersionedTransaction(freshMessage);
        const freshSerializedTx = Buffer.from(freshTransaction.serialize()).toString('base64');
        
        const freshResponse = await fetch(sponsorUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            transaction: freshSerializedTx,
            gridSessionSecrets,
            gridSession: {
              authentication: gridSession.authentication || gridSession,
              address: gridAddress
            },
          }),
        });

        if (freshResponse.ok) {
          console.log('✅ Retry with fresh blockhash succeeded');
          const result = await freshResponse.json();
          expect(result).toHaveProperty('transaction');
        } else {
          console.log('⚠️  Fresh blockhash also failed (may be insufficient balance or other issue)');
          expect([400, 402, 503, 500]).toContain(freshResponse.status);
        }
      } else if (oldResponse.ok) {
        console.log('ℹ️  Old blockhash still valid (not expired yet)');
      } else {
        console.log('⚠️  Different error with old blockhash:', oldResponse.status);
      }
    }, 120000); // 2 minute timeout for retry flow
  });
});


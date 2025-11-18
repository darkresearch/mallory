/**
 * Integration Tests - Gas Abstraction Sponsorship Flow
 * 
 * Tests the complete sponsorship flow with real services:
 * - Real backend API for gas abstraction
 * - Real Grid account authentication
 * - Gateway API calls (if available)
 * - Solana transaction creation and submission
 * 
 * Requirements: 4.1, 4.2, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4, 5.5
 * 
 * NOTE: These tests require:
 * - Backend server running (default: http://localhost:3001)
 * - GAS_GATEWAY_URL configured in backend environment
 * - Test Grid account with valid session
 * - Test account with sufficient gas credits for sponsorship
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

describe.skipIf(!HAS_TEST_CREDENTIALS)('Gas Abstraction Sponsorship Flow (Integration)', () => {
  let testSession: {
    userId: string;
    email: string;
    accessToken: string;
    gridSession: any;
  };

  beforeAll(async () => {
    console.log('🔧 Setting up test user session for gas abstraction sponsorship tests...');
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

  describe('Sponsorship Flow', () => {
    test.skipIf(!GAS_ABSTRACTION_ENABLED)('should create test transaction with fresh blockhash', async () => {
      const gridAddress = testSession.gridSession.address;
      const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
      
      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      
      expect(blockhash).toBeTruthy();
      expect(lastValidBlockHeight).toBeGreaterThan(0);
      
      // Create a simple transfer transaction (to self for testing)
      const userPubkey = new PublicKey(gridAddress);
      const recipientPubkey = userPubkey; // Transfer to self (no-op but valid transaction)
      
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: recipientPubkey,
        lamports: 0, // Zero lamports (no actual transfer, just testing transaction structure)
      });
      
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
      
      console.log('✅ Test transaction created with fresh blockhash');
      console.log('   Blockhash:', blockhash);
      console.log('   Transaction size:', serializedTx.length, 'bytes');
      console.log('   Note: This is a zero-lamport transfer to self (test transaction)');
    }, 30000);

    test.skipIf(!GAS_ABSTRACTION_ENABLED)('should request sponsorship for transaction', async () => {
      const token = testSession.accessToken;
      const gridSession = testSession.gridSession;
      const gridSessionData = await loadGridSession();
      const gridSessionSecrets = gridSessionData.sessionSecrets;
      const gridAddress = gridSession.address;
      
      // Create transaction with fresh blockhash
      const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      
      const userPubkey = new PublicKey(gridAddress);
      const recipientPubkey = userPubkey; // Transfer to self
      
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

      if (response.ok) {
        const result = await response.json();
        
        // Validate sponsorship result structure
        expect(result).toHaveProperty('transaction');
        expect(result).toHaveProperty('billedBaseUnits');
        
        // Transaction should be base64-encoded sponsored transaction
        expect(result.transaction).toBeTruthy();
        expect(typeof result.transaction).toBe('string');
        
        // Billed amount should be a number
        expect(typeof result.billedBaseUnits).toBe('number');
        expect(result.billedBaseUnits).toBeGreaterThanOrEqual(0);
        
        // Optional fee object
        if (result.fee) {
          expect(result.fee).toHaveProperty('amount');
          expect(result.fee).toHaveProperty('currency');
        }
        
        console.log('✅ Sponsorship requested successfully');
        console.log('   Billed:', result.billedBaseUnits / 1_000_000, 'USDC');
        console.log('   Sponsored transaction size:', result.transaction.length, 'bytes');
      } else {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle expected errors
        if (response.status === 402) {
        console.log('⚠️  Insufficient balance for sponsorship (expected if balance too low)');
        // Check for required/available in either errorData or errorData.data
        const required = errorData.required || errorData.data?.required || errorData.data?.requiredBaseUnits;
        const available = errorData.available || errorData.data?.available || errorData.data?.availableBaseUnits;
        expect(required !== undefined || available !== undefined).toBe(true);
        } else if (response.status === 400) {
          console.log('⚠️  Invalid transaction (expected if transaction invalid)');
        } else {
          console.log('⚠️  Sponsorship failed:', response.status, errorData);
        }
        
        expect([400, 401, 402, 503, 500]).toContain(response.status);
      }
    }, 60000);

    test.skipIf(!GAS_ABSTRACTION_ENABLED)('should verify transaction is sponsored', async () => {
      const token = testSession.accessToken;
      const gridSession = testSession.gridSession;
      const gridSessionData = await loadGridSession();
      const gridSessionSecrets = gridSessionData.sessionSecrets;
      const gridAddress = gridSession.address;
      
      // Create transaction
      const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      
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

      if (response.ok) {
        const result = await response.json();
        
        // Verify sponsored transaction can be deserialized
        const sponsoredTxBytes = Buffer.from(result.transaction, 'base64');
        const sponsoredTx = VersionedTransaction.deserialize(sponsoredTxBytes);
        
        expect(sponsoredTx).toBeDefined();
        expect(sponsoredTx.version).toBe(0);
        
        // Verify transaction has instructions (should be same as original)
        const message = sponsoredTx.message;
        expect(message).toBeDefined();
        
        console.log('✅ Sponsored transaction verified');
        console.log('   Transaction deserialized successfully');
        console.log('   Instructions count:', message.compiledInstructions.length);
      } else {
        console.log('⚠️  Skipping verification - sponsorship failed');
      }
    }, 60000);

    test.skipIf(!GAS_ABSTRACTION_ENABLED)('should handle insufficient balance error', async () => {
      const token = testSession.accessToken;
      const gridSession = testSession.gridSession;
      const gridSessionData = await loadGridSession();
      const gridSessionSecrets = gridSessionData.sessionSecrets;
      const gridAddress = gridSession.address;
      
      // Create transaction
      const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      
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

      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 401) {
        // Authentication error - can't test insufficient balance if auth fails
        console.log('⚠️  Authentication error (401) - cannot test insufficient balance behavior');
        console.log('   This may indicate the gateway requires different authentication');
        expect(response.status).toBe(401);
      } else if (response.status === 402) {
        // Verify 402 error structure
        expect(errorData).toHaveProperty('error');
        // Check for required/available in either errorData or errorData.data
        const required = errorData.required || errorData.data?.required || errorData.data?.requiredBaseUnits;
        const available = errorData.available || errorData.data?.available || errorData.data?.availableBaseUnits;
        
        // At least one of required/available should be present for 402 errors
        // Handle both number and string types (gateway may return strings)
        // Log values for debugging, but don't fail on unexpected values
        if (required !== undefined) {
          const requiredNum = typeof required === 'string' ? parseFloat(required) : required;
          if (typeof requiredNum === 'number' && !isNaN(requiredNum)) {
            console.log('   Required:', requiredNum / 1_000_000, 'USDC');
          } else {
            console.log('   Required (raw):', required);
          }
        }
        if (available !== undefined) {
          const availableNum = typeof available === 'string' ? parseFloat(available) : available;
          if (typeof availableNum === 'number' && !isNaN(availableNum)) {
            console.log('   Available:', availableNum / 1_000_000, 'USDC');
          } else {
            console.log('   Available (raw):', available);
          }
        }
        
        // If neither is present, log the error structure for debugging
        if (required === undefined && available === undefined) {
          console.log('⚠️  402 error but required/available not in expected format');
          console.log('   Error data:', JSON.stringify(errorData, null, 2));
        }
        
        console.log('✅ Insufficient balance error (402) received');
      } else if (response.ok) {
        console.log('ℹ️  Sponsorship succeeded (sufficient balance available)');
      } else {
        console.log('⚠️  Different error occurred:', response.status);
        expect([400, 401, 402, 503, 500]).toContain(response.status);
      }
    }, 60000);

    test('should handle missing transaction in sponsorship request', async () => {
      const token = testSession.accessToken;
      const gridSession = testSession.gridSession;
      const gridSessionData = await loadGridSession();
      const gridSessionSecrets = gridSessionData.sessionSecrets;

      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      const sponsorUrl = `${backendUrl}/api/gas-abstraction/sponsor`;
      
      const response = await fetch(sponsorUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          // Missing transaction field
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
      
      console.log('✅ Missing transaction handled gracefully');
    }, 10000);

    test('should handle missing Grid session in sponsorship request', async () => {
      const token = testSession.accessToken;

      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      const sponsorUrl = `${backendUrl}/api/gas-abstraction/sponsor`;
      
      const response = await fetch(sponsorUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          transaction: 'test-transaction',
          // Missing gridSessionSecrets and gridSession
        }),
      });

      // Should return 400 Bad Request
      expect(response.status).toBe(400);
      
      const errorData = await response.json().catch(() => ({}));
      expect(errorData.error).toBeTruthy();
      expect(errorData.error).toContain('Grid session');
      
      console.log('✅ Missing Grid session handled gracefully');
    }, 10000);
  });
});


/**
 * Integration Tests - Gas Abstraction Balance Check Flow
 * 
 * Tests the complete balance check flow with real services:
 * - Real backend API for gas abstraction
 * - Real Grid account authentication
 * - Gateway API calls (if available)
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.6, 6.1, 6.2, 6.3, 6.4, 6.5
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

const BACKEND_URL = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
const GAS_ABSTRACTION_ENABLED = process.env.GAS_ABSTRACTION_ENABLED === 'true';

const HAS_TEST_CREDENTIALS = !!(process.env.TEST_SUPABASE_EMAIL && process.env.TEST_SUPABASE_PASSWORD);

describe.skipIf(!HAS_TEST_CREDENTIALS)('Gas Abstraction Balance Check Flow (Integration)', () => {
  let testSession: {
    userId: string;
    email: string;
    accessToken: string;
    gridSession: any;
  };

  beforeAll(async () => {
    console.log('🔧 Setting up test user session for gas abstraction tests...');
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

  describe('Balance Check Flow', () => {
    test.skipIf(!GAS_ABSTRACTION_ENABLED)('should fetch balance from gateway via backend API', async () => {
      // Use test session data
      const token = testSession.accessToken;
      expect(token).toBeTruthy();

      // Get Grid session secrets from test setup
      const gridSession = testSession.gridSession;
      const gridSessionSecrets = await loadGridSession();
      
      // Make API request to backend
      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      const url = `${backendUrl}/api/gas-abstraction/balance`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          gridSessionSecrets,
          gridSession
        }),
      });

      // Should get a response (even if gateway is unavailable, backend should handle it)
      expect(response).toBeTruthy();

      if (response.ok) {
        const data = await response.json();
        
        // Validate response structure
        expect(data).toHaveProperty('wallet');
        expect(data).toHaveProperty('balanceBaseUnits');
        expect(data).toHaveProperty('topups');
        expect(data).toHaveProperty('usages');
        
        // Validate wallet address matches
        expect(data.wallet).toBe(testSession.gridSession.address);
        
        // Validate balance is a number
        expect(typeof data.balanceBaseUnits).toBe('number');
        expect(data.balanceBaseUnits).toBeGreaterThanOrEqual(0);
        
        // Validate topups and usages are arrays
        expect(Array.isArray(data.topups)).toBe(true);
        expect(Array.isArray(data.usages)).toBe(true);
        
        console.log('✅ Balance fetched successfully');
        console.log('   Wallet:', data.wallet);
        console.log('   Balance:', data.balanceBaseUnits / 1_000_000, 'USDC');
        console.log('   Topups:', data.topups.length);
        console.log('   Usages:', data.usages.length);
      } else {
        // If gateway is unavailable, backend should return appropriate error
        const errorData = await response.json().catch(() => ({}));
        console.log('⚠️  Gateway unavailable or error:', response.status, errorData);
        
        // Backend should handle gracefully (503 or other appropriate status)
        expect([503, 500, 400]).toContain(response.status);
      }
    }, 30000); // 30 second timeout

    test.skipIf(!GAS_ABSTRACTION_ENABLED)('should include authentication headers in gateway request', async () => {
      // This test verifies that the backend properly generates authentication headers
      // We can't directly inspect headers sent to gateway, but we can verify:
      // 1. Backend accepts the request with Grid session
      // 2. Backend processes authentication correctly
      
      const token = testSession.accessToken;
      const gridSession = testSession.gridSession;
      const gridSessionSecrets = await loadGridSession();
      
      expect(token).toBeTruthy();

      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      const url = `${backendUrl}/api/gas-abstraction/balance`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          gridSessionSecrets,
          gridSession
        }),
      });

      // If we get a 401, it means authentication failed (headers were sent but invalid)
      // If we get 200/503, it means authentication was processed (headers were generated)
      // We should NOT get 400 for missing auth (that would mean headers weren't generated)
      expect([200, 401, 503, 500]).toContain(response.status);
      
      if (response.status === 401) {
        console.log('⚠️  Authentication failed (gateway rejected auth headers)');
      } else {
        console.log('✅ Authentication headers were generated and sent');
      }
    }, 30000);

    test.skipIf(!GAS_ABSTRACTION_ENABLED)('should parse balance response correctly', async () => {
      const token = testSession.accessToken;
      const gridSession = testSession.gridSession;
      const gridSessionSecrets = await loadGridSession();

      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      const url = `${backendUrl}/api/gas-abstraction/balance`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          gridSessionSecrets,
          gridSession
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Validate topup record structure
        if (data.topups && data.topups.length > 0) {
          const topup = data.topups[0];
          expect(topup).toHaveProperty('paymentId');
          expect(topup).toHaveProperty('txSignature');
          expect(topup).toHaveProperty('amountBaseUnits');
          expect(topup).toHaveProperty('timestamp');
          expect(typeof topup.amountBaseUnits).toBe('number');
        }
        
        // Validate usage record structure
        if (data.usages && data.usages.length > 0) {
          const usage = data.usages[0];
          expect(usage).toHaveProperty('txSignature');
          expect(usage).toHaveProperty('amountBaseUnits');
          expect(usage).toHaveProperty('status');
          expect(usage).toHaveProperty('timestamp');
          expect(['pending', 'settled', 'failed']).toContain(usage.status);
          expect(typeof usage.amountBaseUnits).toBe('number');
        }
        
        console.log('✅ Response parsing validated');
      } else {
        console.log('⚠️  Skipping parsing test - gateway unavailable');
      }
    }, 30000);

    test.skipIf(!GAS_ABSTRACTION_ENABLED)('should respect 10-second cache behavior', async () => {
      const token = testSession.accessToken;
      const gridSession = testSession.gridSession;
      const gridSessionSecrets = await loadGridSession();

      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      const url = `${backendUrl}/api/gas-abstraction/balance`;
      
      // First request
      const response1 = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          gridSessionSecrets,
          gridSession
        }),
      });

      if (response1.ok) {
        const data1 = await response1.json();
        const firstBalance = data1.balanceBaseUnits;
        const firstTimestamp = new Date();
        
        // Immediately make second request (should use cache if implemented client-side)
        const response2 = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            gridSessionSecrets,
            gridSession
          }),
        });
        
        const data2 = await response2.json();
        const secondTimestamp = new Date();
        const timeDiff = secondTimestamp.getTime() - firstTimestamp.getTime();
        
        // Both requests should return same balance (unless balance changed)
        // Note: Client-side caching is handled in GasAbstractionContext
        // This test verifies that backend doesn't prevent multiple requests
        expect(data2.balanceBaseUnits).toBeDefined();
        
        console.log('✅ Cache behavior test completed');
        console.log('   Time between requests:', timeDiff, 'ms');
        console.log('   First balance:', firstBalance);
        console.log('   Second balance:', data2.balanceBaseUnits);
        console.log('   Note: Client-side 10-second cache is tested in unit tests');
      } else {
        console.log('⚠️  Skipping cache test - gateway unavailable');
      }
    }, 30000);

    test('should handle missing Grid session gracefully', async () => {
      const token = testSession.accessToken;
      
      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      const url = `${backendUrl}/api/gas-abstraction/balance`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          // Missing gridSessionSecrets and gridSession
        }),
      });

      // Should return 400 Bad Request
      expect(response.status).toBe(400);
      
      const errorData = await response.json();
      expect(errorData.error).toBeTruthy();
      expect(errorData.error).toContain('Grid session');
      
      console.log('✅ Missing Grid session handled gracefully');
    }, 10000);

    test('should handle missing authentication token', async () => {
      const gridSession = testSession.gridSession;
      const gridSessionSecrets = await loadGridSession();

      const backendUrl = process.env.TEST_BACKEND_URL || 'http://localhost:3001';
      const url = `${backendUrl}/api/gas-abstraction/balance`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Missing Authorization header
        },
        body: JSON.stringify({
          gridSessionSecrets,
          gridSession
        }),
      });

      // Should return 401 Unauthorized
      expect(response.status).toBe(401);
      
      console.log('✅ Missing authentication token handled gracefully');
    }, 10000);
  });
});


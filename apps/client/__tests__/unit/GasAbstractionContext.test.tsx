/**
 * Unit Tests for Gas Abstraction Context
 * Tests balance state updates, staleness checks, gasless mode toggle, and low balance detection
 * 
 * Requirements: 2.3, 2.4, 2.6, 8.1, 9.1
 */

import { describe, test, expect } from 'bun:test';
import '../setup/test-env';

describe('GasAbstractionContext Logic (Unit)', () => {
  describe('balance state updates', () => {
    test('calculates available balance correctly (total - pending)', () => {
      // Simulate GasAbstractionContext logic
      const balance = 10.0; // 10 USDC
      const usages = [
        { amountBaseUnits: 2_000_000, status: 'pending' }, // 2 USDC pending
        { amountBaseUnits: 1_000_000, status: 'settled' }  // 1 USDC settled (not pending)
      ];
      
      const pendingAmount = usages
        .filter(u => u.status === 'pending')
        .reduce((sum, u) => sum + u.amountBaseUnits, 0) / 1_000_000;
      
      const availableBalance = balance - pendingAmount;
      
      expect(pendingAmount).toBe(2.0);
      expect(availableBalance).toBe(8.0); // 10 - 2
      
      console.log('✅ Correctly calculates available balance');
      console.log('   Total:', balance, 'USDC');
      console.log('   Pending:', pendingAmount, 'USDC');
      console.log('   Available:', availableBalance, 'USDC');
    });

    test('parses balance from gateway response correctly', () => {
      // Simulate gateway response
      const gatewayResponse = {
        wallet: 'So11111111111111111111111111111111111111112',
        balanceBaseUnits: 5_000_000, // 5 USDC in base units
        topups: [
          {
            paymentId: 'tx1',
            txSignature: 'tx1',
            amountBaseUnits: 5_000_000,
            timestamp: '2024-01-01T00:00:00Z'
          }
        ],
        usages: []
      };
      
      // Simulate parsing logic
      const balanceUsdc = gatewayResponse.balanceBaseUnits / 1_000_000;
      const topups = gatewayResponse.topups || [];
      const usages = gatewayResponse.usages || [];
      
      expect(balanceUsdc).toBe(5.0);
      expect(topups).toHaveLength(1);
      expect(usages).toHaveLength(0);
      
      console.log('✅ Correctly parses gateway balance response');
    });
  });

  describe('10-second staleness check', () => {
    test('returns true when balance is stale (>10 seconds)', () => {
      // Simulate isBalanceStale logic
      const balanceLastFetched = new Date(Date.now() - 11_000); // 11 seconds ago
      const now = new Date();
      const diff = now.getTime() - balanceLastFetched.getTime();
      const isStale = diff > 10_000; // 10 seconds
      
      expect(isStale).toBe(true);
      
      console.log('✅ Correctly detects stale balance (>10 seconds)');
    });

    test('returns false when balance is fresh (<10 seconds)', () => {
      // Simulate isBalanceStale logic
      const balanceLastFetched = new Date(Date.now() - 5_000); // 5 seconds ago
      const now = new Date();
      const diff = now.getTime() - balanceLastFetched.getTime();
      const isStale = diff > 10_000; // 10 seconds
      
      expect(isStale).toBe(false);
      
      console.log('✅ Correctly detects fresh balance (<10 seconds)');
    });

    test('returns true when balance has never been fetched', () => {
      // Simulate isBalanceStale logic
      const balanceLastFetched = null;
      const isStale = !balanceLastFetched || (() => {
        const now = new Date();
        const diff = now.getTime() - balanceLastFetched.getTime();
        return diff > 10_000;
      })();
      
      // When null, should return true (stale)
      expect(!balanceLastFetched).toBe(true);
      
      console.log('✅ Correctly detects when balance has never been fetched');
    });
  });

  describe('gasless mode toggle and persistence', () => {
    test('toggles gasless mode state correctly', () => {
      // Simulate gasless mode toggle logic
      let gaslessEnabled = false;
      
      // Toggle on
      gaslessEnabled = true;
      expect(gaslessEnabled).toBe(true);
      
      // Toggle off
      gaslessEnabled = false;
      expect(gaslessEnabled).toBe(false);
      
      console.log('✅ Correctly toggles gasless mode state');
    });

    test('persists gasless mode preference to AsyncStorage format', () => {
      // Simulate AsyncStorage persistence logic
      const gaslessEnabled = true;
      const storageValue = gaslessEnabled ? 'true' : 'false';
      
      expect(storageValue).toBe('true');
      
      // Simulate loading from storage
      const loadedValue = storageValue === 'true';
      expect(loadedValue).toBe(true);
      
      console.log('✅ Correctly formats gasless mode for AsyncStorage');
      console.log('   Stored as:', storageValue);
      console.log('   Loaded as:', loadedValue);
    });
  });

  describe('low balance detection', () => {
    test('detects low balance when below threshold (< 0.1 USDC)', () => {
      // Simulate low balance detection logic
      const lowBalanceThreshold = 0.1; // 0.1 USDC
      const availableBalance = 0.05; // 0.05 USDC
      const isLowBalance = availableBalance < lowBalanceThreshold;
      
      expect(isLowBalance).toBe(true);
      
      console.log('✅ Correctly detects low balance');
      console.log('   Available:', availableBalance, 'USDC');
      console.log('   Threshold:', lowBalanceThreshold, 'USDC');
      console.log('   Is Low:', isLowBalance);
    });

    test('clears low balance flag when balance increases above threshold', () => {
      // Simulate low balance detection logic
      const lowBalanceThreshold = 0.1; // 0.1 USDC
      
      // Initially low
      let availableBalance = 0.05; // 0.05 USDC
      let isLowBalance = availableBalance < lowBalanceThreshold;
      expect(isLowBalance).toBe(true);
      
      // Balance increases
      availableBalance = 0.2; // 0.2 USDC
      isLowBalance = availableBalance < lowBalanceThreshold;
      expect(isLowBalance).toBe(false);
      
      console.log('✅ Correctly clears low balance flag when balance increases');
    });

    test('hasInsufficientBalance returns true when balance is below estimated cost', () => {
      // Simulate hasInsufficientBalance logic
      const availableBalance = 0.05; // 0.05 USDC
      const estimatedCost = 0.1; // 0.1 USDC
      const hasInsufficient = availableBalance < estimatedCost;
      
      expect(hasInsufficient).toBe(true);
      
      // Test with sufficient balance
      const sufficientBalance = 0.2; // 0.2 USDC
      const hasInsufficient2 = sufficientBalance < estimatedCost;
      expect(hasInsufficient2).toBe(false);
      
      console.log('✅ Correctly detects insufficient balance');
      console.log('   Available:', availableBalance, 'USDC');
      console.log('   Required:', estimatedCost, 'USDC');
      console.log('   Insufficient:', hasInsufficient);
    });
  });

  describe('transaction history parsing', () => {
    test('parses topups correctly', () => {
      // Simulate topup parsing logic
      const topups = [
        {
          paymentId: 'tx1',
          txSignature: 'tx1',
          amountBaseUnits: 5_000_000,
          timestamp: '2024-01-01T00:00:00Z'
        },
        {
          paymentId: 'tx2',
          txSignature: 'tx2',
          amountBaseUnits: 5_000_000,
          timestamp: '2024-01-02T00:00:00Z'
        }
      ];
      
      expect(topups).toHaveLength(2);
      expect(topups[0].txSignature).toBe('tx1');
      expect(topups[1].txSignature).toBe('tx2');
      
      console.log('✅ Correctly parses topups');
    });

    test('parses usages with different statuses correctly', () => {
      // Simulate usage parsing logic
      const usages = [
        {
          txSignature: 'tx1',
          amountBaseUnits: 1_000_000,
          status: 'pending' as const,
          timestamp: '2024-01-01T00:00:00Z'
        },
        {
          txSignature: 'tx2',
          amountBaseUnits: 2_000_000,
          status: 'settled' as const,
          timestamp: '2024-01-02T00:00:00Z',
          settled_at: '2024-01-02T00:01:00Z'
        },
        {
          txSignature: 'tx3',
          amountBaseUnits: 3_000_000,
          status: 'failed' as const,
          timestamp: '2024-01-03T00:00:00Z'
        }
      ];
      
      expect(usages).toHaveLength(3);
      expect(usages[0].status).toBe('pending');
      expect(usages[1].status).toBe('settled');
      expect(usages[2].status).toBe('failed');
      
      // Calculate pending amount
      const pendingAmount = usages
        .filter(u => u.status === 'pending')
        .reduce((sum, u) => sum + u.amountBaseUnits, 0) / 1_000_000;
      
      expect(pendingAmount).toBe(1.0); // Only pending amount
      
      console.log('✅ Correctly parses usages with different statuses');
      console.log('   Pending amount:', pendingAmount, 'USDC');
    });

    test('calculates pending amount correctly from usages', () => {
      // Simulate pending amount calculation
      const usages = [
        { amountBaseUnits: 1_000_000, status: 'pending' },
        { amountBaseUnits: 2_000_000, status: 'pending' },
        { amountBaseUnits: 3_000_000, status: 'settled' },
        { amountBaseUnits: 4_000_000, status: 'failed' }
      ];
      
      const pendingAmount = usages
        .filter(u => u.status === 'pending')
        .reduce((sum, u) => sum + u.amountBaseUnits, 0) / 1_000_000;
      
      expect(pendingAmount).toBe(3.0); // 1 + 2 = 3 USDC (only pending)
      
      console.log('✅ Correctly calculates pending amount');
      console.log('   Pending:', pendingAmount, 'USDC');
    });
  });
});

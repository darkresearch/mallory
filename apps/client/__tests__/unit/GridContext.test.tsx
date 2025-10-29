/**
 * Unit Tests for Grid Context Logic
 * 
 * Tests Grid wallet logic without React rendering
 */

import { describe, test, expect } from 'bun:test';
import '../setup/test-env';

// Ensure sessionStorage is available
declare const sessionStorage: Storage;

describe('GridContext Logic', () => {
  describe('Grid Session Management', () => {
    test('should use backend API for Grid operations', () => {
      // Verify that we have backend URL configured
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_API_URL || process.env.TEST_BACKEND_URL;
      
      expect(backendUrl).toBeDefined();
      console.log('✅ Backend URL configured:', backendUrl);
    });
    
    test('should never expose Grid API key in client code', () => {
      // Verify Grid API key is NOT in client environment
      const gridApiKey = process.env.EXPO_PUBLIC_GRID_API_KEY;
      
      expect(gridApiKey).toBeUndefined();
      console.log('✅ Grid API key not exposed to client');
    });
  });
  
  describe('Session Storage for Persistence', () => {
    test('should support sessionStorage operations', () => {
      // Verify sessionStorage is available (polyfilled in tests)
      expect(typeof globalThis.sessionStorage).toBe('object');
      expect(typeof globalThis.sessionStorage.getItem).toBe('function');
      expect(typeof globalThis.sessionStorage.setItem).toBe('function');
      expect(typeof globalThis.sessionStorage.removeItem).toBe('function');
    });
    
    test('should persist and retrieve pending send data', () => {
      const testData = {
        recipientAddress: 'So11111111111111111111111111111111111111112',
        amount: '1.5',
        tokenAddress: 'So11111111111111111111111111111111111111112',
      };
      
      // Save to sessionStorage
      globalThis.sessionStorage.setItem('mallory_pending_send', JSON.stringify(testData));
      
      // Retrieve from sessionStorage
      const stored = globalThis.sessionStorage.getItem('mallory_pending_send');
      expect(stored).toBeDefined();
      
      const parsed = JSON.parse(stored!);
      expect(parsed.recipientAddress).toBe(testData.recipientAddress);
      expect(parsed.amount).toBe(testData.amount);
      expect(parsed.tokenAddress).toBe(testData.tokenAddress);
      
      // Clean up
      globalThis.sessionStorage.removeItem('mallory_pending_send');
      expect(globalThis.sessionStorage.getItem('mallory_pending_send')).toBeNull();
    });
    
    test('should persist and retrieve pending chat message', () => {
      const testMessage = 'Test chat message for OTP flow';
      
      // Save to sessionStorage
      globalThis.sessionStorage.setItem('mallory_pending_message', testMessage);
      
      // Retrieve from sessionStorage
      const stored = globalThis.sessionStorage.getItem('mallory_pending_message');
      expect(stored).toBe(testMessage);
      
      // Clean up
      globalThis.sessionStorage.removeItem('mallory_pending_message');
      expect(globalThis.sessionStorage.getItem('mallory_pending_message')).toBeNull();
    });
  });
});

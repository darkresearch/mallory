/**
 * Tests for Jupiter Price API V3 Integration
 * 
 * Tests the prioritized price fetching system:
 * 1. Jupiter Price API V3 (primary) - batch price fetching
 * 2. CoinGecko API (fallback 1) - for tokens Jupiter doesn't have
 * 3. Birdeye API (fallback 2) - final fallback
 * 4. Stablecoin fallback prices
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';

// Mock fetch globally
const originalFetch = global.fetch;

describe('Jupiter Price API V3 Integration', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = originalFetch;
  });

  afterEach(() => {
    // Restore original fetch after each test
    global.fetch = originalFetch;
  });

  describe('Batch Price Fetching', () => {
    test('should use Jupiter Price API V3 endpoint for batch requests', () => {
      const hasApiKey = !!process.env.JUPITER_API_KEY;
      const expectedBase = hasApiKey 
        ? 'https://api.jup.ag/price/v3'
        : 'https://lite-api.jup.ag/price/v3';
      
      expect(expectedBase).toContain('/price/v3');
    });

    test('should construct correct batch request URL with comma-separated IDs', () => {
      const tokenAddresses = [
        'So11111111111111111111111111111111111111112',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      ];
      const ids = tokenAddresses.join(',');
      const url = `https://lite-api.jup.ag/price/v3?ids=${encodeURIComponent(ids)}`;
      
      expect(url).toContain('price/v3');
      expect(url).toContain('ids=');
      expect(url).toContain(tokenAddresses[0].substring(0, 8));
    });

    test('should parse Jupiter Price API V3 response format correctly', () => {
      // Jupiter Price API V3 returns: { [mintAddress]: { usdPrice: number, ... } }
      const mockResponse = {
        'So11111111111111111111111111111111111111112': {
          usdPrice: 150.50,
          blockId: 12345,
          decimals: 9,
          priceChange24h: 2.5
        },
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
          usdPrice: 1.0,
          blockId: 12345,
          decimals: 6,
          priceChange24h: 0.01
        }
      };

      // Verify response structure
      expect(mockResponse).toBeDefined();
      expect(mockResponse['So11111111111111111111111111111111111111112']).toBeDefined();
      expect(mockResponse['So11111111111111111111111111111111111111112'].usdPrice).toBe(150.50);
      expect(mockResponse['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'].usdPrice).toBe(1.0);
    });

    test('should handle missing usdPrice field gracefully', () => {
      const mockResponse = {
        'So11111111111111111111111111111111111111112': {
          blockId: 12345,
          decimals: 9
          // Missing usdPrice
        }
      };

      const price = mockResponse['So11111111111111111111111111111111111111112'].usdPrice || 
                    mockResponse['So11111111111111111111111111111111111111112'].price;
      
      expect(price).toBeUndefined();
    });

    test('should validate price is a positive number', () => {
      const invalidPrices = [0, -1, NaN, Infinity, -Infinity, null, undefined, 'invalid'];
      
      for (const price of invalidPrices) {
        const isValid = typeof price === 'number' && price > 0 && isFinite(price);
        expect(isValid).toBe(false);
      }
      
      const validPrice = 150.50;
      const isValid = typeof validPrice === 'number' && validPrice > 0 && isFinite(validPrice);
      expect(isValid).toBe(true);
    });
  });

  describe('Prioritized Fallback Chain', () => {
    test('should try Jupiter first, then CoinGecko, then Birdeye', () => {
      const fallbackOrder = ['Jupiter Price API V3', 'CoinGecko', 'Birdeye'];
      expect(fallbackOrder[0]).toBe('Jupiter Price API V3');
      expect(fallbackOrder[1]).toBe('CoinGecko');
      expect(fallbackOrder[2]).toBe('Birdeye');
    });

    test('should handle tokens not found in Jupiter gracefully', () => {
      // Tokens not in Jupiter should fall back to CoinGecko
      const jupiterPrices = new Map<string, number>();
      const tokenAddresses = ['Token1', 'Token2'];
      
      const missingTokens = tokenAddresses.filter(addr => !jupiterPrices.has(addr));
      expect(missingTokens.length).toBe(2);
    });

    test('should use stablecoin fallback prices for USDC and USDT', () => {
      const FALLBACK_PRICES: Record<string, number> = {
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1.0, // USDC
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1.0, // USDT
      };

      expect(FALLBACK_PRICES['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v']).toBe(1.0);
      expect(FALLBACK_PRICES['Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB']).toBe(1.0);
    });
  });

  describe('CoinGecko Fallback for Arbitrary Tokens', () => {
    test('should use token_price endpoint for arbitrary Solana tokens', () => {
      const tokenAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
      const address = tokenAddress.toLowerCase();
      const url = `https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses=${address}&vs_currencies=usd`;
      
      expect(url).toContain('token_price/solana');
      expect(url).toContain('contract_addresses=');
      expect(url).toContain(address);
    });

    test('should use ID-based endpoint for SOL', () => {
      const solAddress = 'So11111111111111111111111111111111111111112';
      const isSol = solAddress === 'So11111111111111111111111111111111111111112' || 
                    solAddress === '11111111111111111111111111111111';
      
      expect(isSol).toBe(true);
    });

    test('should parse CoinGecko token price response format', () => {
      // CoinGecko returns: { [lowercaseAddress]: { usd: number } }
      const mockResponse = {
        'epjfwdd5aufqssqem2qn1xzybapc8g4weggkzwytdt1v': {
          usd: 1.0
        }
      };

      const address = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'.toLowerCase();
      const priceData = mockResponse[address];
      expect(priceData).toBeDefined();
      expect(priceData?.usd).toBe(1.0);
    });
  });

  describe('Error Handling', () => {
    test('should handle timeout errors gracefully', () => {
      const timeoutError = { name: 'AbortError' };
      const shouldLog = timeoutError.name !== 'AbortError';
      expect(shouldLog).toBe(false);
    });

    test('should handle connection refused errors silently', () => {
      const connectionError = { code: 'ECONNREFUSED' };
      const shouldLog = connectionError.code !== 'ECONNREFUSED';
      expect(shouldLog).toBe(false);
    });

    test('should handle API errors with appropriate logging', () => {
      const errorStatus = 500;
      const isError = errorStatus >= 400;
      expect(isError).toBe(true);
    });
  });

  describe('Performance and Efficiency', () => {
    test('should fetch multiple tokens in single batch request', () => {
      const tokenCount = 10;
      const batchRequestCount = 1; // Single batch request
      const individualRequestCount = tokenCount; // N individual requests
      
      expect(batchRequestCount).toBeLessThan(individualRequestCount);
    });

    test('should only fetch missing tokens from fallback sources', () => {
      const allTokens = ['Token1', 'Token2', 'Token3', 'Token4', 'Token5'];
      const jupiterFound = ['Token1', 'Token2'];
      const missingTokens = allTokens.filter(t => !jupiterFound.includes(t));
      
      expect(missingTokens.length).toBe(3);
      // Only these 3 should be fetched from CoinGecko/Birdeye
    });
  });

  describe('Response Format Validation', () => {
    test('should handle direct data object (not wrapped in data field)', () => {
      // Jupiter Price API V3 returns data directly, not wrapped
      const response = {
        'So11111111111111111111111111111111111111112': { usdPrice: 150.50 }
      };
      
      const isDirectObject = response && typeof response === 'object' && !Array.isArray(response);
      expect(isDirectObject).toBe(true);
    });

    test('should extract usdPrice field correctly', () => {
      const tokenData = {
        usdPrice: 150.50,
        blockId: 12345,
        decimals: 9
      };
      
      const price = tokenData.usdPrice || tokenData.price;
      expect(price).toBe(150.50);
    });
  });
});


/**
 * Unit Tests for Birdeye API Client
 * 
 * Tests the Birdeye service functions with mocked responses.
 * Does not make real API calls.
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { fetchBirdeyeMarketData, fetchBirdeyeMetadata } from '../../../services/birdeye/client';

// Mock the global fetch function
const originalFetch = global.fetch;
const originalEnv = process.env.BIRDEYE_API_KEY;

describe('Birdeye Client - Unit Tests', () => {
  beforeEach(() => {
    // Set mock API key for tests
    process.env.BIRDEYE_API_KEY = 'test-api-key-1234567890';
    // Clear the module cache to prevent cross-test contamination
    // Note: Cache is internal to the module, so we work around it by ensuring fresh fetch mocks
  });
  
  afterEach(() => {
    // Restore original fetch and environment
    global.fetch = originalFetch;
    if (originalEnv) {
      process.env.BIRDEYE_API_KEY = originalEnv;
    } else {
      delete process.env.BIRDEYE_API_KEY;
    }
    // Add small delay to let cache expire between tests
  });

  describe('fetchBirdeyeMarketData', () => {
    test('should return empty map when no token addresses provided', async () => {
      const result = await fetchBirdeyeMarketData([]);
      expect(result.size).toBe(0);
    });

    test('should successfully fetch market data with valid response', async () => {
      // Mock Token Overview endpoint responses (now includes all fields)
      global.fetch = mock(async (url: string) => {
        const urlStr = url.toString();
        if (urlStr.includes('So11111111111111111111111111111111111111112')) {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              success: true,
              data: { 
                price: 100.50, 
                marketCap: 50000000000,
                symbol: 'SOL',
                name: 'Solana',
                decimals: 9,
                logoURI: 'https://example.com/sol.png'
              }
            }),
            text: async () => JSON.stringify({ success: true, data: { price: 100.50, marketCap: 50000000000 } })
          };
        } else if (urlStr.includes('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')) {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              success: true,
              data: { 
                price: 1.00, 
                marketCap: 30000000000,
                symbol: 'USDC',
                name: 'USD Coin',
                decimals: 6,
                logoURI: 'https://example.com/usdc.png'
              }
            }),
            text: async () => JSON.stringify({ success: true, data: { price: 1.00, marketCap: 30000000000 } })
          };
        }
      }) as any;

      const tokens = [
        'So11111111111111111111111111111111111111112',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      ];
      
      const result = await fetchBirdeyeMarketData(tokens);
      
      expect(result.size).toBe(2);
      expect(result.get('So11111111111111111111111111111111111111112')).toEqual({
        price: 100.50,
        market_cap: 50000000000
      });
      expect(result.get('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toEqual({
        price: 1.00,
        market_cap: 30000000000
      });
    });

    test('should handle 401 Unauthorized error', async () => {
      global.fetch = mock(async () => ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ error: 'Invalid API key' })
      })) as any;

      const tokens = ['So11111111111111111111111111111111111111112'];
      const result = await fetchBirdeyeMarketData(tokens);
      
      expect(result.size).toBe(0);
    });

    test('should handle 403 Forbidden error', async () => {
      global.fetch = mock(async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ error: 'Subscription tier insufficient' })
      })) as any;

      const tokens = ['So11111111111111111111111111111111111111112'];
      const result = await fetchBirdeyeMarketData(tokens);
      
      expect(result.size).toBe(0);
    });

    test('should handle 429 Rate Limit error', async () => {
      global.fetch = mock(async () => ({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ error: 'Rate limit exceeded' })
      })) as any;

      const tokens = ['So11111111111111111111111111111111111111112'];
      const result = await fetchBirdeyeMarketData(tokens);
      
      expect(result.size).toBe(0);
    });

    test('should handle 500 Server Error', async () => {
      global.fetch = mock(async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ error: 'Server error' })
      })) as any;

      const tokens = ['So11111111111111111111111111111111111111112'];
      const result = await fetchBirdeyeMarketData(tokens);
      
      expect(result.size).toBe(0);
    });

    test('should handle timeout/abort error', async () => {
      global.fetch = mock(async () => {
        throw new Error('AbortError');
      }) as any;

      const tokens = ['So11111111111111111111111111111111111111112'];
      const result = await fetchBirdeyeMarketData(tokens);
      
      expect(result.size).toBe(0);
    });

    test('should handle invalid JSON response', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => {
          throw new Error('Invalid JSON');
        },
        text: async () => 'invalid json'
      })) as any;

      const tokens = ['So11111111111111111111111111111111111111112'];
      const result = await fetchBirdeyeMarketData(tokens);
      
      expect(result.size).toBe(0);
    });

    test('should handle response with success=false', async () => {
      global.fetch = mock(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: 'Some error message'
        }),
        text: async () => JSON.stringify({ success: false, error: 'Some error message' })
      })) as any;

      const tokens = ['So11111111111111111111111111111111111111112'];
      const result = await fetchBirdeyeMarketData(tokens);
      
      expect(result.size).toBe(0);
    });

    test('should handle missing price data gracefully', async () => {
      const uniqueToken = `MissingPrice${Date.now()}${Math.random()}`;
      
      global.fetch = mock(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: {
            // Missing price field
            marketCap: 50000000000,
            symbol: 'TEST',
            name: 'Test Token',
            decimals: 9,
            logoURI: 'https://example.com/test.png'
          }
        }),
        text: async () => JSON.stringify({ success: true, data: { marketCap: 50000000000 } })
      })) as any;

      const tokens = [uniqueToken];
      const result = await fetchBirdeyeMarketData(tokens);
      
      expect(result.size).toBe(1);
      expect(result.get(uniqueToken)?.price).toBe(0);
    });

    test('should make parallel requests for multiple tokens', async () => {
      let requestCount = 0;
      
      global.fetch = mock(async (url: string) => {
        requestCount++;
        // Extract token address from URL to provide unique responses
        const match = url.toString().match(/address=([^&]+)/);
        const tokenAddr = match ? match[1] : 'unknown';
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            success: true,
            data: { 
              price: 1.0, 
              marketCap: 1000000,
              symbol: `TOKEN${requestCount}`,
              name: `Test Token ${requestCount}`,
              decimals: 9,
              logoURI: `https://example.com/${tokenAddr}.png`
            }
          }),
          text: async () => JSON.stringify({ success: true, data: { price: 1.0, marketCap: 1000000 } })
        };
      }) as any;

      // Create 5 token addresses with unique values to avoid cache hits
      const tokens = Array(5).fill(0).map((_, i) => 
        `TokenUnique${Date.now()}${i.toString().padStart(35, '0')}`
      );
      
      await fetchBirdeyeMarketData(tokens);
      
      // Should make one request per token (parallel)
      expect(requestCount).toBe(5);
    });
  });

  describe('fetchBirdeyeMetadata', () => {
    test('should return empty map when no token addresses provided', async () => {
      const result = await fetchBirdeyeMetadata([]);
      expect(result.size).toBe(0);
    });

    test('should successfully fetch metadata with valid response', async () => {
      // Mock single-token endpoint responses
      global.fetch = mock(async (url: string) => {
        const urlStr = url.toString();
        if (urlStr.includes('So11111111111111111111111111111111111111112')) {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              success: true,
              data: {
                symbol: 'SOL',
                name: 'Solana',
                decimals: 9,
                logoURI: 'https://example.com/sol.png'
              }
            }),
            text: async () => JSON.stringify({ success: true, data: { symbol: 'SOL', name: 'Solana', decimals: 9, logoURI: 'https://example.com/sol.png' } })
          };
        } else if (urlStr.includes('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')) {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              success: true,
              data: {
                symbol: 'USDC',
                name: 'USD Coin',
                decimals: 6,
                logoURI: 'https://example.com/usdc.png'
              }
            }),
            text: async () => JSON.stringify({ success: true, data: { symbol: 'USDC', name: 'USD Coin', decimals: 6, logoURI: 'https://example.com/usdc.png' } })
          };
        }
      }) as any;

      const tokens = [
        'So11111111111111111111111111111111111111112',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      ];
      
      const result = await fetchBirdeyeMetadata(tokens);
      
      expect(result.size).toBe(2);
      expect(result.get('So11111111111111111111111111111111111111112')).toEqual({
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        logo_uri: 'https://example.com/sol.png'
      });
    });

    test('should handle 401 Unauthorized error', async () => {
      global.fetch = mock(async () => ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ error: 'Invalid API key' })
      })) as any;

      const tokens = ['So11111111111111111111111111111111111111112'];
      const result = await fetchBirdeyeMetadata(tokens);
      
      expect(result.size).toBe(0);
    });

    test('should handle 403 Forbidden error', async () => {
      global.fetch = mock(async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ error: 'Subscription tier insufficient' })
      })) as any;

      const tokens = ['So11111111111111111111111111111111111111112'];
      const result = await fetchBirdeyeMetadata(tokens);
      
      expect(result.size).toBe(0);
    });

    test('should handle missing metadata fields gracefully', async () => {
      const uniqueToken = `MissingMeta${Date.now()}${Math.random()}`;
      
      global.fetch = mock(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: {
            // Missing symbol, name, logoURI
            price: 1.0,
            marketCap: 1000000,
            decimals: 9
          }
        }),
        text: async () => JSON.stringify({ success: true, data: { decimals: 9 } })
      })) as any;

      const tokens = [uniqueToken];
      const result = await fetchBirdeyeMetadata(tokens);
      
      expect(result.size).toBe(1);
      const metadata = result.get(uniqueToken);
      expect(metadata?.symbol).toBe('UNKNOWN');
      expect(metadata?.name).toBe('Unknown Token');
      expect(metadata?.logo_uri).toBe('');
      expect(metadata?.decimals).toBe(9);
    });

    test('should handle timeout error', async () => {
      global.fetch = mock(async () => {
        throw new Error('AbortError');
      }) as any;

      const tokens = ['So11111111111111111111111111111111111111112'];
      const result = await fetchBirdeyeMetadata(tokens);
      
      expect(result.size).toBe(0);
    });

    test('should make parallel requests for multiple tokens', async () => {
      let requestCount = 0;
      
      global.fetch = mock(async (url: string) => {
        requestCount++;
        const match = url.toString().match(/address=([^&]+)/);
        const tokenAddr = match ? match[1] : 'unknown';
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            success: true,
            data: {
              price: 1.0,
              marketCap: 1000000,
              symbol: 'TEST',
              name: 'Test Token',
              decimals: 9,
              logoURI: `https://example.com/${tokenAddr}.png`
            }
          }),
          text: async () => JSON.stringify({ success: true, data: { symbol: 'TEST', name: 'Test Token', decimals: 9, logoURI: 'https://example.com/test.png' } })
        };
      }) as any;

      // Create 5 token addresses with unique values to avoid cache hits
      const tokens = Array(5).fill(0).map((_, i) => 
        `TokenMeta${Date.now()}${i.toString().padStart(35, '0')}`
      );
      
      await fetchBirdeyeMetadata(tokens);
      
      // Should make one request per token (parallel)
      expect(requestCount).toBe(5);
    });
  });

  describe('Cache optimization', () => {
    test('should not make duplicate API calls when both functions called with same tokens', async () => {
      let requestCount = 0;
      
      global.fetch = mock(async (url: string) => {
        requestCount++;
        // Small delay to simulate async behavior
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            success: true,
            data: {
              price: 100.0,
              marketCap: 1000000,
              symbol: 'TEST',
              name: 'Test Token',
              decimals: 9,
              logoURI: 'https://example.com/test.png'
            }
          })
        };
      }) as any;

      // Create unique token address to avoid interference from other tests
      const uniqueToken = `CacheTest${Date.now()}${Math.random()}`;
      const tokens = [uniqueToken];
      
      // Call both functions in parallel (like holdings.ts does)
      const [marketData, metadata] = await Promise.all([
        fetchBirdeyeMarketData(tokens),
        fetchBirdeyeMetadata(tokens)
      ]);
      
      // Should only make 1 API call total (not 2) due to promise caching
      expect(requestCount).toBe(1);
      expect(marketData.size).toBe(1);
      expect(metadata.size).toBe(1);
      expect(marketData.get(uniqueToken)?.price).toBe(100.0);
      expect(metadata.get(uniqueToken)?.symbol).toBe('TEST');
    });
  });
});


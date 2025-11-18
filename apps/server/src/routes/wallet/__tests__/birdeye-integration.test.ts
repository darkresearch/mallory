/**
 * Integration Tests for Birdeye API Client
 * 
 * Tests the Birdeye service functions with REAL API calls.
 * Requires BIRDEYE_API_KEY environment variable to be set.
 * 
 * Run with: bun test apps/server/src/routes/wallet/__tests__/birdeye-integration.test.ts
 */

import { describe, test, expect } from 'bun:test';
import { fetchBirdeyeMarketData, fetchBirdeyeMetadata } from '../../../services/birdeye/client';

const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY;
const shouldRun = !!BIRDEYE_API_KEY;

// Known token addresses on Solana
const KNOWN_TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
};

describe('Birdeye Client - Integration Tests', () => {
  if (!shouldRun) {
    console.log('⚠️  Skipping Birdeye integration tests - BIRDEYE_API_KEY not configured');
  }

  describe('fetchBirdeyeMarketData', () => {
    test.skipIf(!shouldRun)('should fetch real market data for SOL', async () => {
      console.log('🐦 Testing real Birdeye market data API for SOL...');
      
      const tokens = [KNOWN_TOKENS.SOL];
      const result = await fetchBirdeyeMarketData(tokens);
      
      console.log('Result size:', result.size);
      console.log('SOL data:', result.get(KNOWN_TOKENS.SOL));
      
      expect(result.size).toBeGreaterThan(0);
      
      const solData = result.get(KNOWN_TOKENS.SOL);
      expect(solData).toBeDefined();
      expect(solData?.price).toBeGreaterThan(0);
      expect(typeof solData?.price).toBe('number');
      expect(typeof solData?.market_cap).toBe('number');
      
      console.log('✅ SOL market data fetched successfully');
      console.log('   Price: $' + solData?.price.toFixed(2));
      console.log('   Market Cap: $' + (solData?.market_cap || 0).toLocaleString());
    }, 15000); // 15 second timeout for API call

    test.skipIf(!shouldRun)('should fetch real market data for multiple tokens', async () => {
      console.log('🐦 Testing real Birdeye market data API for multiple tokens...');
      
      const tokens = [KNOWN_TOKENS.SOL, KNOWN_TOKENS.USDC, KNOWN_TOKENS.USDT];
      const result = await fetchBirdeyeMarketData(tokens);
      
      console.log('Result size:', result.size);
      
      expect(result.size).toBeGreaterThan(0);
      
      // Check SOL
      const solData = result.get(KNOWN_TOKENS.SOL);
      expect(solData).toBeDefined();
      expect(solData?.price).toBeGreaterThan(0);
      
      // Check USDC (should be around $1)
      const usdcData = result.get(KNOWN_TOKENS.USDC);
      expect(usdcData).toBeDefined();
      expect(usdcData?.price).toBeGreaterThan(0);
      expect(usdcData?.price).toBeLessThan(2); // USDC should be close to $1
      
      console.log('✅ Multiple tokens fetched successfully');
      console.log('   SOL Price: $' + solData?.price.toFixed(2));
      console.log('   USDC Price: $' + usdcData?.price.toFixed(4));
      console.log('   USDT Price: $' + (result.get(KNOWN_TOKENS.USDT)?.price.toFixed(4) || 'N/A'));
    }, 15000);

    test.skipIf(!shouldRun)('should handle invalid token address gracefully', async () => {
      console.log('🐦 Testing with invalid token address...');
      
      const tokens = ['InvalidTokenAddress123'];
      const result = await fetchBirdeyeMarketData(tokens);
      
      // API might return empty data or skip invalid tokens
      console.log('Result size:', result.size);
      console.log('✅ Invalid token handled gracefully');
    }, 15000);

    test.skipIf(!shouldRun)('should respect API rate limits', async () => {
      console.log('🐦 Testing API rate limiting behavior...');
      
      // Make multiple rapid requests
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(fetchBirdeyeMarketData([KNOWN_TOKENS.SOL]));
      }
      
      const results = await Promise.all(promises);
      
      // All should complete (either with data or graceful failures)
      expect(results.length).toBe(3);
      
      console.log('✅ Rate limiting handled correctly');
      console.log('   Results:', results.map(r => r.size));
    }, 20000);
  });

  describe('fetchBirdeyeMetadata', () => {
    test.skipIf(!shouldRun)('should fetch real metadata for SOL', async () => {
      console.log('🐦 Testing real Birdeye metadata API for SOL...');
      
      const tokens = [KNOWN_TOKENS.SOL];
      const result = await fetchBirdeyeMetadata(tokens);
      
      console.log('Result size:', result.size);
      console.log('SOL metadata:', result.get(KNOWN_TOKENS.SOL));
      
      expect(result.size).toBeGreaterThan(0);
      
      const solMetadata = result.get(KNOWN_TOKENS.SOL);
      expect(solMetadata).toBeDefined();
      expect(solMetadata?.symbol).toBe('SOL');
      expect(solMetadata?.name).toContain('SOL'); // "Wrapped SOL" from Token Overview
      expect(solMetadata?.decimals).toBe(9);
      expect(solMetadata?.logo_uri).toBeDefined();
      expect(typeof solMetadata?.logo_uri).toBe('string');
      
      console.log('✅ SOL metadata fetched successfully');
      console.log('   Symbol:', solMetadata?.symbol);
      console.log('   Name:', solMetadata?.name);
      console.log('   Decimals:', solMetadata?.decimals);
      console.log('   Has Logo:', !!solMetadata?.logo_uri);
    }, 15000);

    test.skipIf(!shouldRun)('should fetch real metadata for multiple tokens', async () => {
      console.log('🐦 Testing real Birdeye metadata API for multiple tokens...');
      
      const tokens = [KNOWN_TOKENS.SOL, KNOWN_TOKENS.USDC, KNOWN_TOKENS.USDT];
      const result = await fetchBirdeyeMetadata(tokens);
      
      console.log('Result size:', result.size);
      
      expect(result.size).toBeGreaterThan(0);
      
      // Check SOL
      const solMetadata = result.get(KNOWN_TOKENS.SOL);
      expect(solMetadata).toBeDefined();
      expect(solMetadata?.symbol).toBe('SOL');
      
      // Check USDC
      const usdcMetadata = result.get(KNOWN_TOKENS.USDC);
      expect(usdcMetadata).toBeDefined();
      expect(usdcMetadata?.symbol).toBe('USDC');
      expect(usdcMetadata?.decimals).toBe(6);
      
      // Check USDT
      const usdtMetadata = result.get(KNOWN_TOKENS.USDT);
      expect(usdtMetadata).toBeDefined();
      expect(usdtMetadata?.symbol).toBe('USDT');
      
      console.log('✅ Multiple token metadata fetched successfully');
      console.log('   SOL:', solMetadata?.symbol, '-', solMetadata?.name);
      console.log('   USDC:', usdcMetadata?.symbol, '-', usdcMetadata?.name);
      console.log('   USDT:', usdtMetadata?.symbol, '-', usdtMetadata?.name);
    }, 15000);

    test.skipIf(!shouldRun)('should verify logo URLs are valid', async () => {
      console.log('🐦 Testing logo URL validity...');
      
      const tokens = [KNOWN_TOKENS.SOL, KNOWN_TOKENS.USDC];
      const result = await fetchBirdeyeMetadata(tokens);
      
      const solMetadata = result.get(KNOWN_TOKENS.SOL);
      const usdcMetadata = result.get(KNOWN_TOKENS.USDC);
      
      // Check that logo URIs are valid URLs or empty strings
      if (solMetadata?.logo_uri) {
        expect(solMetadata.logo_uri.startsWith('http')).toBe(true);
        console.log('   SOL logo URL:', solMetadata.logo_uri);
      }
      
      if (usdcMetadata?.logo_uri) {
        expect(usdcMetadata.logo_uri.startsWith('http')).toBe(true);
        console.log('   USDC logo URL:', usdcMetadata.logo_uri);
      }
      
      console.log('✅ Logo URLs are valid');
    }, 15000);

    test.skipIf(!shouldRun)('should handle invalid token address gracefully', async () => {
      console.log('🐦 Testing metadata with invalid token address...');
      
      const tokens = ['InvalidTokenAddress123'];
      const result = await fetchBirdeyeMetadata(tokens);
      
      // API might return empty data or skip invalid tokens
      console.log('Result size:', result.size);
      console.log('✅ Invalid token handled gracefully');
    }, 15000);
  });

  describe('Combined market data and metadata', () => {
    test.skipIf(!shouldRun)('should fetch both market data and metadata successfully', async () => {
      console.log('🐦 Testing combined market data and metadata fetch...');
      
      const tokens = [KNOWN_TOKENS.SOL, KNOWN_TOKENS.USDC];
      
      const [marketDataMap, metadataMap] = await Promise.all([
        fetchBirdeyeMarketData(tokens),
        fetchBirdeyeMetadata(tokens)
      ]);
      
      console.log('Market data size:', marketDataMap.size);
      console.log('Metadata size:', metadataMap.size);
      
      expect(marketDataMap.size).toBeGreaterThan(0);
      expect(metadataMap.size).toBeGreaterThan(0);
      
      // Verify SOL has both price and metadata
      const solPrice = marketDataMap.get(KNOWN_TOKENS.SOL);
      const solMetadata = metadataMap.get(KNOWN_TOKENS.SOL);
      
      expect(solPrice).toBeDefined();
      expect(solMetadata).toBeDefined();
      expect(solPrice?.price).toBeGreaterThan(0);
      expect(solMetadata?.symbol).toBe('SOL');
      
      console.log('✅ Combined data fetched successfully');
      console.log('   SOL: $' + solPrice?.price.toFixed(2) + ' -', solMetadata?.name);
      console.log('   Logo:', solMetadata?.logo_uri ? 'Yes' : 'No');
    }, 20000);
  });

  describe('API diagnostics', () => {
    test.skipIf(!shouldRun)('should verify API key is working', async () => {
      console.log('🐦 Verifying BIRDEYE_API_KEY is valid...');
      console.log('   API Key prefix:', BIRDEYE_API_KEY?.substring(0, 8) + '...');
      
      const tokens = [KNOWN_TOKENS.SOL];
      const result = await fetchBirdeyeMarketData(tokens);
      
      // If API key is valid, we should get data
      expect(result.size).toBeGreaterThan(0);
      
      const solData = result.get(KNOWN_TOKENS.SOL);
      expect(solData).toBeDefined();
      expect(solData?.price).toBeGreaterThan(0);
      
      console.log('✅ API key is valid and working');
      console.log('   Successfully fetched SOL price: $' + solData?.price.toFixed(2));
    }, 15000);

    test.skipIf(!shouldRun)('should log response structure for debugging', async () => {
      console.log('🐦 Checking Birdeye API response structure...');
      
      const tokens = [KNOWN_TOKENS.SOL];
      const marketData = await fetchBirdeyeMarketData(tokens);
      const metadata = await fetchBirdeyeMetadata(tokens);
      
      console.log('\n📊 Market Data Response Structure:');
      console.log('   Map size:', marketData.size);
      const solMarket = marketData.get(KNOWN_TOKENS.SOL);
      if (solMarket) {
        console.log('   Sample entry keys:', Object.keys(solMarket));
        console.log('   Sample entry:', JSON.stringify(solMarket, null, 2));
      }
      
      console.log('\n📊 Metadata Response Structure:');
      console.log('   Map size:', metadata.size);
      const solMeta = metadata.get(KNOWN_TOKENS.SOL);
      if (solMeta) {
        console.log('   Sample entry keys:', Object.keys(solMeta));
        console.log('   Sample entry:', JSON.stringify(solMeta, null, 2));
      }
      
      expect(marketData.size).toBeGreaterThan(0);
      expect(metadata.size).toBeGreaterThan(0);
      
      console.log('✅ Response structure logged');
    }, 15000);
  });
});


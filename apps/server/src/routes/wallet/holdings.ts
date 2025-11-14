import express, { Request, Response, Router } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../../middleware/auth.js';
import { supabase } from '../../lib/supabase.js';
import type { HoldingsResponse, TokenHolding } from '@darkresearch/mallory-shared';
import { fetchBirdeyeMarketData, fetchBirdeyeMetadata } from '../../services/birdeye/client.js';

const router: Router = express.Router();

interface GridBalanceResponse {
  data: {
    address: string;
    lamports: number;
    sol: number;
    tokens: Array<{
      token_address: string;
      amount: number;
      amount_decimal: string;
      decimals: number;
      symbol: string;
      name: string;
      logo_url?: string;
    }>;
  };
  metadata: {
    request_id: string;
    timestamp: string;
  };
}

// Import types from birdeye service
type BirdeyeMarketData = { price?: number; market_cap?: number };
type BirdeyeMetadata = { symbol?: string; name?: string; logo_uri?: string; decimals?: number };

/**
 * Fallback prices for stablecoins only (these should always be ~1.0)
 */
const FALLBACK_PRICES: Record<string, number> = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1.0, // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1.0, // USDT
};

/**
 * Fetch SOL price from CoinGecko (free, no API key needed)
 */
async function fetchSolPriceFromCoinGecko(): Promise<number | null> {
  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, { 
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json() as any;
      if (data.solana?.usd) {
        const price = data.solana.usd;
        console.log('💰 [CoinGecko] SOL price fetched:', price.toFixed(2));
        return price;
      }
    } else {
      console.warn('💰 [CoinGecko] API error:', response.status);
    }
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      console.error('💰 [CoinGecko] Error fetching SOL price:', error.message);
    }
  }
  return null;
}

/**
 * Fetch token price from CoinGecko using contract address (for arbitrary Solana tokens)
 * Special handling for SOL which uses ID-based API instead of contract address
 */
async function fetchTokenPriceFromCoinGecko(tokenAddress: string): Promise<number | null> {
  try {
    // Special case: SOL uses ID-based API, not contract address
    const solAddress = 'So11111111111111111111111111111111111111112';
    if (tokenAddress === solAddress || tokenAddress === '11111111111111111111111111111111') {
      return await fetchSolPriceFromCoinGecko();
    }
    
    // CoinGecko uses lowercase addresses for Solana tokens
    const address = tokenAddress.toLowerCase();
    const url = `https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses=${address}&vs_currencies=usd`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, { 
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json() as any;
      // CoinGecko returns data with lowercase address as key
      const priceData = data[address];
      if (priceData?.usd) {
        const price = priceData.usd;
        console.log(`💰 [CoinGecko] Token ${tokenAddress.substring(0, 8)}... price fetched:`, price.toFixed(6));
        return price;
      }
    } else {
      console.warn(`💰 [CoinGecko] API error for token ${tokenAddress.substring(0, 8)}...:`, response.status);
    }
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      console.error(`💰 [CoinGecko] Error fetching token price for ${tokenAddress.substring(0, 8)}...:`, error.message);
    }
  }
  return null;
}

/**
 * Fetch SOL price from Jupiter Price API V3 (real-time price source)
 * Uses the dedicated Price API V3 endpoint
 */
async function fetchSolPriceFromJupiter(): Promise<number | null> {
  const solMint = 'So11111111111111111111111111111111111111112';
  const prices = await fetchTokenPricesFromJupiter([solMint]);
  return prices.get(solMint) || null;
}

/**
 * Fetch token prices from Jupiter Price API V3 for multiple tokens (batch request)
 * Uses Jupiter's dedicated Price API V3 endpoint for efficient price fetching
 * Reference: https://hub.jup.ag/docs/price-api/v3
 */
async function fetchTokenPricesFromJupiter(tokenAddresses: string[]): Promise<Map<string, number>> {
  const resultMap = new Map<string, number>();
  
  if (tokenAddresses.length === 0) return resultMap;
  
  try {
    // Use Jupiter Price API V3 (dedicated price endpoint)
    // Lite: https://lite-api.jup.ag/price/v3
    // Pro: https://api.jup.ag/price/v3
    const jupiterPriceApiBase = process.env.JUPITER_API_KEY 
      ? 'https://api.jup.ag/price/v3'
      : 'https://lite-api.jup.ag/price/v3';
    
    // Batch request: fetch prices for all tokens at once
    // API accepts comma-separated mint addresses via 'ids' parameter
    const ids = tokenAddresses.join(',');
    const url = `${jupiterPriceApiBase}?ids=${encodeURIComponent(ids)}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };
    
    if (process.env.JUPITER_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.JUPITER_API_KEY}`;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    console.log(`💰 [Jupiter Price API] Fetching prices for ${tokenAddresses.length} tokens:`, tokenAddresses.map(a => a.substring(0, 8) + '...').join(', '));
    console.log(`💰 [Jupiter Price API] Request URL:`, url);
    
    const response = await fetch(url, {
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json() as any;
      
      console.log(`💰 [Jupiter Price API] Response status: ${response.status}`);
      console.log(`💰 [Jupiter Price API] Response data keys:`, data ? Object.keys(data) : 'null');
      
      // Price API V3 returns data directly as: { [mintAddress]: { usdPrice: number, ... } }
      // NOT wrapped in a "data" object - the response IS the data object
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const dataKeys = Object.keys(data);
        console.log(`💰 [Jupiter Price API] Found ${dataKeys.length} tokens in response:`, dataKeys.map((k: string) => k.substring(0, 8) + '...').join(', '));
        
        for (const [mintAddress, priceData] of Object.entries(data)) {
          const tokenData = priceData as any;
          console.log(`💰 [Jupiter Price API] Processing ${mintAddress.substring(0, 8)}...:`, JSON.stringify(tokenData).substring(0, 200));
          
          // Price field is "usdPrice" (not "price")
          const price = tokenData.usdPrice || tokenData.price;
          if (price && typeof price === 'number' && price > 0) {
            resultMap.set(mintAddress, price);
            console.log(`💰 [Jupiter Price API] ✅ Token ${mintAddress.substring(0, 8)}... price:`, price.toFixed(6));
          } else {
            console.log(`💰 [Jupiter Price API] ❌ Token ${mintAddress.substring(0, 8)}... no valid price:`, tokenData);
          }
        }
      } else {
        console.warn(`💰 [Jupiter Price API] Unexpected response format:`, JSON.stringify(data).substring(0, 500));
      }
      
      // Log which tokens were NOT found in Jupiter response
      const foundAddresses = new Set(resultMap.keys());
      const missingAddresses = tokenAddresses.filter(addr => !foundAddresses.has(addr));
      if (missingAddresses.length > 0) {
        console.log(`💰 [Jupiter Price API] ⚠️  ${missingAddresses.length} tokens not found in response:`, missingAddresses.map(a => a.substring(0, 8) + '...').join(', '));
      }
    } else {
      const errorText = await response.text();
      console.warn(`💰 [Jupiter Price API] Error:`, response.status, errorText.substring(0, 200));
    }
  } catch (error: any) {
    if (error.name !== 'AbortError' && error.code !== 'ECONNREFUSED') {
      console.error(`💰 [Jupiter Price API] Error fetching prices:`, error.message);
    }
  }
  
  return resultMap;
}

/**
 * Fetch single token price from Jupiter Price API V3
 * Wrapper around batch function for single token requests
 */
async function fetchTokenPriceFromJupiter(tokenAddress: string, tokenDecimals: number = 9): Promise<number | null> {
  const prices = await fetchTokenPricesFromJupiter([tokenAddress]);
  return prices.get(tokenAddress) || null;
}

/**
 * Fetch SOL price with multiple fallbacks
 * Tries: Jupiter -> CoinGecko -> null
 */
async function fetchSolPriceWithFallbacks(): Promise<number | null> {
  // Try Jupiter first (most accurate for Solana)
  const jupiterPrice = await fetchSolPriceFromJupiter();
  if (jupiterPrice !== null) {
    return jupiterPrice;
  }
  
  // Fallback to CoinGecko
  const coinGeckoPrice = await fetchSolPriceFromCoinGecko();
  if (coinGeckoPrice !== null) {
    return coinGeckoPrice;
  }
  
  return null;
}


/**
 * Fetch market data for multiple tokens with prioritized fallbacks
 * Tries: Jupiter Price API V3 -> CoinGecko -> Birdeye for each token
 */
async function fetchTokenPricesWithFallbacks(
  tokens: Array<{ address: string; decimals: number }>
): Promise<Map<string, BirdeyeMarketData>> {
  const resultMap = new Map<string, BirdeyeMarketData>();
  
  if (tokens.length === 0) return resultMap;
  
  // Priority 1: Try Jupiter Price API V3 first (batch request for all tokens)
  const tokenAddresses = tokens.map(t => t.address);
  const jupiterPrices = await fetchTokenPricesFromJupiter(tokenAddresses);
  
  // Add Jupiter prices to result map
  for (const [address, price] of jupiterPrices.entries()) {
    if (price > 0) {
      resultMap.set(address, {
        price,
        market_cap: 0
      });
    }
  }
  
  // Find tokens that still need prices (Jupiter failed)
  const missingTokens = tokens.filter(t => !resultMap.has(t.address));
  
  if (missingTokens.length > 0) {
    console.log(`💰 [Fallback] ${missingTokens.length} tokens not found in Jupiter Price API (may be low liquidity, new tokens, or not traded recently), trying CoinGecko...`);
    
    // Priority 2: Try CoinGecko for remaining tokens (in parallel)
    const coinGeckoPromises = missingTokens.map(async (token) => {
      const price = await fetchTokenPriceFromCoinGecko(token.address);
      return { address: token.address, price };
    });
    
    const coinGeckoResults = await Promise.all(coinGeckoPromises);
    
    // Add CoinGecko prices to result map
    let coinGeckoFound = 0;
    for (const { address, price } of coinGeckoResults) {
      if (price !== null && price > 0 && !resultMap.has(address)) {
        resultMap.set(address, {
          price,
          market_cap: 0
        });
        coinGeckoFound++;
      }
    }
    
    if (coinGeckoFound > 0) {
      console.log(`💰 [Fallback] CoinGecko found prices for ${coinGeckoFound} token(s)`);
    }
    
    // Find tokens that still need prices (Jupiter + CoinGecko failed)
    const stillMissingTokens = missingTokens.filter(t => !resultMap.has(t.address));
    
    if (stillMissingTokens.length > 0) {
      console.log(`💰 [Fallback] ${stillMissingTokens.length} tokens still missing prices, trying Birdeye...`);
      
      // Priority 3: Fallback to Birdeye for remaining tokens
      const birdeyeAddresses = stillMissingTokens.map(t => t.address);
      const birdeyeData = await fetchBirdeyeMarketData(birdeyeAddresses);
      
      // Merge Birdeye results
      let birdeyeFound = 0;
      for (const [address, data] of birdeyeData.entries()) {
        if (!resultMap.has(address) && data.price && data.price > 0) {
          resultMap.set(address, data);
          birdeyeFound++;
        }
      }
      
      if (birdeyeFound > 0) {
        console.log(`💰 [Fallback] Birdeye found prices for ${birdeyeFound} token(s)`);
      }
      
      // Log final missing tokens
      const finalMissing = stillMissingTokens.filter(t => !resultMap.has(t.address));
      if (finalMissing.length > 0) {
        console.warn(`💰 [Fallback] ⚠️  ${finalMissing.length} token(s) still missing prices after all fallbacks:`, finalMissing.map(t => `${t.address.substring(0, 8)}... (${t.address})`).join(', '));
      }
    }
  }
  
  // Final fallback: Use hardcoded prices for stablecoins
  for (const token of tokens) {
    if (!resultMap.has(token.address) && FALLBACK_PRICES[token.address]) {
      resultMap.set(token.address, {
        price: FALLBACK_PRICES[token.address],
        market_cap: 0
      });
    }
  }
  
  return resultMap;
}

/**
 * Enhanced market data fetcher with fallback support
 * Uses Birdeye service first, then falls back to Jupiter/CoinGecko for SOL and stablecoins
 */
async function fetchMarketDataWithFallbacks(tokenAddresses: string[]): Promise<Map<string, BirdeyeMarketData>> {
  const resultMap = new Map<string, BirdeyeMarketData>();
  
  if (tokenAddresses.length === 0) return resultMap;

  // Try Birdeye first
  try {
    const birdeyeData = await fetchBirdeyeMarketData(tokenAddresses);
    
    // Copy successful results
    for (const [address, data] of birdeyeData) {
      if (data.price && data.price > 0) {
        resultMap.set(address, data);
      }
    }
  } catch (error) {
    console.error('💰 [Birdeye] Error in market data fetch:', error);
  }

  // Apply fallbacks for missing tokens
  const solAddress = 'So11111111111111111111111111111111111111112';
  
  // For SOL, try fallback sources if not found in Birdeye response
  if (tokenAddresses.includes(solAddress) && !resultMap.has(solAddress)) {
    const solPrice = await fetchSolPriceWithFallbacks();
    if (solPrice !== null) {
      resultMap.set(solAddress, {
        price: solPrice,
        market_cap: 0
      });
    }
  }
  
  // Use fallback prices only for stablecoins that weren't found
  for (const address of tokenAddresses) {
    if (FALLBACK_PRICES[address] && !resultMap.has(address)) {
      resultMap.set(address, {
        price: FALLBACK_PRICES[address],
        market_cap: 0
      });
    }
  }

  return resultMap;
}

/**
 * Get wallet holdings with price enrichment
 * GET /api/wallet/holdings?address=<wallet_address>
 * 
 * Query params:
 * - address: Solana wallet address (required)
 */
router.get('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const walletAddress = req.query.address as string;
    
    console.log('💰 Getting holdings for user:', user.id);

    // Validate wallet address is provided
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        holdings: [],
        totalValue: 0,
        error: 'Wallet address is required (query param: address)'
      } as HoldingsResponse);
    }

    console.log('💰 Wallet address:', walletAddress);

    // Fetch balances from Grid API
    const gridUrl = `https://grid.squads.xyz/api/grid/v1/accounts/${walletAddress}/balances`;
    console.log('💰 Fetching from Grid:', {
      url: gridUrl,
      environment: process.env.GRID_ENV || 'production',
      hasApiKey: !!process.env.GRID_API_KEY
    });

    const gridResponse = await fetch(gridUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.GRID_API_KEY}`,
        'x-grid-environment': process.env.GRID_ENV || 'production'
      }
    });

    console.log('💰 Grid API response status:', gridResponse.status);

    if (!gridResponse.ok) {
      const errorText = await gridResponse.text();
      console.error('💰 Grid API error response:', {
        status: gridResponse.status,
        statusText: gridResponse.statusText,
        body: errorText
      });
      throw new Error(`Grid API error: ${gridResponse.status} - ${errorText}`);
    }

    const gridData = await gridResponse.json() as GridBalanceResponse;
    console.log('💰 Grid API response data:', JSON.stringify(gridData, null, 2));

    if (!gridData.data) {
      console.error('💰 Grid response missing data field:', gridData);
      throw new Error('Failed to fetch balances from Grid - no data field');
    }

    const tokens = gridData.data.tokens || [];
    console.log('💰 Found', tokens.length, 'tokens from Grid');

    // Prepare tokens for enrichment
    const tokensToEnrich = tokens
      .filter(token => parseFloat(token.amount_decimal) > 0)
      .map(token => {
        // Convert native SOL to wSOL for Birdeye
        let address = token.token_address;
        if (address === '11111111111111111111111111111111') {
          address = 'So11111111111111111111111111111111111111112';
        }
        return {
          address,
          symbol: token.symbol,
          name: token.name,
          holdings: parseFloat(token.amount_decimal),
          decimals: token.decimals,
          balance: token.amount
        };
      });

    // Fetch price data from Birdeye in parallel with fallbacks
    const tokenAddresses = tokensToEnrich.map(t => t.address);
    console.log('💰 Fetching prices for tokens with prioritized fallbacks:', tokenAddresses);
    
    // Prepare tokens with decimals for price fetching
    const tokensForPricing = tokensToEnrich.map(t => ({
      address: t.address,
      decimals: t.decimals
    }));
    
    const [marketDataMap, metadataMap] = await Promise.all([
      fetchMarketDataWithFallbacks(tokenAddresses),
      fetchBirdeyeMetadata(tokenAddresses)
    ]);

    console.log('💰 Market data map size:', marketDataMap.size);
    console.log('💰 Metadata map size:', metadataMap.size);

    // Enrich holdings with price data
    const enrichedHoldings: TokenHolding[] = tokensToEnrich.map(token => {
      const marketData = marketDataMap.get(token.address);
      const metadata = metadataMap.get(token.address);
      const price = marketData?.price || 0;
      
      console.log('💰 Enriching token:', {
        address: token.address,
        symbol: token.symbol,
        price,
        hasMarketData: !!marketData,
        hasMetadata: !!metadata
      });
      
      return {
        tokenAddress: token.address,
        symbol: metadata?.symbol || token.symbol,
        balance: token.balance.toString(),
        decimals: token.decimals,
        uiAmount: token.holdings,
        price,
        value: price * token.holdings,
        name: metadata?.name || token.name,
        logoUrl: metadata?.logo_uri
      };
    });

    const totalValue = enrichedHoldings.reduce((sum, h) => sum + (h.value || 0), 0);

    console.log('✅ Holdings enriched:', enrichedHoldings.length, 'tokens, $', totalValue.toFixed(2));

    res.json({
      success: true,
      holdings: enrichedHoldings,
      totalValue,
      smartAccountAddress: walletAddress
    } as HoldingsResponse);

  } catch (error) {
    console.error('❌ Holdings error:', error);
    res.status(500).json({
      success: false,
      holdings: [],
      totalValue: 0,
      error: error instanceof Error ? error.message : 'Failed to fetch holdings'
    } as HoldingsResponse);
  }
});

export { router as holdingsRouter };




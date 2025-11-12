import express, { Request, Response, Router } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../../middleware/auth.js';
import { supabase } from '../../lib/supabase.js';
import type { HoldingsResponse, TokenHolding } from '@darkresearch/mallory-shared';

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

interface BirdeyeMarketData {
  price?: number;
  market_cap?: number;
}

interface BirdeyeMetadata {
  symbol?: string;
  name?: string;
  logo_uri?: string;
  decimals?: number;
}

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
 * Fetch SOL price from Jupiter (real-time price source)
 */
async function fetchSolPriceFromJupiter(): Promise<number | null> {
  try {
    const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const solMint = 'So11111111111111111111111111111111111111112';
    const usdcAmount = 1_000_000; // 1 USDC in smallest units (6 decimals)
    
    // Use new Jupiter API endpoints (updated Oct 2025)
    // Free tier: lite-api.jup.ag (no API key required)
    // Pro tier: api.jup.ag (requires API key from portal.jup.ag)
    // Reference: https://hub.jup.ag/docs/
    const jupiterApiBase = process.env.JUPITER_API_KEY 
      ? 'https://api.jup.ag/swap/v1'
      : 'https://lite-api.jup.ag/swap/v1';
    
    const params = new URLSearchParams({
      inputMint: usdcMint,
      outputMint: solMint,
      amount: usdcAmount.toString(),
      slippageBps: '50'
    });
    
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };
    
    // Add API key header if available (for pro tier)
    if (process.env.JUPITER_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.JUPITER_API_KEY}`;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${jupiterApiBase}/quote?${params}`, {
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const quote = await response.json() as any;
      if (quote.outAmount) {
        const parsed = parseInt(quote.outAmount, 10);
        if (!isFinite(parsed) || parsed <= 0) {
          return null;
        }
        const solAmount = parsed / 1e9; // SOL has 9 decimals
        const solPrice = 1 / solAmount; // Price of 1 SOL in USDC
        console.log('💰 [Jupiter] SOL price fetched:', solPrice.toFixed(2));
        return solPrice;
      }
    } else {
      const errorText = await response.text();
      console.warn('💰 [Jupiter] API error:', response.status, errorText.substring(0, 100));
    }
  } catch (error: any) {
    if (error.name !== 'AbortError' && error.code !== 'ECONNREFUSED') {
      console.error('💰 [Jupiter] Error fetching SOL price:', error.message);
    }
  }
  return null;
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
 * Fetch market data for multiple tokens from Birdeye
 */
async function fetchBirdeyeMarketData(tokenAddresses: string[]): Promise<Map<string, BirdeyeMarketData>> {
  const resultMap = new Map();
  
  if (tokenAddresses.length === 0) return resultMap;

  try {
    const addressList = tokenAddresses.slice(0, 20).join(',');
    const url = `https://public-api.birdeye.so/defi/v3/token/market-data/multiple?list_address=${addressList}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-Chain': 'solana',
    };

    if (process.env.BIRDEYE_API_KEY) {
      headers['X-API-KEY'] = process.env.BIRDEYE_API_KEY;
    }


    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      const isRateLimited = response.status === 429;
      
      console.error('💰 [Birdeye] API error response:', {
        status: response.status,
        statusText: response.statusText,
        isRateLimited,
        body: errorText.substring(0, 200)
      });
      
      // For rate limits, wait a bit before trying fallbacks
      if (isRateLimited) {
        console.log('💰 [Birdeye] Rate limited, using fallback price sources...');
      }
      
      // For SOL, try multiple fallback sources
      const solAddress = 'So11111111111111111111111111111111111111112';
      if (tokenAddresses.includes(solAddress)) {
        const solPrice = await fetchSolPriceWithFallbacks();
        if (solPrice !== null) {
          resultMap.set(solAddress, {
            price: solPrice,
            market_cap: 0
          });
        }
      }
      // Use fallback prices only for stablecoins
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

    const data = await response.json() as any;
    
    // Try multiple response formats
    let priceData: any = null;
    if (data.success && data.data) {
      // Check if data.data is an array first (before typeof check, since arrays are objects)
      if (Array.isArray(data.data)) {
        // Convert array format to object with address keys
        priceData = {};
        for (const item of data.data) {
          if (item.address) {
            priceData[item.address] = item;
          }
        }
      } else if (data.data && typeof data.data === 'object') {
        // Direct data object format
        priceData = data.data;
      }
    } else if (data.data) {
      // Handle case where success is false but data exists
      if (Array.isArray(data.data)) {
        priceData = {};
        for (const item of data.data) {
          if (item.address) {
            priceData[item.address] = item;
          }
        }
      } else if (typeof data.data === 'object') {
        priceData = data.data;
      }
    }
    
    if (priceData) {
      for (const [address, tokenData] of Object.entries(priceData)) {
        const marketData = tokenData as any;
        // Try multiple price fields
        const price = marketData.price || 
                      marketData.value || 
                      marketData.usd || 
                      marketData.usdPrice ||
                      (marketData.priceInfo?.price) ||
                      0;
        resultMap.set(address, {
          price: price > 0 ? price : (FALLBACK_PRICES[address] || 0),
          market_cap: marketData.market_cap || marketData.marketCap || 0
        });
      }
    } else {
      console.warn('💰 [Birdeye] Unexpected response format:', {
        success: data.success,
        hasData: !!data.data,
        response: JSON.stringify(data).substring(0, 500)
      });
    }
    
    // For SOL, try fallback sources if not found in Birdeye response
    const solAddress = 'So11111111111111111111111111111111111111112';
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
  } catch (error) {
    console.error('💰 [Birdeye] Market data error:', error);
    // For SOL, try multiple fallback sources
    const solAddress = 'So11111111111111111111111111111111111111112';
    if (tokenAddresses.includes(solAddress) && !resultMap.has(solAddress)) {
      const solPrice = await fetchSolPriceWithFallbacks();
      if (solPrice !== null) {
        resultMap.set(solAddress, {
          price: solPrice,
          market_cap: 0
        });
      }
    }
    // Use fallback prices only for stablecoins
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
}

/**
 * Fetch metadata for multiple tokens from Birdeye
 */
async function fetchBirdeyeMetadata(tokenAddresses: string[]): Promise<Map<string, BirdeyeMetadata>> {
  const resultMap = new Map();
  
  if (tokenAddresses.length === 0) return resultMap;

  try {
    const addressList = tokenAddresses.slice(0, 50).join(',');
    const url = `https://public-api.birdeye.so/defi/v3/token/meta-data/multiple?list_address=${addressList}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-Chain': 'solana',
    };

    if (process.env.BIRDEYE_API_KEY) {
      headers['X-API-KEY'] = process.env.BIRDEYE_API_KEY;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return resultMap;

    const data = await response.json() as any;
    
    if (data.success && data.data) {
      for (const [address, tokenData] of Object.entries(data.data)) {
        const metadata = tokenData as any;
        resultMap.set(address, {
          symbol: metadata.symbol || 'UNKNOWN',
          name: metadata.name || 'Unknown Token',
          decimals: metadata.decimals || 9,
          logo_uri: metadata.logo_uri || ''
        });
      }
    }

    return resultMap;
  } catch (error) {
    console.error('Birdeye metadata error:', error);
    return resultMap;
  }
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

    // Fetch price data from Birdeye in parallel
    const tokenAddresses = tokensToEnrich.map(t => t.address);
    console.log('💰 Fetching prices for tokens:', tokenAddresses);
    const [marketDataMap, metadataMap] = await Promise.all([
      fetchBirdeyeMarketData(tokenAddresses),
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


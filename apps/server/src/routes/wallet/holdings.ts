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
    console.log('💰 Fetching prices for tokens:', tokenAddresses);
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


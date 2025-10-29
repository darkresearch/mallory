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

    if (!response.ok) return resultMap;

    const data = await response.json() as any;
    
    if (data.success && data.data) {
      for (const [address, tokenData] of Object.entries(data.data)) {
        const marketData = tokenData as any;
        resultMap.set(address, {
          price: marketData.price || 0,
          market_cap: marketData.market_cap || 0
        });
      }
    }

    return resultMap;
  } catch (error) {
    console.error('Birdeye market data error:', error);
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
    const [marketDataMap, metadataMap] = await Promise.all([
      fetchBirdeyeMarketData(tokenAddresses),
      fetchBirdeyeMetadata(tokenAddresses)
    ]);

    // Enrich holdings with price data
    const enrichedHoldings: TokenHolding[] = tokensToEnrich.map(token => {
      const marketData = marketDataMap.get(token.address);
      const metadata = metadataMap.get(token.address);
      const price = marketData?.price || 0;
      
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


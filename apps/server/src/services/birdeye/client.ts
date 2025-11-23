/**
 * Birdeye API Client Service
 * 
 * Provides token price and metadata from Birdeye's Solana API.
 * Enhanced with detailed error logging for debugging subscription and API key issues.
 * 
 * Uses Token Overview endpoint which provides all data in a single call (Starter plan compatible).
 */

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

interface BirdeyeTokenOverview {
  price?: number;
  marketCap?: number;
  symbol?: string;
  name?: string;
  logoURI?: string;
  decimals?: number;
}

interface BirdeyeTokenData {
  marketData: BirdeyeMarketData;
  metadata: BirdeyeMetadata;
}

// Promise-based cache to prevent duplicate in-flight API calls
// Cache expires after 1 second (enough for parallel calls in same request)
const inFlightRequests = new Map<string, { promise: Promise<Map<string, BirdeyeTokenData>>, timestamp: number }>();
const CACHE_TTL_MS = 1000;

/**
 * Internal function to fetch token overview data from Birdeye
 * Returns both market data and metadata in a single API call per token.
 * Uses promise-based caching to prevent duplicate in-flight requests when both functions are called in parallel.
 * 
 * @param tokenAddresses - Array of token mint addresses
 * @returns Map of token address to combined market data and metadata
 */
async function fetchBirdeyeTokenData(tokenAddresses: string[]): Promise<Map<string, BirdeyeTokenData>> {
  if (tokenAddresses.length === 0) {
    return new Map();
  }

  // Create cache key from sorted addresses
  const cacheKey = tokenAddresses.slice().sort().join(',');
  const cached = inFlightRequests.get(cacheKey);
  
  // Return in-flight request if still fresh (within 1 second)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log('🐦 [Birdeye] Using cached request', {
      tokenCount: tokenAddresses.length,
      cacheAge: `${Date.now() - cached.timestamp}ms`
    });
    return cached.promise;
  }

  // Create new promise for this request
  const promise = fetchBirdeyeTokenDataInternal(tokenAddresses);
  
  // Cache the promise (not the result) so parallel calls share the same request
  inFlightRequests.set(cacheKey, {
    promise,
    timestamp: Date.now()
  });

  // Clean up cache after request completes
  promise.finally(() => {
    setTimeout(() => {
      const entry = inFlightRequests.get(cacheKey);
      if (entry && Date.now() - entry.timestamp > CACHE_TTL_MS) {
        inFlightRequests.delete(cacheKey);
      }
    }, CACHE_TTL_MS);
  });

  return promise;
}

/**
 * Internal implementation that actually makes the API calls
 */
async function fetchBirdeyeTokenDataInternal(tokenAddresses: string[]): Promise<Map<string, BirdeyeTokenData>> {
  const resultMap = new Map<string, BirdeyeTokenData>();

  const apiKey = process.env.BIRDEYE_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ [Birdeye] BIRDEYE_API_KEY not configured - requests will fail');
    return resultMap;
  }

  // Make parallel requests for each token using Token Overview endpoint
  const fetchPromises = tokenAddresses.map(async (address) => {
    try {
      const url = `https://public-api.birdeye.so/defi/token_overview?address=${address}`;
      
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'X-Chain': 'solana',
        'X-API-KEY': apiKey,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      try {
        const response = await fetch(url, { headers, signal: controller.signal });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error('❌ [Birdeye] HTTP error for token', {
            address: address.substring(0, 8) + '...',
            status: response.status,
            statusText: response.statusText,
            body: errorBody.substring(0, 200)
          });
          
          if (response.status === 401) {
            console.error('❌ [Birdeye] 401 Unauthorized - API key is invalid');
          } else if (response.status === 403) {
            console.error('❌ [Birdeye] 403 Forbidden - Subscription tier insufficient');
          } else if (response.status === 429) {
            console.error('❌ [Birdeye] 429 Too Many Requests - Rate limit exceeded');
          }
          
          return null;
        }

        const data = await response.json() as any;
        
        if (data.success && data.data) {
          return {
            address,
            price: data.data.price || 0,
            marketCap: data.data.marketCap || 0,
            symbol: data.data.symbol || 'UNKNOWN',
            name: data.data.name || 'Unknown Token',
            decimals: data.data.decimals || 9,
            logoURI: data.data.logoURI || ''
          };
        } else {
          console.warn('⚠️ [Birdeye] No data for token', {
            address: address.substring(0, 8) + '...',
            success: data.success,
            hasData: !!data.data
          });
          return null;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('❌ [Birdeye] Timeout for token', {
          address: address.substring(0, 8) + '...'
        });
      } else {
        console.error('❌ [Birdeye] Error fetching token', {
          address: address.substring(0, 8) + '...',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      return null;
    }
  });

  // Wait for all requests to complete
  const results = await Promise.all(fetchPromises);
  
  // Build result map with both market data and metadata
  for (const result of results) {
    if (result) {
      resultMap.set(result.address, {
        marketData: {
          price: result.price,
          market_cap: result.marketCap
        },
        metadata: {
          symbol: result.symbol,
          name: result.name,
          decimals: result.decimals,
          logo_uri: result.logoURI
        }
      });
    }
  }

  return resultMap;
}

/**
 * Fetch market data (prices, market cap) for multiple tokens from Birdeye
 * 
 * Uses Token Overview endpoint (Starter plan compatible) which provides both price and metadata.
 * Makes one API call per token internally by calling fetchBirdeyeTokenData.
 * 
 * @param tokenAddresses - Array of token mint addresses
 * @returns Map of token address to market data
 */
export async function fetchBirdeyeMarketData(tokenAddresses: string[]): Promise<Map<string, BirdeyeMarketData>> {
  const resultMap = new Map<string, BirdeyeMarketData>();
  
  if (tokenAddresses.length === 0) {
    console.log('🐦 [Birdeye] No tokens to fetch');
    return resultMap;
  }

  const apiKey = process.env.BIRDEYE_API_KEY;
  const hasApiKey = !!apiKey;
  
  console.log('🐦 [Birdeye] Starting requests', {
    tokenCount: tokenAddresses.length,
    tokens: tokenAddresses.slice(0, 3).join(', ') + (tokenAddresses.length > 3 ? '...' : ''),
    hasApiKey,
    apiKeyPrefix: apiKey ? `${apiKey.substring(0, 8)}...` : 'N/A',
    note: 'Using Token Overview endpoint (Starter plan)'
  });

  // Use the unified function to fetch data with 1 API call per token
  const tokenData = await fetchBirdeyeTokenData(tokenAddresses);
  
  // Extract market data from the unified response
  for (const [address, data] of tokenData) {
    resultMap.set(address, data.marketData);
  }

  console.log('✅ [Birdeye] Completed requests', {
    tokenCount: tokenAddresses.length,
    successCount: resultMap.size,
    failedCount: tokenAddresses.length - resultMap.size,
    samplePrices: Array.from(resultMap.entries()).slice(0, 2).map(([addr, data]) => ({
      address: addr.substring(0, 8) + '...',
      price: data.price
    }))
  });

  return resultMap;
}

/**
 * Fetch metadata (name, symbol, logo) for multiple tokens from Birdeye
 * 
 * Uses Token Overview endpoint (Starter plan compatible) which provides both price and metadata.
 * Makes one API call per token internally by calling fetchBirdeyeTokenData.
 * 
 * @param tokenAddresses - Array of token mint addresses
 * @returns Map of token address to metadata
 */
export async function fetchBirdeyeMetadata(tokenAddresses: string[]): Promise<Map<string, BirdeyeMetadata>> {
  const resultMap = new Map<string, BirdeyeMetadata>();
  
  if (tokenAddresses.length === 0) {
    console.log('🐦 [Birdeye] No tokens to fetch (metadata)');
    return resultMap;
  }

  console.log('🐦 [Birdeye] Starting metadata requests', {
    tokenCount: tokenAddresses.length,
    tokens: tokenAddresses.slice(0, 3).join(', ') + (tokenAddresses.length > 3 ? '...' : ''),
    note: 'Using Token Overview endpoint (Starter plan)'
  });

  // Use the unified function to fetch data with 1 API call per token
  const tokenData = await fetchBirdeyeTokenData(tokenAddresses);
  
  // Extract metadata from the unified response
  for (const [address, data] of tokenData) {
    resultMap.set(address, data.metadata);
  }

  console.log('✅ [Birdeye] Completed metadata requests', {
    tokenCount: tokenAddresses.length,
    successCount: resultMap.size,
    failedCount: tokenAddresses.length - resultMap.size,
    sampleTokens: Array.from(resultMap.entries()).slice(0, 2).map(([addr, data]) => ({
      address: addr.substring(0, 8) + '...',
      symbol: data.symbol,
      hasLogo: !!data.logo_uri
    }))
  });

  return resultMap;
}


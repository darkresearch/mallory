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

/**
 * Fetch market data (prices, market cap) for multiple tokens from Birdeye
 * 
 * Uses Token Overview endpoint (Starter plan compatible) which provides both price and metadata.
 * Makes parallel requests for multiple tokens.
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
            market_cap: data.data.marketCap || 0
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
  
  // Build result map
  for (const result of results) {
    if (result) {
      resultMap.set(result.address, {
        price: result.price,
        market_cap: result.market_cap
      });
    }
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
 * Makes parallel requests for multiple tokens.
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

  const apiKey = process.env.BIRDEYE_API_KEY;
  const hasApiKey = !!apiKey;
  
  console.log('🐦 [Birdeye] Starting metadata requests', {
    tokenCount: tokenAddresses.length,
    tokens: tokenAddresses.slice(0, 3).join(', ') + (tokenAddresses.length > 3 ? '...' : ''),
    hasApiKey,
    apiKeyPrefix: apiKey ? `${apiKey.substring(0, 8)}...` : 'N/A',
    note: 'Using Token Overview endpoint (Starter plan)'
  });

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
          console.error('❌ [Birdeye] HTTP error for token (metadata)', {
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
            symbol: data.data.symbol || 'UNKNOWN',
            name: data.data.name || 'Unknown Token',
            decimals: data.data.decimals || 9,
            logo_uri: data.data.logoURI || ''
          };
        } else {
          console.warn('⚠️ [Birdeye] No data for token (metadata)', {
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
        console.error('❌ [Birdeye] Timeout for token (metadata)', {
          address: address.substring(0, 8) + '...'
        });
      } else {
        console.error('❌ [Birdeye] Error fetching token (metadata)', {
          address: address.substring(0, 8) + '...',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      return null;
    }
  });

  // Wait for all requests to complete
  const results = await Promise.all(fetchPromises);
  
  // Build result map
  for (const result of results) {
    if (result) {
      resultMap.set(result.address, {
        symbol: result.symbol,
        name: result.name,
        decimals: result.decimals,
        logo_uri: result.logo_uri
      });
    }
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


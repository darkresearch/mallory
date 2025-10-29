import { secureStorage, config } from '../../../lib';
import { gridClientService } from '../../grid';

export interface TokenBalance {
  tokenAddress: string;
  symbol: string;
  balance: string;
  decimals: number;
  uiAmount: number;
}

export interface EnrichedToken {
  tokenAddress: string;
  tokenPfp: string;
  tokenName: string;
  tokenSymbol: string;
  tokenPrice: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  holdings: number;
  holdingsValue: number;
  decimals: number;
}

export interface WalletData {
  totalBalance: number;
  holdings: EnrichedToken[];
  smartAccountAddress?: string;
  gridAccountId?: string;
  lastUpdated: string;
}

export interface WalletDataResponse {
  success: boolean;
  totalBalance: number;
  holdings: EnrichedToken[];
  smartAccountAddress?: string;
  gridAccountId?: string;
  enrichedAt: string;
}

class WalletDataService {
  private cache: WalletData | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private readonly baseUrl: string;

  constructor() {
    const baseApiUrl = config.backendApiUrl || 'http://localhost:3001';
    this.baseUrl = `${baseApiUrl}/api`;
  }

  /**
   * Fetch enriched holdings from new holdings endpoint
   */
  private async fetchEnrichedHoldings(): Promise<WalletData> {
    const requestId = Math.random().toString(36).substring(2, 8);
    const startTime = Date.now();

    try {
      console.log('💰 [Mobile] fetchEnrichedHoldings() START', {
        requestId,
        baseUrl: this.baseUrl,
        timestamp: new Date().toISOString()
      });

      // Test server connection first
      await this.testServerConnection();

      // Get Grid wallet address from secure storage
      const gridAccount = await gridClientService.getAccount();
      const walletAddress = gridAccount?.address;

      if (!walletAddress) {
        console.error('💰 [Mobile] No Grid wallet address available', { requestId });
        throw new Error('No wallet found. Please complete Grid wallet setup.');
      }

      console.log('💰 [Mobile] Grid wallet address retrieved', {
        requestId,
        address: walletAddress
      });

      // Get auth token
      const token = await this.getAuthToken();
      
      if (!token) {
        console.error('💰 [Mobile] No auth token available', { requestId });
        throw new Error('No auth token available. Please sign in.');
      }
      
      console.log('💰 [Mobile] Auth token retrieved', {
        requestId,
        tokenPrefix: token.substring(0, 10) + '...',
        tokenLength: token.length
      });

      // Make API request to holdings endpoint with wallet address as query param
      const url = `${this.baseUrl}/wallet/holdings?address=${encodeURIComponent(walletAddress)}`;
      console.log('💰 [Mobile] Making API request', {
        requestId,
        url,
        method: 'GET',
        hasToken: !!token,
        walletAddress
      });

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const duration = Date.now() - startTime;
      console.log('💰 [Mobile] API response received', {
        requestId,
        status: response.status,
        duration: `${duration}ms`,
        contentType: response.headers.get('content-type')
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('💰 [Mobile] API request failed', {
          requestId,
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          duration: `${duration}ms`
        });
        throw new Error(errorText || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        console.error('💰 [Mobile] API returned error', {
          requestId,
          error: data.error,
          message: data.message,
          duration: `${duration}ms`
        });
        throw new Error(data.message || data.error || 'API request failed');
      }

      // Parse and transform response from holdings endpoint
      // Map server TokenHolding format to client EnrichedToken format
      const transformedHoldings: EnrichedToken[] = (data.holdings || []).map((h: any) => ({
        tokenAddress: h.tokenAddress,
        tokenPfp: h.logoUrl || '',
        tokenName: h.name || h.symbol || 'Unknown',
        tokenSymbol: h.symbol || 'UNKNOWN',
        tokenPrice: h.price || 0,
        priceChange24h: 0, // Not provided by backend
        volume24h: 0, // Not provided by backend
        marketCap: 0, // Not provided by backend
        holdings: h.uiAmount || 0,
        holdingsValue: h.value || 0,
        decimals: h.decimals || 9
      }));

      const walletData: WalletData = {
        totalBalance: parseFloat(data.totalValue?.toFixed(2) || '0.00'),
        holdings: transformedHoldings,
        smartAccountAddress: data.smartAccountAddress || 'Unknown',
        gridAccountId: 'N/A', // Not needed from holdings endpoint
        lastUpdated: new Date().toISOString()
      };

      console.log('💰 [Mobile] fetchEnrichedHoldings() SUCCESS', {
        requestId,
        totalValueUSD: walletData.totalBalance.toFixed(2),
        holdingsCount: walletData.holdings.length,
        walletAddress: data.smartAccountAddress,
        duration: `${duration}ms`
      });

      return walletData;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('💰 [Mobile] fetchEnrichedHoldings() ERROR', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`
      });
      throw error;
    }
  }

  /**
   * Get complete wallet data with intelligent caching
   */
  async getWalletData(): Promise<WalletData> {
    console.log('💰 [Mobile] WalletDataService.getWalletData() called', {
      baseUrl: this.baseUrl,
      hasFreshCache: this.hasFreshCache(),
      cacheExpiry: this.cacheExpiry ? new Date(this.cacheExpiry).toISOString() : 'none'
    });

    // Return cached data if still fresh
    if (this.hasFreshCache()) {
      console.log('💰 [Mobile] Returning cached wallet data', {
        totalBalance: this.cache?.totalBalance.toFixed(2),
        holdingsCount: this.cache?.holdings.length,
        lastUpdated: this.cache?.lastUpdated
      });
      return this.cache!;
    }

    try {
      // Test server connectivity first
      await this.testServerConnection();
      
      const walletData = await this.fetchEnrichedHoldings();
      this.updateCache(walletData);
      
      console.log('💰 [Mobile] Wallet data updated successfully', {
        totalBalance: walletData.totalBalance.toFixed(2),
        holdingsCount: walletData.holdings.length,
        smartAccountAddress: walletData.smartAccountAddress?.substring(0, 8) + '...',
        gridAccountId: walletData.gridAccountId
      });
      return walletData;

    } catch (error) {
      console.error('💰 [Mobile] Error fetching wallet data:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        hasCache: !!this.cache,
        cacheAge: this.cache ? `${Math.round((Date.now() - this.cacheExpiry + this.CACHE_DURATION) / 1000)}s old` : 'none'
      });
      
      // Graceful degradation: return stale cache or empty data
      return this.cache || this.createEmptyWalletData();
    }
  }

  /**
   * Test server connectivity
   */
  private async testServerConnection(): Promise<void> {
    const startTime = Date.now();
    console.log('🔗 [Mobile] Testing server connection', {
      baseUrl: this.baseUrl,
      healthUrl: `${this.baseUrl.replace('/api', '')}/health`
    });

    try {
      const healthUrl = `${this.baseUrl.replace('/api', '')}/health`;
      const response = await fetch(healthUrl, {
        method: 'GET',
        timeout: 5000 // 5 second timeout
      } as any);

      const duration = Date.now() - startTime;

      if (!response.ok) {
        console.warn('🔗 [Mobile] Server health check failed', {
          status: response.status,
          statusText: response.statusText,
          duration: `${duration}ms`
        });
        throw new Error(`Server health check failed: ${response.status}`);
      }

      const healthData = await response.json();
      console.log('🔗 [Mobile] Server connection successful', {
        status: healthData.status,
        service: healthData.service,
        duration: `${duration}ms`
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('🔗 [Mobile] Server connection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
        baseUrl: this.baseUrl
      });
      throw new Error(`Cannot reach server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      // Use the same key as AuthContext
      return await secureStorage.getItem('mallory_auth_token');
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  }

  /**
   * Check if cached data is available and fresh
   */
  hasFreshCache(): boolean {
    return this.cache !== null && Date.now() < this.cacheExpiry;
  }

  private updateCache(walletData: WalletData): void {
    this.cache = walletData;
    this.cacheExpiry = Date.now() + this.CACHE_DURATION;
  }

  private createEmptyWalletData(): WalletData {
    return {
      totalBalance: 0,
      holdings: [],
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Refresh wallet data (bypass cache)
   */
  async refreshWalletData(): Promise<WalletData> {
    console.log('💰 Refreshing wallet data (bypassing cache)');
    this.clearCache();
    return this.getWalletData();
  }

  /**
   * Clear cached data
   */
  clearCache(): void {
    console.log('💰 Clearing wallet data cache');
    this.cache = null;
    this.cacheExpiry = 0;
  }

  /**
   * Get cached data (may be stale)
   */
  getCachedData(): WalletData | null {
    return this.cache;
  }
}

// Export singleton instance
export const walletDataService = new WalletDataService();

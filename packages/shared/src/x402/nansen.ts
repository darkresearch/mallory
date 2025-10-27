import { X402_CONSTANTS } from './constants';
import type { NansenHistoricalBalancesRequest, NansenSmartMoneyNetflowRequest, NansenSmartMoneyHoldingsRequest, NansenSmartMoneyDexTradesRequest, NansenSmartMoneyJupiterDcasRequest, NansenCurrentBalanceRequest, NansenTransactionsRequest, NansenCounterpartiesRequest, NansenRelatedWalletsRequest, NansenPnlSummaryRequest, NansenPnlRequest, NansenLabelsRequest, NansenTokenScreenerRequest, NansenFlowIntelligenceRequest, NansenHoldersRequest, NansenFlowsRequest, NansenWhoBoughtSoldRequest, NansenTokenDexTradesRequest, NansenTokenTransfersRequest, NansenTokenJupiterDcasRequest, NansenPnlLeaderboardRequest, NansenPortfolioRequest } from './types';

/**
 * Nansen request utilities
 * Shared between server (formatting) and client (if needed)
 */
export const NansenUtils = {
  /**
   * Get default date range (last 24 hours)
   */
  getDefaultDateRange(): { from: string; to: string } {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    return {
      from: yesterday.toISOString(),
      to: now.toISOString()
    };
  },

  /**
   * Format Nansen historical balances request body
   * EXACT same logic as Researcher
   */
  formatHistoricalBalancesRequest(params: {
    address: string;
    chain?: string;
    startDate?: string;
    endDate?: string;
  }): NansenHistoricalBalancesRequest {
    const { address, chain = 'ethereum', startDate, endDate } = params;
    
    const dateRange = startDate && endDate 
      ? { from: startDate, to: endDate }
      : this.getDefaultDateRange();

    return {
      address,
      chain,
      date: dateRange,
      pagination: {
        page: 1,
        per_page: 100
      }
    };
  },

  /**
   * Get Nansen API URL
   */
  getHistoricalBalancesUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/profiler/address/historical-balances`;
  },

  /**
   * Format Nansen smart money netflow request body
   */
  formatSmartMoneyNetflowRequest(params: {
    chains?: string[];
  }): NansenSmartMoneyNetflowRequest {
    const { chains = ['ethereum', 'solana'] } = params;

    return {
      chains,
      pagination: {
        page: 1,
        per_page: 100
      }
    };
  },

  /**
   * Get Nansen smart money netflow URL
   */
  getSmartMoneyNetflowUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/smart-money/netflow`;
  },

  /**
   * Format Nansen smart money holdings request body
   */
  formatSmartMoneyHoldingsRequest(params: {
    chains?: string[];
  }): NansenSmartMoneyHoldingsRequest {
    const { chains = ['ethereum', 'solana'] } = params;

    return {
      chains,
      pagination: {
        page: 1,
        per_page: 100
      }
    };
  },

  /**
   * Get Nansen smart money holdings URL
   */
  getSmartMoneyHoldingsUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/smart-money/holdings`;
  },

  /**
   * Format Nansen smart money dex trades request body
   */
  formatSmartMoneyDexTradesRequest(params: {
    chains?: string[];
  }): NansenSmartMoneyDexTradesRequest {
    const { chains = ['ethereum', 'solana'] } = params;

    return {
      chains,
      pagination: {
        page: 1,
        per_page: 100
      }
    };
  },

  /**
   * Get Nansen smart money dex trades URL
   */
  getSmartMoneyDexTradesUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/smart-money/dex-trades`;
  },

  /**
   * Format Nansen smart money Jupiter DCAs request body
   */
  formatSmartMoneyJupiterDcasRequest(): NansenSmartMoneyJupiterDcasRequest {
    // Jupiter DCAs are Solana-only, no chain parameter needed
    return {
      pagination: {
        page: 1,
        per_page: 100
      }
    };
  },

  /**
   * Get Nansen smart money Jupiter DCAs URL
   */
  getSmartMoneyJupiterDcasUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/smart-money/dcas`;
  },

  formatCurrentBalanceRequest(params: { address: string; chain?: string }): NansenCurrentBalanceRequest {
    return { 
      address: params.address, 
      chain: params.chain || 'ethereum',
      hide_spam_token: true,
      pagination: { page: 1, per_page: 100 }
    };
  },
  getCurrentBalanceUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/profiler/address/current-balance`;
  },

  formatTransactionsRequest(params: { address: string; chain?: string }): NansenTransactionsRequest {
    const dateRange = this.getDefaultDateRange();
    return { 
      address: params.address, 
      chain: params.chain || 'ethereum', 
      date: dateRange, 
      hide_spam_token: true,
      pagination: { page: 1, per_page: 100 } 
    };
  },
  getTransactionsUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/profiler/address/transactions`;
  },

  formatCounterpartiesRequest(params: { address: string; chain?: string }): NansenCounterpartiesRequest {
    return { wallet_address: params.address, chain: params.chain || 'ethereum', pagination: { page: 1, per_page: 100 } };
  },
  getCounterpartiesUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/profiler/address/counterparties`;
  },

  formatRelatedWalletsRequest(params: { address: string; chain?: string }): NansenRelatedWalletsRequest {
    return { wallet_address: params.address, chain: params.chain || 'ethereum', pagination: { page: 1, per_page: 100 } };
  },
  getRelatedWalletsUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/profiler/address/related-wallets`;
  },

  formatPnlSummaryRequest(params: { address: string; chain?: string }): NansenPnlSummaryRequest {
    const dateRange = this.getDefaultDateRange();
    return { 
      address: params.address, 
      chain: params.chain || 'ethereum',
      date: dateRange
    };
  },
  getPnlSummaryUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/profiler/address/pnl-summary`;
  },

  formatPnlRequest(params: { address: string; chain?: string }): NansenPnlRequest {
    return { wallet_address: params.address, chain: params.chain || 'ethereum', pagination: { page: 1, per_page: 100 } };
  },
  getPnlUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/profiler/address/pnl`;
  },

  formatLabelsRequest(params: { address: string; chain?: string }): NansenLabelsRequest {
    return { wallet_address: params.address, chain: params.chain || 'ethereum' };
  },
  getLabelsUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/profiler/address/labels`;
  },

  // Token God Mode endpoints
  formatTokenScreenerRequest(params: { chains?: string[] }): NansenTokenScreenerRequest {
    return { chains: params.chains || ['ethereum', 'solana'], pagination: { page: 1, per_page: 100 } };
  },
  getTokenScreenerUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/tgm/token-screener`;
  },

  formatFlowIntelligenceRequest(params: { token_address: string; chain?: string }): NansenFlowIntelligenceRequest {
    return { token_address: params.token_address, chain: params.chain || 'ethereum' };
  },
  getFlowIntelligenceUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/tgm/flow-intelligence`;
  },

  formatHoldersRequest(params: { token_address: string; chain?: string }): NansenHoldersRequest {
    return { token_address: params.token_address, chain: params.chain || 'ethereum', pagination: { page: 1, per_page: 100 } };
  },
  getHoldersUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/tgm/holders`;
  },

  formatFlowsRequest(params: { token_address: string; chain?: string }): NansenFlowsRequest {
    const dateRange = this.getDefaultDateRange();
    return { token_address: params.token_address, chain: params.chain || 'ethereum', date: dateRange };
  },
  getFlowsUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/tgm/flows`;
  },

  formatWhoBoughtSoldRequest(params: { token_address: string; chain?: string }): NansenWhoBoughtSoldRequest {
    const dateRange = this.getDefaultDateRange();
    return { token_address: params.token_address, chain: params.chain || 'ethereum', date: dateRange, pagination: { page: 1, per_page: 100 } };
  },
  getWhoBoughtSoldUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/tgm/who-bought-sold`;
  },

  formatTokenDexTradesRequest(params: { token_address: string; chain?: string }): NansenTokenDexTradesRequest {
    const dateRange = this.getDefaultDateRange();
    return { token_address: params.token_address, chain: params.chain || 'ethereum', date: dateRange, pagination: { page: 1, per_page: 100 } };
  },
  getTokenDexTradesUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/tgm/dex-trades`;
  },

  formatTokenTransfersRequest(params: { token_address: string; chain?: string }): NansenTokenTransfersRequest {
    const dateRange = this.getDefaultDateRange();
    return { token_address: params.token_address, chain: params.chain || 'ethereum', date: dateRange, pagination: { page: 1, per_page: 100 } };
  },
  getTokenTransfersUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/tgm/transfers`;
  },

  formatTokenJupiterDcasRequest(params: { token_address: string; chain?: string }): NansenTokenJupiterDcasRequest {
    return { token_address: params.token_address, chain: params.chain || 'solana', pagination: { page: 1, per_page: 100 } };
  },
  getTokenJupiterDcasUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/tgm/jupiter-dcas`;
  },

  formatPnlLeaderboardRequest(params: { token_address: string; chain?: string }): NansenPnlLeaderboardRequest {
    const dateRange = this.getDefaultDateRange();
    return { token_address: params.token_address, chain: params.chain || 'ethereum', date: dateRange, pagination: { page: 1, per_page: 100 } };
  },
  getPnlLeaderboardUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/tgm/pnl-leaderboard`;
  },

  // Portfolio endpoint
  formatPortfolioRequest(params: { address: string; chains?: string[] }): NansenPortfolioRequest {
    return { wallet_address: params.address, chains: params.chains || ['ethereum', 'solana'] };
  },
  getPortfolioUrl(): string {
    return `${X402_CONSTANTS.getNansenApiBase()}/api/v1/portfolio/defi-holdings`;
  }
};


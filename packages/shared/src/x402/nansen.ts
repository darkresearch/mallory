import { X402_CONSTANTS } from './constants';
import type { NansenHistoricalBalancesRequest } from './types';

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
  }
};


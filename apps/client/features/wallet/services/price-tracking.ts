import AsyncStorage from '@react-native-async-storage/async-storage';

interface PriceSnapshot {
  price: number;
  timestamp: number;
}

interface PriceHistory {
  [tokenAddress: string]: PriceSnapshot;
}

const PRICE_HISTORY_KEY = 'wallet_price_history';
const PRICE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Simple client-side price tracking for wallet items
 * Tracks price changes since user's last wallet visit
 */
export class PriceTracker {
  
  /**
   * Get stored price history from local storage
   */
  private static async getPriceHistory(): Promise<PriceHistory> {
    try {
      const stored = await AsyncStorage.getItem(PRICE_HISTORY_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn('💰 [PriceTracker] Failed to load price history:', error);
      return {};
    }
  }

  /**
   * Save price history to local storage
   */
  private static async savePriceHistory(history: PriceHistory): Promise<void> {
    try {
      await AsyncStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.warn('💰 [PriceTracker] Failed to save price history:', error);
    }
  }

  /**
   * Update price for a token and get comparison result
   */
  static async updateAndComparePrice(
    tokenAddress: string, 
    currentPrice: number
  ): Promise<{
    priceChange: 'up' | 'down' | 'same' | 'new';
    previousPrice?: number;
    priceColor: string;
  }> {
    const now = Date.now();
    const history = await this.getPriceHistory();
    
    const previousSnapshot = history[tokenAddress];
    
    // Determine price change
    let priceChange: 'up' | 'down' | 'same' | 'new' = 'new';
    let previousPrice: number | undefined;
    
    if (previousSnapshot) {
      const timeDiff = now - previousSnapshot.timestamp;
      
      // Only compare if previous price is within TTL
      if (timeDiff <= PRICE_TTL) {
        previousPrice = previousSnapshot.price;
        
        if (currentPrice > previousPrice) {
          priceChange = 'up';
        } else if (currentPrice < previousPrice) {
          priceChange = 'down';
        } else {
          priceChange = 'same';
        }
      }
    }
    
    // Update price history
    history[tokenAddress] = {
      price: currentPrice,
      timestamp: now
    };
    
    await this.savePriceHistory(history);
    
    // Determine color
    let priceColor = '#6A7580'; // Default gray (same as price label)
    if (priceChange === 'up') {
      priceColor = '#02D76F'; // Green
    } else if (priceChange === 'down') {
      priceColor = '#E45858'; // Red
    }
    
    console.log('💰 [PriceTracker] Price comparison:', {
      tokenAddress: tokenAddress.substring(0, 8) + '...',
      previousPrice,
      currentPrice,
      priceChange,
      priceColor
    });
    
    return {
      priceChange,
      previousPrice,
      priceColor
    };
  }

  /**
   * Batch update multiple token prices
   */
  static async batchUpdatePrices(
    tokens: Array<{ tokenAddress: string; price: number }>
  ): Promise<Map<string, { priceChange: 'up' | 'down' | 'same' | 'new'; priceColor: string }>> {
    const results = new Map();
    
    console.log('💰 [PriceTracker] Batch updating prices for', tokens.length, 'tokens');
    
    for (const token of tokens) {
      const result = await this.updateAndComparePrice(token.tokenAddress, token.price);
      results.set(token.tokenAddress, {
        priceChange: result.priceChange,
        priceColor: result.priceColor
      });
    }
    
    return results;
  }

  /**
   * Clear all price history (useful for testing)
   */
  static async clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PRICE_HISTORY_KEY);
      console.log('💰 [PriceTracker] Price history cleared');
    } catch (error) {
      console.warn('💰 [PriceTracker] Failed to clear price history:', error);
    }
  }
}

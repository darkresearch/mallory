import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PriceTracker } from '../../features/wallet';

export interface WalletItemProps {
  // Token identification
  tokenAddress: string; // Token mint address (unique identifier)
  tokenPfp: string; // URL for token logo
  tokenName: string; // Full token name (e.g., "Solana")
  tokenSymbol: string; // Token symbol (e.g., "SOL")
  
  // Holdings data
  holdings: number; // Amount of tokens the user holds
  holdingsValue: number; // USD value of holdings
  
  // Price data
  tokenPrice: number; // Current price per token in USD
  
  // Actions
  onInstabuyPress: () => void; // Callback for Instabuy button
  
  // Optional styling
  style?: any;
}

export function WalletItem({
  tokenAddress,
  tokenPfp,
  tokenName,
  tokenSymbol,
  holdings,
  holdingsValue,
  tokenPrice,
  onInstabuyPress,
  style
}: WalletItemProps) {
  
  // Price tracking state
  const [priceColor, setPriceColor] = useState('#6A7580'); // Default gray (same as price label)
  
  // Force "Solana" name for wrapped SOL
  const displayName = tokenName === 'Wrapped SOL' || tokenSymbol === 'SOL' 
    ? 'Solana' 
    : tokenName;

  // Track price changes on mount and when price updates
  useEffect(() => {
    const trackPrice = async () => {
      if (tokenPrice > 0) {
        const result = await PriceTracker.updateAndComparePrice(
          tokenAddress,
          tokenPrice
        );
        setPriceColor(result.priceColor);
      }
    };
    
    trackPrice();
  }, [tokenPrice, tokenPfp, tokenSymbol]);
  
  // Format holdings amount with appropriate decimals
  const formatHoldings = (amount: number): string => {
    if (amount >= 1) {
      return amount.toLocaleString(undefined, { 
        minimumFractionDigits: 2,
        maximumFractionDigits: 6
      });
    } else {
      return amount.toLocaleString(undefined, { 
        minimumFractionDigits: 4,
        maximumFractionDigits: 8
      });
    }
  };

  // Format USD values, supporting K (thousands) and M (millions)
  const formatUSD = (value: number): string => {
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`;
    } else if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(2)}K`;
    } else if (value >= 1) {
      return `$${value.toFixed(2)}`;
    } else {
      return `$${value.toFixed(4)}`;
    }
  };

  // Format price
  const formatPrice = (price: number): string => {
    if (price >= 1) {
      return `$${price.toFixed(2)}`;
    } else if (price >= 0.01) {
      return `$${price.toFixed(4)}`;
    } else {
      return `$${price.toFixed(8)}`;
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* Left Side: Logo + Token Info */}
      <View style={styles.leftSection}>
        {/* Token Logo */}
        {tokenPfp ? (
          <Image 
            source={{ uri: tokenPfp }} 
            style={styles.tokenLogo}
          />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoPlaceholderText}>
              {tokenSymbol.charAt(0)}
            </Text>
          </View>
        )}
        
        {/* Token Info Stack */}
        <View style={styles.tokenInfo}>
          {/* Token Name */}
          <Text style={styles.tokenName} numberOfLines={1}>
            {displayName}
          </Text>
          
          {/* Holdings Amount + Symbol */}
          <Text style={styles.holdingsText} numberOfLines={1}>
            {formatHoldings(holdings)} {tokenSymbol}
          </Text>
        </View>
      </View>

      {/* Right Side: Values + Instabuy Button */}
      <View style={styles.rightSection}>
        {/* Holdings USD Value */}
        <Text style={styles.holdingsValue}>
          {formatUSD(holdingsValue)}
        </Text>
        
        {/* Token Price */}
        <View style={styles.priceRow}>
          <View style={styles.priceLabelPill}>
            <Text style={styles.priceLabel}>Price</Text>
          </View>
          <Text style={[styles.priceValue, { color: priceColor }]}>
            {formatPrice(tokenPrice)}
          </Text>
        </View>
      </View>

      {/* Instabuy Button */}
      <TouchableOpacity 
        style={styles.instabuyButton}
        onPress={onInstabuyPress}
        activeOpacity={0.8}
      >
        <Ionicons name="flash" size={16} color="#000" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 348,
    height: 69,
    backgroundColor: 'rgba(21, 24, 32, 0.6)',
    borderRadius: 8.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginVertical: 4,
    alignSelf: 'center',
  },
  
  // Left section: Logo + Token Info
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  
  tokenLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 16,
  },
  
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#30363d',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  
  logoPlaceholderText: {
    color: '#7d8590',
    fontSize: 16,
    fontWeight: '600',
  },
  
  tokenInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  
  tokenName: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 16,
    lineHeight: 19,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  
  holdingsText: {
    fontFamily: 'Satoshi-Medium',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 14,
    color: '#6A7580',
  },
  
  // Right section: Values
  rightSection: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  
  holdingsValue: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 16,
    lineHeight: 19,
    color: '#FFFFFF',
    textAlign: 'right',
    marginBottom: 2,
  },
  
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  
  priceLabelPill: {
    backgroundColor: 'rgba(171, 171, 171, 0.2)', // 20% opacity background
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  
  priceLabel: {
    fontFamily: 'Satoshi-Medium',
    fontSize: 10, // Smaller font size as per Figma
    lineHeight: 12,
    color: '#ABABAB', // Exact color from Figma
  },
  
  priceValue: {
    fontFamily: 'Satoshi-Medium',
    fontSize: 12,
    lineHeight: 14,
    // Color is set dynamically based on price change
  },
  
  // Instabuy button
  instabuyButton: {
    width: 32,
    height: 32,
    backgroundColor: '#FFB800',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

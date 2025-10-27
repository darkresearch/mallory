/**
 * API Request/Response Types
 * Shared between client and server
 */

import type { ClientContext } from '../chat/clientContext';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  conversationId: string;
  userId: string;
  clientContext?: ClientContext;
}

export interface HoldingsRequest {
  userId: string;
}

export interface HoldingsResponse {
  success: boolean;
  holdings: TokenHolding[];
  totalValue: number;
  smartAccountAddress?: string;
  error?: string;
}

export interface TokenHolding {
  tokenAddress: string;
  symbol: string;
  balance: string;
  decimals: number;
  uiAmount: number;
  price?: number;
  value?: number;
  name?: string;
  logoUrl?: string;
}

export interface ApiError {
  error: string;
  message?: string;
  code?: string;
}


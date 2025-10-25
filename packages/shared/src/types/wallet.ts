/**
 * Wallet & Transaction Types
 * Shared between client and server
 */

export interface WalletBalance {
  tokenAddress: string;
  symbol: string;
  balance: string;
  decimals: number;
  uiAmount: number;
  price?: number;
  value?: number;
}

export interface TransactionRequest {
  to_address: string;
  amount: string;
  token_address?: string;
}

export interface TransactionResponse {
  success: boolean;
  transaction?: {
    id: string;
    signature: string;
    status: string;
    to_address: string;
    amount: string;
    token: {
      address: string;
      symbol: string;
    };
  };
  error?: string;
  message?: string;
}

export interface GridAccount {
  address: string;
  grid_user_id: string;
  authentication: any[];
  status: 'active' | 'pending' | 'inactive';
}

export interface GridAccountStatus {
  status: string;
  account?: {
    id: string;
    address: string;
    status: string;
    ready_for_transactions: boolean;
  };
  verification?: {
    required: boolean;
    status: string;
    next_steps: string[];
  };
}


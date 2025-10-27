export interface X402PaymentRequirement {
  needsPayment: true;
  toolName: string;
  apiUrl: string;
  method: string;
  headers: Record<string, string>;
  body: any;
  estimatedCost: {
    amount: string;
    currency: string;
  };
}

export interface NansenHistoricalBalancesRequest {
  address: string;
  chain: string;
  date: {
    from: string;
    to: string;
  };
  pagination: {
    page: number;
    per_page: number;
  };
}

export interface NansenSmartMoneyNetflowRequest {
  chains: string[];
  pagination: {
    page: number;
    per_page: number;
  };
}

export interface NansenSmartMoneyHoldingsRequest {
  chains: string[];
  pagination: {
    page: number;
    per_page: number;
  };
}

export interface NansenSmartMoneyDexTradesRequest {
  chains: string[];
  pagination: {
    page: number;
    per_page: number;
  };
}

export interface NansenSmartMoneyJupiterDcasRequest {
  pagination: {
    page: number;
    per_page: number;
  };
}

export interface NansenCurrentBalanceRequest {
  wallet_address: string;
  chain: string;
}

export interface NansenTransactionsRequest {
  wallet_address: string;
  chain: string;
  date: { from: string; to: string };
  pagination: { page: number; per_page: number };
}

export interface NansenCounterpartiesRequest {
  wallet_address: string;
  chain: string;
  pagination: { page: number; per_page: number };
}

export interface NansenRelatedWalletsRequest {
  wallet_address: string;
  chain: string;
  pagination: { page: number; per_page: number };
}

export interface NansenPnlSummaryRequest {
  wallet_address: string;
  chain: string;
}

export interface NansenPnlRequest {
  wallet_address: string;
  chain: string;
  pagination: { page: number; per_page: number };
}

export interface NansenLabelsRequest {
  wallet_address: string;
}

export interface NansenTokenScreenerRequest {
  chains: string[];
  pagination: { page: number; per_page: number };
}

export interface NansenFlowIntelligenceRequest {
  token_address: string;
  chain: string;
}

export interface NansenHoldersRequest {
  token_address: string;
  chain: string;
  pagination: { page: number; per_page: number };
}

export interface NansenFlowsRequest {
  token_address: string;
  chain: string;
  date: { from: string; to: string };
}

export interface NansenWhoBoughtSoldRequest {
  token_address: string;
  chain: string;
  date: { from: string; to: string };
  pagination: { page: number; per_page: number };
}

export interface NansenTokenDexTradesRequest {
  token_address: string;
  chain: string;
  date: { from: string; to: string };
  pagination: { page: number; per_page: number };
}

export interface NansenTokenTransfersRequest {
  token_address: string;
  chain: string;
  date: { from: string; to: string };
  pagination: { page: number; per_page: number };
}

export interface NansenTokenJupiterDcasRequest {
  token_address: string;
  chain: string;
  pagination: { page: number; per_page: number };
}

export interface NansenPnlLeaderboardRequest {
  token_address: string;
  chain: string;
  date: { from: string; to: string };
  pagination: { page: number; per_page: number };
}

export interface NansenPortfolioRequest {
  wallet_address: string;
  chains: string[];
}


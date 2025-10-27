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
  address: string;
  chain: string;
}

export interface NansenTransactionsRequest {
  address: string;
  chain: string;
  date: { from: string; to: string };
  pagination: { page: number; per_page: number };
}

export interface NansenCounterpartiesRequest {
  address: string;
  chain: string;
  date: { from: string; to: string };
  pagination: { page: number; per_page: number };
}

export interface NansenRelatedWalletsRequest {
  address: string;
  chain: string;
  pagination: { page: number; per_page: number };
}

export interface NansenPnlSummaryRequest {
  address: string;
  chain: string;
  date: { from: string; to: string };
}

export interface NansenPnlRequest {
  address: string;
  chain: string;
  date: { from: string; to: string };
  pagination: { page: number; per_page: number };
}

export interface NansenLabelsRequest {
  parameters: {
    chain: string;
    address: string;
  };
  pagination: {
    page: number;
    recordsPerPage: number;
  };
}

export interface NansenTokenScreenerRequest {
  chains: string[];
  date: { from: string; to: string };
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


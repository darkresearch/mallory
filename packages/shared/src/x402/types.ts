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


import { tool } from 'ai';
import { z } from 'zod';
import { NansenUtils, X402_CONSTANTS, type X402PaymentRequirement } from '@darkresearch/mallory-shared';

/**
 * Nansen Historical Balances
 * Docs: https://docs.nansen.ai/api/profiler/address-historical-balances
 */
export function createNansenTool() {
  return tool({
    description: `Get historical token balances for an address from Nansen via Corbits proxy.
  
This is a premium data source that costs ~0.001 USDC per request.
Payment is handled automatically via x402 protocol.

Supports: Ethereum, Solana, and other major chains

Use this when users ask about:
- Historical holdings for an address
- Token balance changes over time
- Portfolio history
- Asset allocation over time

**IMPORTANT: Date range is REQUIRED**
- If user doesn't specify dates, default to the last 24 hours
- Dates must be in ISO 8601 format (e.g., "2025-05-01T00:00:00Z")
- Always provide both start and end dates`,

    inputSchema: z.object({
      address: z.string().describe('Blockchain address or ENS name (e.g., "vitalik.eth")'),
      chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, polygon, etc.)'),
      startDate: z.string().optional().describe('Start date in ISO 8601 format. If not provided, defaults to 24 hours ago.'),
      endDate: z.string().optional().describe('End date in ISO 8601 format. If not provided, defaults to now.'),
    }),

    execute: async ({ address, chain, startDate, endDate }: { address: string; chain: string; startDate?: string; endDate?: string }) => {
      const requestBody = NansenUtils.formatHistoricalBalancesRequest({
        address,
        chain,
        startDate,
        endDate
      });

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };

      const apiUrl = NansenUtils.getHistoricalBalancesUrl();

      // OPTIMIZATION: Skip initial fetch - we know Nansen requires payment
      const result: X402PaymentRequirement = {
        needsPayment: true,
        toolName: 'nansenHistoricalBalances',
        apiUrl,
        method: 'POST',
        headers,
        body: requestBody,
        estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      
      return result;
    }
  });
}

/**
 * Nansen Smart Money Netflows
 * Docs: https://docs.nansen.ai/api/smart-money/netflows
 */
export function createNansenSmartMoneyNetflowsTool() {
  return tool({
    description: `Get net flow of tokens bought/sold by Smart Money addresses from Nansen via Corbits proxy.

This is a premium data source that costs ~0.001 USDC per request.
Payment is handled automatically via x402 protocol.

Supports: Ethereum, Solana, and other major chains

Use this when users ask about:
- Smart money token flows
- What tokens smart money is buying or selling
- Net inflows/outflows by top wallets
- Smart money trading activity
- Which tokens are being accumulated or distributed

The data shows net flow metrics over 24h, 7d, and 30d periods.`,

    inputSchema: z.object({
      chains: z.array(z.string()).default(['ethereum', 'solana']).describe('Array of blockchain networks (e.g., ["ethereum", "solana"])'),
    }),

    execute: async ({ chains }: { chains: string[] }) => {
      const requestBody = NansenUtils.formatSmartMoneyNetflowRequest({
        chains
      });

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };

      const apiUrl = NansenUtils.getSmartMoneyNetflowUrl();

      // OPTIMIZATION: Skip initial fetch - we know Nansen requires payment
      const result: X402PaymentRequirement = {
        needsPayment: true,
        toolName: 'nansenSmartMoneyNetflows',
        apiUrl,
        method: 'POST',
        headers,
        body: requestBody,
        estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      
      return result;
    }
  });
}

/**
 * Nansen Smart Money Holdings
 * Docs: https://docs.nansen.ai/api/smart-money/holdings
 */
export function createNansenSmartMoneyHoldingsTool() {
  return tool({
    description: `Get current token holdings of Smart Money addresses from Nansen via Corbits proxy.

This is a premium data source that costs ~0.001 USDC per request.
Payment is handled automatically via x402 protocol.

Supports: Ethereum, Solana, and other major chains

Use this when users ask about:
- What tokens smart money currently holds
- Smart money portfolio composition
- Top holdings by smart wallets
- Current positions of top traders
- Smart money asset allocation

The data shows actual holdings and positions of top-performing wallets.`,

    inputSchema: z.object({
      chains: z.array(z.string()).default(['ethereum', 'solana']).describe('Array of blockchain networks (e.g., ["ethereum", "solana"])'),
    }),

    execute: async ({ chains }: { chains: string[] }) => {
      const requestBody = NansenUtils.formatSmartMoneyHoldingsRequest({
        chains
      });

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };

      const apiUrl = NansenUtils.getSmartMoneyHoldingsUrl();

      // OPTIMIZATION: Skip initial fetch - we know Nansen requires payment
      const result: X402PaymentRequirement = {
        needsPayment: true,
        toolName: 'nansenSmartMoneyHoldings',
        apiUrl,
        method: 'POST',
        headers,
        body: requestBody,
        estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      
      return result;
    }
  });
}

/**
 * Nansen Smart Money DEX Trades
 * Docs: https://docs.nansen.ai/api/smart-money/dex-trades
 */
export function createNansenSmartMoneyDexTradesTool() {
  return tool({
    description: `Get DEX trades by Smart Money addresses from Nansen via Corbits proxy.

This is a premium data source that costs ~0.001 USDC per request.
Payment is handled automatically via x402 protocol.

Supports: Ethereum, Solana, and other major chains

Use this when users ask about:
- Recent smart money DEX trades
- What smart money is trading on DEXs
- Smart money trading activity in the last 24h
- Recent buy/sell activity by top wallets
- Smart money DEX transactions

The data shows all DEX trades made by smart money traders in the last 24 hours.`,

    inputSchema: z.object({
      chains: z.array(z.string()).default(['ethereum', 'solana']).describe('Array of blockchain networks (e.g., ["ethereum", "solana"])'),
    }),

    execute: async ({ chains }: { chains: string[] }) => {
      const requestBody = NansenUtils.formatSmartMoneyDexTradesRequest({
        chains
      });

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };

      const apiUrl = NansenUtils.getSmartMoneyDexTradesUrl();

      // OPTIMIZATION: Skip initial fetch - we know Nansen requires payment
      const result: X402PaymentRequirement = {
        needsPayment: true,
        toolName: 'nansenSmartMoneyDexTrades',
        apiUrl,
        method: 'POST',
        headers,
        body: requestBody,
        estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      
      return result;
    }
  });
}

/**
 * Nansen Smart Money Jupiter DCAs
 * Docs: https://docs.nansen.ai/api/smart-money/jupiter-dcas
 */
export function createNansenSmartMoneyJupiterDcasTool() {
  return tool({
    description: `Get Jupiter DCA (Dollar Cost Averaging) orders started by Smart Money on Solana from Nansen via Corbits proxy.

This is a premium data source that costs ~0.001 USDC per request.
Payment is handled automatically via x402 protocol.

Supports: Solana only (Jupiter is Solana-specific)

Use this when users ask about:
- Smart money DCA strategies on Solana
- Jupiter DCA orders by top wallets
- Automated buying/selling by smart money
- Dollar cost averaging activity
- Smart money recurring orders on Jupiter

The data shows DCA orders created by smart money wallets on Solana's Jupiter aggregator.`,

    inputSchema: z.object({}),

    execute: async () => {
      const requestBody = NansenUtils.formatSmartMoneyJupiterDcasRequest();

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };

      const apiUrl = NansenUtils.getSmartMoneyJupiterDcasUrl();

      // OPTIMIZATION: Skip initial fetch - we know Nansen requires payment
      const result: X402PaymentRequirement = {
        needsPayment: true,
        toolName: 'nansenSmartMoneyJupiterDcas',
        apiUrl,
        method: 'POST',
        headers,
        body: requestBody,
        estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      
      return result;
    }
  });
}

/**
 * Nansen Current Balance
 * Docs: https://docs.nansen.ai/api/profiler/address-current-balances
 */
export function createNansenCurrentBalanceTool() {
  return tool({
    description: `Get current token balances for an address from Nansen via Corbits proxy.

This is a premium data source that costs ~0.001 USDC per request.
Payment is handled automatically via x402 protocol.

Supports: Ethereum, Solana, and other major chains

Use this when users ask about:
- Current token holdings for an address
- What tokens an address holds right now
- Current portfolio snapshot
- Present-day balances

The data shows real-time token balances.`,

    inputSchema: z.object({
      address: z.string().describe('Blockchain address or ENS name'),
      chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)'),
    }),

    execute: async ({ address, chain }: { address: string; chain: string }) => {
      const requestBody = NansenUtils.formatCurrentBalanceRequest({ address, chain });
      const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
      const apiUrl = NansenUtils.getCurrentBalanceUrl();
      const result: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenCurrentBalance', apiUrl, method: 'POST', headers, body: requestBody,
        estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return result;
    }
  });
}

/**
 * Nansen Transactions
 * Docs: https://docs.nansen.ai/api/profiler/address-transactions
 */
export function createNansenTransactionsTool() {
  return tool({
    description: `Get transaction history for an address from Nansen. Supports: Ethereum, Solana. Use for: transaction list, activity history, on-chain actions.`,
    inputSchema: z.object({
      address: z.string().describe('Blockchain address'),
      chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)'),
    }),
    execute: async ({ address, chain }: { address: string; chain: string }) => {
      const result: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenTransactions', apiUrl: NansenUtils.getTransactionsUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatTransactionsRequest({ address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return result;
    }
  });
}

/**
 * Nansen Counterparties
 * Docs: https://docs.nansen.ai/api/profiler/address-counterparties
 */
export function createNansenCounterpartiesTool() {
  return tool({
    description: `Get top counterparties an address has interacted with from Nansen. Supports: Ethereum, Solana. Use for: who they trade with, interaction partners.`,
    inputSchema: z.object({
      address: z.string().describe('Blockchain address'),
      chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)'),
    }),
    execute: async ({ address, chain }: { address: string; chain: string }) => {
      const result: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenCounterparties', apiUrl: NansenUtils.getCounterpartiesUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatCounterpartiesRequest({ address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return result;
    }
  });
}

/**
 * Nansen Related Wallets
 * Docs: https://docs.nansen.ai/api/profiler/address-related-wallets
 */
export function createNansenRelatedWalletsTool() {
  return tool({
    description: `Get related wallets for an address from Nansen. Supports: Ethereum, Solana. Use for: wallet clusters, related addresses, connected wallets.`,
    inputSchema: z.object({
      address: z.string().describe('Blockchain address'),
      chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)'),
    }),
    execute: async ({ address, chain }: { address: string; chain: string }) => {
      const result: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenRelatedWallets', apiUrl: NansenUtils.getRelatedWalletsUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatRelatedWalletsRequest({ address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return result;
    }
  });
}

/**
 * Nansen PnL Summary
 * Docs: https://docs.nansen.ai/api/profiler/address-pnl-and-trade-performance
 */
export function createNansenPnlSummaryTool() {
  return tool({
    description: `Get PnL summary with top 5 trades for an address from Nansen. Supports: Ethereum, Solana. Use for: profit/loss, trading performance, top trades.`,
    inputSchema: z.object({
      address: z.string().describe('Blockchain address'),
      chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)'),
    }),
    execute: async ({ address, chain }: { address: string; chain: string }) => {
      const result: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenPnlSummary', apiUrl: NansenUtils.getPnlSummaryUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatPnlSummaryRequest({ address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return result;
    }
  });
}

/**
 * Nansen PnL Full History
 * Docs: https://docs.nansen.ai/api/profiler/address-pnl-and-trade-performance#post-api-v1-profiler-address-pnl
 */
export function createNansenPnlTool() {
  return tool({
    description: `Get full PnL history for an address from Nansen. Supports: Ethereum, Solana. Use for: all past trades, complete trading history, performance details.`,
    inputSchema: z.object({
      address: z.string().describe('Blockchain address'),
      chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)'),
    }),
    execute: async ({ address, chain }: { address: string; chain: string }) => {
      const result: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenPnl', apiUrl: NansenUtils.getPnlUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatPnlRequest({ address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return result;
    }
  });
}

/**
 * Nansen Address Labels
 * Docs: https://docs.nansen.ai/api/profiler/address-labels
 */
export function createNansenLabelsTool() {
  return tool({
    description: `Get all labels for an address from Nansen. Supports: Ethereum, Solana. Use for: address classification, wallet type, entity identification.`,
    inputSchema: z.object({
      address: z.string().describe('Blockchain address'),
    }),
    execute: async ({ address }: { address: string }) => {
      const result: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenLabels', apiUrl: NansenUtils.getLabelsUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatLabelsRequest({ address }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return result;
    }
  });
}

/**
 * Nansen Token Screener
 * Docs: https://docs.nansen.ai/api/token-god-mode/token-screener
 */
export function createNansenTokenScreenerTool() {
  return tool({
    description: `Screen tokens with analytics from Nansen. Supports: Ethereum, Solana. Use for: discover tokens, token analytics, screening.`,
    inputSchema: z.object({ chains: z.array(z.string()).default(['ethereum', 'solana']) }),
    execute: async ({ chains }: { chains: string[] }) => {
      return { needsPayment: true, toolName: 'nansenTokenScreener', apiUrl: NansenUtils.getTokenScreenerUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatTokenScreenerRequest({ chains }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST };
    }
  });
}

/**
 * Nansen Flow Intelligence
 * Docs: https://docs.nansen.ai/api/token-god-mode/flow-intelligence
 */
export function createNansenFlowIntelligenceTool() {
  return tool({
    description: `Get flow intelligence for a token from Nansen. Supports: Ethereum, Solana. Use for: token flow summary, smart money activity on token.`,
    inputSchema: z.object({ token_address: z.string(), chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)') }),
    execute: async ({ token_address, chain }: { token_address: string; chain: string }) => {
      return { needsPayment: true, toolName: 'nansenFlowIntelligence', apiUrl: NansenUtils.getFlowIntelligenceUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatFlowIntelligenceRequest({ token_address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST };
    }
  });
}

/**
 * Nansen Token Holders
 * Docs: https://docs.nansen.ai/api/token-god-mode/holders
 */
export function createNansenHoldersTool() {
  return tool({
    description: `Get top holders of a token from Nansen. Supports: Ethereum, Solana. Use for: token holders, who holds token, whale tracking.`,
    inputSchema: z.object({ token_address: z.string(), chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)') }),
    execute: async ({ token_address, chain }: { token_address: string; chain: string }) => {
      return { needsPayment: true, toolName: 'nansenHolders', apiUrl: NansenUtils.getHoldersUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatHoldersRequest({ token_address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST };
    }
  });
}

/**
 * Nansen Token Flows
 * Docs: https://docs.nansen.ai/api/token-god-mode/flows
 */
export function createNansenFlowsTool() {
  return tool({
    description: `Get inflow/outflow for a token from Nansen. Supports: Ethereum, Solana. Use for: token flows, net flow, capital movement.`,
    inputSchema: z.object({ token_address: z.string(), chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)') }),
    execute: async ({ token_address, chain }: { token_address: string; chain: string }) => {
      return { needsPayment: true, toolName: 'nansenFlows', apiUrl: NansenUtils.getFlowsUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatFlowsRequest({ token_address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST };
    }
  });
}

/**
 * Nansen Who Bought/Sold
 * Docs: https://docs.nansen.ai/api/token-god-mode/who-bought-sold
 */
export function createNansenWhoBoughtSoldTool() {
  return tool({
    description: `Get recent buyers/sellers of a token from Nansen. Supports: Ethereum, Solana. Use for: who bought token, who sold token, recent activity.`,
    inputSchema: z.object({ token_address: z.string(), chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)') }),
    execute: async ({ token_address, chain }: { token_address: string; chain: string }) => {
      return { needsPayment: true, toolName: 'nansenWhoBoughtSold', apiUrl: NansenUtils.getWhoBoughtSoldUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatWhoBoughtSoldRequest({ token_address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST };
    }
  });
}

/**
 * Nansen Token DEX Trades
 * Docs: https://docs.nansen.ai/api/token-god-mode/dex-trades
 */
export function createNansenTokenDexTradesTool() {
  return tool({
    description: `Get DEX trades for a token from Nansen. Supports: Ethereum, Solana. Use for: token DEX activity, swaps, trades.`,
    inputSchema: z.object({ token_address: z.string(), chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)') }),
    execute: async ({ token_address, chain }: { token_address: string; chain: string }) => {
      return { needsPayment: true, toolName: 'nansenTokenDexTrades', apiUrl: NansenUtils.getTokenDexTradesUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatTokenDexTradesRequest({ token_address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST };
    }
  });
}

/**
 * Nansen Token Transfers
 * Docs: https://docs.nansen.ai/api/token-god-mode/token-transfers
 */
export function createNansenTokenTransfersTool() {
  return tool({
    description: `Get token transfers from Nansen. Supports: Ethereum, Solana. Use for: token movements, large transfers, whale transfers.`,
    inputSchema: z.object({ token_address: z.string(), chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)') }),
    execute: async ({ token_address, chain }: { token_address: string; chain: string }) => {
      return { needsPayment: true, toolName: 'nansenTokenTransfers', apiUrl: NansenUtils.getTokenTransfersUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatTokenTransfersRequest({ token_address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST };
    }
  });
}

/**
 * Nansen Token Jupiter DCAs
 * Docs: https://docs.nansen.ai/api/token-god-mode/jupiter-dcas
 */
export function createNansenTokenJupiterDcasTool() {
  return tool({
    description: `Get Jupiter DCA orders for a token on Solana from Nansen. Supports: Solana only. Use for: DCA activity, automated orders.`,
    inputSchema: z.object({ token_address: z.string(), chain: z.string().default('solana') }),
    execute: async ({ token_address, chain }: { token_address: string; chain: string }) => {
      return { needsPayment: true, toolName: 'nansenTokenJupiterDcas', apiUrl: NansenUtils.getTokenJupiterDcasUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatTokenJupiterDcasRequest({ token_address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST };
    }
  });
}

/**
 * Nansen PnL Leaderboard
 * Docs: https://docs.nansen.ai/api/token-god-mode/pnl-leaderboard
 */
export function createNansenPnlLeaderboardTool() {
  return tool({
    description: `Get PnL leaderboard for a token from Nansen. Supports: Ethereum, Solana. Use for: top traders, best performers, token PnL.`,
    inputSchema: z.object({ token_address: z.string(), chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)') }),
    execute: async ({ token_address, chain }: { token_address: string; chain: string }) => {
      return { needsPayment: true, toolName: 'nansenPnlLeaderboard', apiUrl: NansenUtils.getPnlLeaderboardUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatPnlLeaderboardRequest({ token_address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST };
    }
  });
}

/**
 * Nansen Portfolio DeFi Holdings
 * Docs: https://docs.nansen.ai/api/portfolio
 */
export function createNansenPortfolioTool() {
  return tool({
    description: `Get DeFi portfolio holdings for an address from Nansen. Supports: Ethereum, Solana. Use for: DeFi positions, staked assets, LP positions.`,
    inputSchema: z.object({ address: z.string(), chains: z.array(z.string()).default(['ethereum', 'solana']) }),
    execute: async ({ address, chains }: { address: string; chains: string[] }) => {
      return { needsPayment: true, toolName: 'nansenPortfolio', apiUrl: NansenUtils.getPortfolioUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatPortfolioRequest({ address, chains }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST };
    }
  });
}


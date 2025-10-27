import { tool } from 'ai';
import { z } from 'zod';
import { GridClient } from '@sqds/grid';
import { 
  NansenUtils, 
  X402_CONSTANTS, 
  X402PaymentService,
  type X402PaymentRequirement,
  type GridTokenSender 
} from '@darkresearch/mallory-shared';

/**
 * X402 Context passed from chat endpoint
 * Contains Grid session secrets for payment signing
 */
interface X402Context {
  gridSessionSecrets: any;
  gridSession: any;
}

/**
 * Grid SDK instance for backend operations
 */
const gridClient = new GridClient({
  environment: (process.env.GRID_ENV || 'production') as 'sandbox' | 'production',
  apiKey: process.env.GRID_API_KEY!,
  baseUrl: 'https://grid.squads.xyz'
});

/**
 * Create Grid token sender for x402 utilities
 * This wraps the Grid SDK sendTokens functionality
 */
function createGridSender(sessionSecrets: any, session: any, address: string): GridTokenSender {
  return {
    async sendTokens(params: { recipient: string; amount: string; tokenMint?: string }): Promise<string> {
      const { recipient, amount, tokenMint } = params;
      
      // Import Solana dependencies
      const {
        PublicKey,
        SystemProgram,
        TransactionMessage,
        VersionedTransaction,
        Connection,
        LAMPORTS_PER_SOL
      } = await import('@solana/web3.js');
      
      const {
        createTransferInstruction,
        getAssociatedTokenAddress,
        createAssociatedTokenAccountInstruction,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      } = await import('@solana/spl-token');
      
      const connection = new Connection(
        process.env.SOLANA_RPC_URL || process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        'confirmed'
      );

      // Build Solana transaction instructions
      const instructions = [];
      
      if (tokenMint) {
        // SPL Token transfer
        const fromTokenAccount = await getAssociatedTokenAddress(
          new PublicKey(tokenMint),
          new PublicKey(address),
          true  // allowOwnerOffCurve for Grid PDA
        );
        
        const toTokenAccount = await getAssociatedTokenAddress(
          new PublicKey(tokenMint),
          new PublicKey(recipient),
          false
        );

        const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
        
        if (!toAccountInfo) {
          const createAtaIx = createAssociatedTokenAccountInstruction(
            new PublicKey(address),
            toTokenAccount,
            new PublicKey(recipient),
            new PublicKey(tokenMint),
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          );
          instructions.push(createAtaIx);
        }

        const amountInSmallestUnit = Math.floor(parseFloat(amount) * 1000000);

        const transferIx = createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          new PublicKey(address),
          amountInSmallestUnit,
          [],
          TOKEN_PROGRAM_ID
        );
        instructions.push(transferIx);
      } else {
        // SOL transfer
        const amountInLamports = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);
        
        const transferIx = SystemProgram.transfer({
          fromPubkey: new PublicKey(address),
          toPubkey: new PublicKey(recipient),
          lamports: amountInLamports
        });
        instructions.push(transferIx);
      }

      const { blockhash } = await connection.getLatestBlockhash('confirmed');

      const message = new TransactionMessage({
        payerKey: new PublicKey(address),
        recentBlockhash: blockhash,
        instructions
      }).compileToV0Message();

      const transaction = new VersionedTransaction(message);
      const serialized = Buffer.from(transaction.serialize()).toString('base64');

      const transactionPayload = await gridClient.prepareArbitraryTransaction(
        address,
        {
          transaction: serialized,
          fee_config: {
            currency: 'sol',
            payer_address: address,
            self_managed_fees: false
          }
        }
      );

      if (!transactionPayload || !transactionPayload.data) {
        throw new Error('Failed to prepare transaction');
      }

      console.log('🔐 [Grid SDK] signAndSend parameters:', {
        hasSessionSecrets: !!sessionSecrets,
        sessionType: typeof session,
        sessionIsArray: Array.isArray(session),
        sessionKeys: session ? Object.keys(session) : [],
        address
      });
      
      const result = await gridClient.signAndSend({
        sessionSecrets,
        session,
        transactionPayload: transactionPayload.data,
        address
      });

      return result.transaction_signature || 'success';
    }
  };
}

/**
 * Initialize X402 Payment Service with Grid context
 */
function createX402Service(x402Context?: X402Context): X402PaymentService | null {
  if (!x402Context) {
    return null;
  }

  return new X402PaymentService({
    solanaRpcUrl: process.env.SOLANA_RPC_URL || process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    solanaCluster: 'mainnet-beta',
    usdcMint: X402_CONSTANTS.USDC_MINT,
    ephemeralFundingUsdc: X402_CONSTANTS.EPHEMERAL_FUNDING_USDC,
    ephemeralFundingSol: X402_CONSTANTS.EPHEMERAL_FUNDING_SOL
  });
}

/**
 * Helper: Handle x402 payment server-side or return payment requirement
 * DRY helper used by all Nansen tools
 */
async function handleX402OrReturnRequirement(
  x402Context: X402Context | undefined,
  paymentReq: X402PaymentRequirement
): Promise<any> {
  // If Grid context available, handle payment server-side
  if (x402Context) {
    console.log(`💰 [Nansen] Handling x402 payment server-side for ${paymentReq.toolName}...`);
    
    const x402Service = createX402Service(x402Context);
    if (!x402Service) {
      throw new Error('Failed to initialize x402 service');
    }

    // Create Grid sender with session context
    // gridSession now has structure: { authentication: [...], address: "..." }
    const gridSender = createGridSender(
      x402Context.gridSessionSecrets,
      x402Context.gridSession.authentication,  // Pass authentication array to Grid SDK
      x402Context.gridSession.address
    );

    // Execute x402 payment and fetch data
    const data = await x402Service.payAndFetchData(
      paymentReq,
      x402Context.gridSession.address,
      gridSender
    );

    console.log(`✅ [Nansen] Data fetched via x402 for ${paymentReq.toolName}`);
    return data;
  }

  // Fallback: Return payment requirement for client-side handling
  return paymentReq;
}

/**
 * Nansen Historical Balances
 * Docs: https://docs.nansen.ai/api/profiler/address-historical-balances
 */
export function createNansenTool(x402Context?: X402Context) {
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

      const paymentReq: X402PaymentRequirement = {
        needsPayment: true,
        toolName: 'nansenHistoricalBalances',
        apiUrl,
        method: 'POST',
        headers,
        body: requestBody,
        estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}

/**
 * Nansen Smart Money Netflows
 * Docs: https://docs.nansen.ai/api/smart-money/netflows
 */
export function createNansenSmartMoneyNetflowsTool(x402Context?: X402Context) {
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
      const requestBody = NansenUtils.formatSmartMoneyNetflowRequest({ chains });
      const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
      const apiUrl = NansenUtils.getSmartMoneyNetflowUrl();
      
      const paymentReq: X402PaymentRequirement = {
        needsPayment: true,
        toolName: 'nansenSmartMoneyNetflows',
        apiUrl,
        method: 'POST',
        headers,
        body: requestBody,
        estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}

/**
 * Nansen Smart Money Holdings
 * Docs: https://docs.nansen.ai/api/smart-money/holdings
 */
export function createNansenSmartMoneyHoldingsTool(x402Context?: X402Context) {
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

      const paymentReq: X402PaymentRequirement = {
        needsPayment: true,
        toolName: 'nansenSmartMoneyHoldings',
        apiUrl,
        method: 'POST',
        headers,
        body: requestBody,
        estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}

/**
 * Nansen Smart Money DEX Trades
 * Docs: https://docs.nansen.ai/api/smart-money/dex-trades
 */
export function createNansenSmartMoneyDexTradesTool(x402Context?: X402Context) {
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

      const paymentReq: X402PaymentRequirement = {
        needsPayment: true,
        toolName: 'nansenSmartMoneyDexTrades',
        apiUrl,
        method: 'POST',
        headers,
        body: requestBody,
        estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}

/**
 * Nansen Smart Money Jupiter DCAs
 * Docs: https://docs.nansen.ai/api/smart-money/jupiter-dcas
 */
export function createNansenSmartMoneyJupiterDcasTool(x402Context?: X402Context) {
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

      const paymentReq: X402PaymentRequirement = {
        needsPayment: true,
        toolName: 'nansenSmartMoneyJupiterDcas',
        apiUrl,
        method: 'POST',
        headers,
        body: requestBody,
        estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}

/**
 * Nansen Current Balance
 * Docs: https://docs.nansen.ai/api/profiler/address-current-balances
 */
export function createNansenCurrentBalanceTool(x402Context?: X402Context) {
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
      console.log('🔧 [nansenCurrentBalance] AI chose parameters:', { address, chain });
      
      const requestBody = NansenUtils.formatCurrentBalanceRequest({ address, chain });
      console.log('📝 [nansenCurrentBalance] Request body:', JSON.stringify(requestBody, null, 2));
      
      const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
      const apiUrl = NansenUtils.getCurrentBalanceUrl();
      
      const paymentReq: X402PaymentRequirement = {
        needsPayment: true,
        toolName: 'nansenCurrentBalance',
        apiUrl,
        method: 'POST',
        headers,
        body: requestBody,
        estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      
      // Use DRY helper - handles server-side x402 or returns requirement
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}

/**
 * Nansen Transactions
 * Docs: https://docs.nansen.ai/api/profiler/address-transactions
 */
export function createNansenTransactionsTool(x402Context?: X402Context) {
  return tool({
    description: `Get transaction history for an address from Nansen. Supports: Ethereum, Solana. Use for: transaction list, activity history, on-chain actions. Defaults to last 24 hours if no date range provided.`,
    inputSchema: z.object({
      address: z.string().describe('Blockchain address'),
      chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)'),
      startDate: z.string().optional().describe('Start date in ISO 8601 format. Defaults to 24 hours ago.'),
      endDate: z.string().optional().describe('End date in ISO 8601 format. Defaults to now.'),
    }),
    execute: async ({ address, chain, startDate, endDate }: { address: string; chain: string; startDate?: string; endDate?: string }) => {
      console.log('🔧 [nansenTransactions] AI chose parameters:', { address, chain, startDate, endDate });
      
      const requestBody = NansenUtils.formatTransactionsRequest({ address, chain });
      console.log('📝 [nansenTransactions] Request body:', JSON.stringify(requestBody, null, 2));
      
      const paymentReq: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenTransactions', apiUrl: NansenUtils.getTransactionsUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: requestBody, estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}

/**
 * Nansen Counterparties
 * Docs: https://docs.nansen.ai/api/profiler/address-counterparties
 */
export function createNansenCounterpartiesTool(x402Context?: X402Context) {
  return tool({
    description: `Get top counterparties an address has interacted with from Nansen. Supports: Ethereum, Solana. Use for: who they trade with, interaction partners. Defaults to last 24 hours if no date range provided.`,
    inputSchema: z.object({
      address: z.string().describe('Blockchain address'),
      chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)'),
      startDate: z.string().optional().describe('Start date in ISO 8601 format. Defaults to 24 hours ago.'),
      endDate: z.string().optional().describe('End date in ISO 8601 format. Defaults to now.'),
    }),
    execute: async ({ address, chain, startDate, endDate }: { address: string; chain: string; startDate?: string; endDate?: string }) => {
      const paymentReq: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenCounterparties', apiUrl: NansenUtils.getCounterpartiesUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatCounterpartiesRequest({ address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}

/**
 * Nansen Related Wallets
 * Docs: https://docs.nansen.ai/api/profiler/address-related-wallets
 */
export function createNansenRelatedWalletsTool(x402Context?: X402Context) {
  return tool({
    description: `Get related wallets for an address from Nansen. Supports: Ethereum, Solana. Use for: wallet clusters, related addresses, connected wallets.`,
    inputSchema: z.object({
      address: z.string().describe('Blockchain address'),
      chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)'),
    }),
    execute: async ({ address, chain }: { address: string; chain: string }) => {
      const paymentReq: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenRelatedWallets', apiUrl: NansenUtils.getRelatedWalletsUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatRelatedWalletsRequest({ address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}

/**
 * Nansen PnL Summary
 * Docs: https://docs.nansen.ai/api/profiler/address-pnl-and-trade-performance
 */
export function createNansenPnlSummaryTool(x402Context?: X402Context) {
  return tool({
    description: `Get PnL summary with top 5 trades for an address from Nansen. Supports: Ethereum, Solana. Use for: profit/loss, trading performance, top trades. Defaults to last 24 hours if no date range provided.`,
    inputSchema: z.object({
      address: z.string().describe('Blockchain address'),
      chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)'),
      startDate: z.string().optional().describe('Start date in ISO 8601 format. Defaults to 24 hours ago.'),
      endDate: z.string().optional().describe('End date in ISO 8601 format. Defaults to now.'),
    }),
    execute: async ({ address, chain, startDate, endDate }: { address: string; chain: string; startDate?: string; endDate?: string }) => {
      console.log('🔧 [nansenPnlSummary] AI chose parameters:', { address, chain, startDate, endDate });
      
      const requestBody = NansenUtils.formatPnlSummaryRequest({ address, chain });
      console.log('📝 [nansenPnlSummary] Request body:', JSON.stringify(requestBody, null, 2));
      
      const paymentReq: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenPnlSummary', apiUrl: NansenUtils.getPnlSummaryUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: requestBody, estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}

/**
 * Nansen PnL Full History
 * Docs: https://docs.nansen.ai/api/profiler/address-pnl-and-trade-performance#post-api-v1-profiler-address-pnl
 */
export function createNansenPnlTool(x402Context?: X402Context) {
  return tool({
    description: `Get full PnL history for an address from Nansen. Supports: Ethereum, Solana. Use for: all past trades, complete trading history, performance details. Defaults to last 24 hours if no date range provided.`,
    inputSchema: z.object({
      address: z.string().describe('Blockchain address'),
      chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)'),
      startDate: z.string().optional().describe('Start date in ISO 8601 format. Defaults to 24 hours ago.'),
      endDate: z.string().optional().describe('End date in ISO 8601 format. Defaults to now.'),
    }),
    execute: async ({ address, chain, startDate, endDate }: { address: string; chain: string; startDate?: string; endDate?: string }) => {
      const paymentReq: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenPnl', apiUrl: NansenUtils.getPnlUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatPnlRequest({ address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}

/**
 * Nansen Address Labels
 * Docs: https://docs.nansen.ai/api/profiler/address-labels
 */
export function createNansenLabelsTool(x402Context?: X402Context) {
  return tool({
    description: `Get all labels for an address from Nansen. Supports: Ethereum, Solana. Use for: address classification, wallet type, entity identification.`,
    inputSchema: z.object({
      address: z.string().describe('Blockchain address'),
      chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)'),
    }),
    execute: async ({ address, chain }: { address: string; chain: string }) => {
      console.log('🔧 [nansenLabels] AI chose parameters:', { address, chain });
      
      const requestBody = NansenUtils.formatLabelsRequest({ address, chain });
      console.log('📝 [nansenLabels] Request body:', JSON.stringify(requestBody, null, 2));
      
      const paymentReq: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenLabels', apiUrl: NansenUtils.getLabelsUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: requestBody, estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}

/**
 * Nansen Token Screener
 * Docs: https://docs.nansen.ai/api/token-god-mode/token-screener
 */
export function createNansenTokenScreenerTool(x402Context?: X402Context) {
  return tool({
    description: `Screen tokens with analytics from Nansen. Supports: Ethereum, Solana. Use for: discover tokens, token analytics, screening.`,
    inputSchema: z.object({ chains: z.array(z.string()).default(['ethereum', 'solana']) }),
    execute: async ({ chains }: { chains: string[] }) => {
      const paymentReq: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenTokenScreener', apiUrl: NansenUtils.getTokenScreenerUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatTokenScreenerRequest({ chains }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}

/**
 * Nansen Flow Intelligence
 * Docs: https://docs.nansen.ai/api/token-god-mode/flow-intelligence
 */
export function createNansenFlowIntelligenceTool(x402Context?: X402Context) {
  return tool({
    description: `Get flow intelligence for a token from Nansen. Supports: Ethereum, Solana. Use for: token flow summary, smart money activity on token.`,
    inputSchema: z.object({ token_address: z.string(), chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)') }),
    execute: async ({ token_address, chain }: { token_address: string; chain: string }) => {
      const paymentReq: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenFlowIntelligence', apiUrl: NansenUtils.getFlowIntelligenceUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatFlowIntelligenceRequest({ token_address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}

/**
 * Nansen Token Holders
 * Docs: https://docs.nansen.ai/api/token-god-mode/holders
 */
export function createNansenHoldersTool(x402Context?: X402Context) {
  return tool({
    description: `Get top holders of a token from Nansen. Supports: Ethereum, Solana. Use for: token holders, who holds token, whale tracking.`,
    inputSchema: z.object({ token_address: z.string(), chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)') }),
    execute: async ({ token_address, chain }: { token_address: string; chain: string }) => {
      const paymentReq: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenHolders', apiUrl: NansenUtils.getHoldersUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatHoldersRequest({ token_address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}

/**
 * Nansen Token Flows
 * Docs: https://docs.nansen.ai/api/token-god-mode/flows
 */
export function createNansenFlowsTool(x402Context?: X402Context) {
  return tool({
    description: `Get inflow/outflow for a token from Nansen. Supports: Ethereum, Solana. Use for: token flows, net flow, capital movement. Defaults to last 24 hours if no date range provided.`,
    inputSchema: z.object({ 
      token_address: z.string(), 
      chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)'),
      startDate: z.string().optional().describe('Start date in ISO 8601 format. Defaults to 24 hours ago.'),
      endDate: z.string().optional().describe('End date in ISO 8601 format. Defaults to now.'),
    }),
    execute: async ({ token_address, chain, startDate, endDate }: { token_address: string; chain: string; startDate?: string; endDate?: string }) => {
      const paymentReq: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenFlows', apiUrl: NansenUtils.getFlowsUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatFlowsRequest({ token_address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}

/**
 * Nansen Who Bought/Sold
 * Docs: https://docs.nansen.ai/api/token-god-mode/who-bought-sold
 */
export function createNansenWhoBoughtSoldTool(x402Context?: X402Context) {
  return tool({
    description: `Get recent buyers/sellers of a token from Nansen. Supports: Ethereum, Solana. Use for: who bought token, who sold token, recent activity. Defaults to last 24 hours if no date range provided.`,
    inputSchema: z.object({ 
      token_address: z.string(), 
      chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)'),
      startDate: z.string().optional().describe('Start date in ISO 8601 format. Defaults to 24 hours ago.'),
      endDate: z.string().optional().describe('End date in ISO 8601 format. Defaults to now.'),
    }),
    execute: async ({ token_address, chain, startDate, endDate }: { token_address: string; chain: string; startDate?: string; endDate?: string }) => {
      const paymentReq: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenWhoBoughtSold', apiUrl: NansenUtils.getWhoBoughtSoldUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatWhoBoughtSoldRequest({ token_address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}

/**
 * Nansen Token DEX Trades
 * Docs: https://docs.nansen.ai/api/token-god-mode/dex-trades
 */
export function createNansenTokenDexTradesTool(x402Context?: X402Context) {
  return tool({
    description: `Get DEX trades for a token from Nansen. Supports: Ethereum, Solana. Use for: token DEX activity, swaps, trades. Defaults to last 24 hours if no date range provided.`,
    inputSchema: z.object({ 
      token_address: z.string(), 
      chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)'),
      startDate: z.string().optional().describe('Start date in ISO 8601 format. Defaults to 24 hours ago.'),
      endDate: z.string().optional().describe('End date in ISO 8601 format. Defaults to now.'),
    }),
    execute: async ({ token_address, chain, startDate, endDate }: { token_address: string; chain: string; startDate?: string; endDate?: string }) => {
      const paymentReq: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenTokenDexTrades', apiUrl: NansenUtils.getTokenDexTradesUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatTokenDexTradesRequest({ token_address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}

/**
 * Nansen Token Transfers
 * Docs: https://docs.nansen.ai/api/token-god-mode/token-transfers
 */
export function createNansenTokenTransfersTool(x402Context?: X402Context) {
  return tool({
    description: `Get token transfers from Nansen. Supports: Ethereum, Solana. Use for: token movements, large transfers, whale transfers. Defaults to last 24 hours if no date range provided.`,
    inputSchema: z.object({ 
      token_address: z.string(), 
      chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)'),
      startDate: z.string().optional().describe('Start date in ISO 8601 format. Defaults to 24 hours ago.'),
      endDate: z.string().optional().describe('End date in ISO 8601 format. Defaults to now.'),
    }),
    execute: async ({ token_address, chain, startDate, endDate }: { token_address: string; chain: string; startDate?: string; endDate?: string }) => {
      const paymentReq: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenTokenTransfers', apiUrl: NansenUtils.getTokenTransfersUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatTokenTransfersRequest({ token_address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}

/**
 * Nansen Token Jupiter DCAs
 * Docs: https://docs.nansen.ai/api/token-god-mode/jupiter-dcas
 */
export function createNansenTokenJupiterDcasTool(x402Context?: X402Context) {
  return tool({
    description: `Get Jupiter DCA orders for a token on Solana from Nansen. Solana-only (Jupiter is Solana-specific). Use for: DCA activity, automated orders.`,
    inputSchema: z.object({ token_address: z.string().describe('Solana token address') }),
    execute: async ({ token_address }: { token_address: string }) => {
      const paymentReq: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenTokenJupiterDcas', apiUrl: NansenUtils.getTokenJupiterDcasUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatTokenJupiterDcasRequest({ token_address }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}

/**
 * Nansen PnL Leaderboard
 * Docs: https://docs.nansen.ai/api/token-god-mode/pnl-leaderboard
 */
export function createNansenPnlLeaderboardTool(x402Context?: X402Context) {
  return tool({
    description: `Get PnL leaderboard for a token from Nansen. Supports: Ethereum, Solana. Use for: top traders, best performers, token PnL. Defaults to last 24 hours if no date range provided.`,
    inputSchema: z.object({ 
      token_address: z.string(), 
      chain: z.string().default('ethereum').describe('Blockchain network (ethereum, solana, etc.)'),
      startDate: z.string().optional().describe('Start date in ISO 8601 format. Defaults to 24 hours ago.'),
      endDate: z.string().optional().describe('End date in ISO 8601 format. Defaults to now.'),
    }),
    execute: async ({ token_address, chain, startDate, endDate }: { token_address: string; chain: string; startDate?: string; endDate?: string }) => {
      const paymentReq: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenPnlLeaderboard', apiUrl: NansenUtils.getPnlLeaderboardUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatPnlLeaderboardRequest({ token_address, chain }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}

/**
 * Nansen Portfolio DeFi Holdings
 * Docs: https://docs.nansen.ai/api/portfolio
 */
export function createNansenPortfolioTool(x402Context?: X402Context) {
  return tool({
    description: `Get DeFi portfolio holdings for an address from Nansen. Supports: Ethereum, Solana. Use for: DeFi positions, staked assets, LP positions.`,
    inputSchema: z.object({ address: z.string(), chains: z.array(z.string()).default(['ethereum', 'solana']) }),
    execute: async ({ address, chains }: { address: string; chains: string[] }) => {
      const paymentReq: X402PaymentRequirement = {
        needsPayment: true, toolName: 'nansenPortfolio', apiUrl: NansenUtils.getPortfolioUrl(), method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: NansenUtils.formatPortfolioRequest({ address, chains }), estimatedCost: X402_CONSTANTS.NANSEN_ESTIMATED_COST
      };
      return handleX402OrReturnRequirement(x402Context, paymentReq);
    }
  });
}


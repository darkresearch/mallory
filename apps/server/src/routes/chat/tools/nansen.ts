import { tool } from 'ai';
import { z } from 'zod';
import { NansenUtils, X402_CONSTANTS, type X402PaymentRequirement } from '@darkresearch/mallory-shared';

export function createNansenTool() {
  return tool({
    description: `Get historical token balances for an Ethereum address from Nansen via Corbits proxy.
  
This is a premium data source that costs ~0.001 USDC per request.
Payment is handled automatically via x402 protocol.

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
      address: z.string().describe('Ethereum address or ENS name (e.g., "vitalik.eth")'),
      chain: z.string().default('ethereum').describe('Blockchain network (ethereum, polygon, etc.)'),
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


# Grid Client-Side Migration Plan

## Executive Summary

This document outlines the migration plan to move Mallory's Grid integration from a hybrid server-side/client-side implementation to a **fully client-side implementation**, ensuring that all Grid operations (account creation, authentication, balance fetching, and transaction signing) happen entirely on the client using the Grid SDK.

**Current State:** Mallory has a hybrid implementation where:
- ✅ Account creation/verification is client-side
- ✅ Transaction signing is client-side
- ❌ **Balance fetching is server-side** (needs migration)
- ❌ Server stores Grid wallet addresses in database

**Target State:** 
- ✅ All Grid operations happen client-side
- ✅ Server never touches Grid API directly
- ✅ Session secrets stay on device
- ✅ No Grid wallet data in server database (or minimal for display purposes only)

---

## Current Implementation Analysis

### What's Currently Client-Side ✅

1. **Grid Account Creation** (`apps/client/features/grid/services/gridClient.ts`)
   - Email-based account creation
   - Session secret generation (stored in secure storage)
   - OTP verification
   - Account data storage (secure storage)

2. **Transaction Signing** (`apps/client/features/grid/services/gridClient.ts`)
   - Sign and send transactions
   - Spending limit creation
   - Token transfers for ephemeral wallet funding

3. **x402 Payment Flow** (`apps/client/features/x402/`)
   - Ephemeral wallet creation
   - Funding from Grid wallet
   - x402 payment execution
   - Sweep back to Grid wallet

### What's Currently Server-Side ❌

1. **Balance Fetching** (`apps/server/src/routes/wallet/holdings.ts`)
   ```typescript
   // Server fetches from Grid API
   const gridUrl = `https://grid.squads.xyz/api/grid/v1/accounts/${walletAddress}/balances`;
   const gridResponse = await fetch(gridUrl, {
     headers: {
       'Authorization': `Bearer ${process.env.GRID_API_KEY}`,
       'x-grid-environment': process.env.GRID_ENV || 'production'
     }
   });
   ```

2. **Database Storage** (`users_grid` table)
   - `solana_wallet_address`
   - `grid_account_id`
   - `grid_account_status`

3. **Wallet Data Service** (`apps/client/features/wallet/services/data.ts`)
   - Client calls server endpoint `/api/wallet/holdings`
   - Server fetches from Grid API
   - Server enriches with Birdeye price data

---

## Migration Strategy

### Phase 1: Update Grid SDK Usage on Client

**Goal:** Use Grid SDK's `getAccountBalances()` method directly on the client instead of calling server endpoint.

#### Changes Required:

1. **Update `gridClient.ts`** to become the primary data source
   - Already has `getAccountBalances(address)` method ✅
   - Currently unused for wallet screen
   - Need to integrate with wallet data flow

2. **Update `walletDataService`** (`apps/client/features/wallet/services/data.ts`)
   - Replace server API call with direct Grid SDK call
   - Keep price enrichment logic (move to client or keep on server)
   - Update caching strategy

3. **Grid Account Address Management**
   - Grid account address is stored in secure storage: `grid_account`
   - No need to fetch from server database
   - Address available via `gridClientService.getAccount()`

#### Implementation Details:

```typescript
// NEW: Client-side balance fetching
class WalletDataService {
  private async fetchEnrichedHoldings(): Promise<WalletData> {
    // Step 1: Get Grid account from secure storage
    const gridAccount = await gridClientService.getAccount();
    if (!gridAccount) {
      throw new Error('No Grid wallet found');
    }

    // Step 2: Fetch balances using Grid SDK (client-side)
    const balanceResponse = await gridClientService.getAccountBalances(gridAccount.address);
    
    // Step 3: Enrich with price data
    // Option A: Call server endpoint for enrichment only
    // Option B: Call Birdeye API directly from client
    const enrichedData = await this.enrichWithPrices(balanceResponse.data);
    
    return enrichedData;
  }
}
```

### Phase 2: Handle Price Enrichment

**Decision Point:** Where should price enrichment happen?

#### Option A: Server-Side Enrichment (Recommended) ✅

**Pros:**
- Protects Birdeye API key
- Centralized rate limiting
- Consistent pricing logic
- Lower client bundle size

**Cons:**
- Still requires server call (but only for enrichment, not Grid data)

**Implementation:**
```typescript
// Client sends raw balance data to server for enrichment
POST /api/wallet/enrich-holdings
Body: { tokens: [{ address, amount, decimals }] }
Response: { tokens: [{ address, price, marketCap, volume }] }
```

#### Option B: Client-Side Enrichment

**Pros:**
- Truly serverless
- No backend dependency for wallet screen

**Cons:**
- Exposes Birdeye API key (requires public key or proxy)
- More complex client code
- Larger bundle size

**Recommendation:** Use Option A (server-side enrichment) to keep API keys secure while still fetching raw balance data from Grid SDK on client.

### Phase 3: Database Schema Updates

**Current `users_grid` table usage:**
- Server queries it to get `solana_wallet_address` for Grid API calls
- Stores Grid account metadata

**After Migration:**
- Grid address is stored client-side in secure storage
- Database can store address for **display purposes only** (non-critical)
- Server never uses it for Grid API calls

**Options:**

#### Option A: Keep Database Table (Minimal Changes)
- Keep `users_grid` table for audit/display
- Update it from client when account is created
- Server treats it as read-only metadata
- Never used for Grid API authentication

#### Option B: Remove Database Dependency
- Remove `users_grid` table
- All Grid data lives client-side only
- No server persistence of Grid addresses

**Recommendation:** Option A - Keep table for convenience but make it non-critical.

### Phase 4: Server Endpoint Changes

#### Remove or Deprecate:
1. **`GET /api/wallet/holdings`** - Currently fetches from Grid API
   - Remove Grid API call
   - Keep endpoint but repurpose for enrichment only

#### Create New Endpoints:
1. **`POST /api/wallet/enrich-holdings`** - Price enrichment service
   ```typescript
   // Input: Raw token balances from Grid SDK
   interface EnrichRequest {
     tokens: {
       tokenAddress: string;
       amount: string;
       decimals: number;
       symbol?: string;
       name?: string;
     }[];
   }
   
   // Output: Enriched with Birdeye market data
   interface EnrichResponse {
     tokens: {
       tokenAddress: string;
       price: number;
       priceChange24h: number;
       volume24h: number;
       marketCap: number;
       symbol: string;
       name: string;
       logoUrl?: string;
     }[];
   }
   ```

---

## Detailed Implementation Plan

### Step 1: Update Grid Client Service ✅ (Already Done)

The `gridClientService` already has the necessary methods:
- ✅ `createAccount(email)` - Create Grid account
- ✅ `verifyAccount(user, otpCode)` - Verify OTP
- ✅ `getAccount()` - Get stored Grid account
- ✅ `getAccountBalances(address)` - **Fetch balances from Grid SDK**
- ✅ `signAndSendTransaction()` - Sign transactions
- ✅ `sendTokens()` - Transfer tokens

### Step 2: Create Price Enrichment Endpoint

**File:** `apps/server/src/routes/wallet/enrich.ts` (NEW)

```typescript
import express from 'express';
import { authenticateUser, AuthenticatedRequest } from '../../middleware/auth.js';

const router = express.Router();

/**
 * Enrich token holdings with market data
 * POST /api/wallet/enrich-holdings
 */
router.post('/enrich-holdings', authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { tokens } = req.body;
    
    if (!tokens || !Array.isArray(tokens)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: tokens array required'
      });
    }

    // Extract token addresses
    const tokenAddresses = tokens.map(t => t.tokenAddress);

    // Fetch price data from Birdeye
    const [marketDataMap, metadataMap] = await Promise.all([
      fetchBirdeyeMarketData(tokenAddresses),
      fetchBirdeyeMetadata(tokenAddresses)
    ]);

    // Enrich tokens
    const enrichedTokens = tokens.map(token => {
      const marketData = marketDataMap.get(token.tokenAddress);
      const metadata = metadataMap.get(token.tokenAddress);
      
      return {
        tokenAddress: token.tokenAddress,
        price: marketData?.price || 0,
        marketCap: marketData?.market_cap || 0,
        symbol: metadata?.symbol || token.symbol || 'UNKNOWN',
        name: metadata?.name || token.name || 'Unknown Token',
        logoUrl: metadata?.logo_uri || ''
      };
    });

    res.json({
      success: true,
      tokens: enrichedTokens
    });

  } catch (error) {
    console.error('Price enrichment error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Enrichment failed'
    });
  }
});

export { router as enrichRouter };

// Re-use existing fetchBirdeyeMarketData and fetchBirdeyeMetadata functions
```

### Step 3: Update Wallet Data Service (Client)

**File:** `apps/client/features/wallet/services/data.ts`

```typescript
class WalletDataService {
  /**
   * Fetch balances from Grid SDK (client-side)
   * Then enrich with prices from server
   */
  private async fetchEnrichedHoldings(): Promise<WalletData> {
    const requestId = Math.random().toString(36).substring(2, 8);
    const startTime = Date.now();

    try {
      console.log('💰 [Mobile] fetchEnrichedHoldings() START (Grid SDK)', { requestId });

      // Step 1: Get Grid account from secure storage
      const gridAccount = await gridClientService.getAccount();
      if (!gridAccount) {
        throw new Error('No Grid wallet found. Please set up your wallet first.');
      }

      console.log('💰 [Mobile] Grid account found:', {
        address: gridAccount.address,
        requestId
      });

      // Step 2: Fetch balances from Grid SDK (CLIENT-SIDE)
      const balancesResponse = await gridClientService.getAccountBalances(gridAccount.address);
      
      if (!balancesResponse.success || !balancesResponse.data) {
        throw new Error('Failed to fetch balances from Grid SDK');
      }

      const tokens = balancesResponse.data.tokens || [];
      console.log('💰 [Mobile] Fetched', tokens.length, 'tokens from Grid SDK');

      // Step 3: Prepare tokens for enrichment
      const tokensToEnrich = tokens
        .filter(token => parseFloat(token.amount_decimal) > 0)
        .map(token => ({
          tokenAddress: token.token_address,
          amount: token.amount_decimal,
          decimals: token.decimals,
          symbol: token.symbol,
          name: token.name
        }));

      // Step 4: Enrich with prices (server call for API key protection)
      const authToken = await this.getAuthToken();
      if (!authToken) {
        throw new Error('No auth token available');
      }

      const enrichResponse = await fetch(`${this.baseUrl}/wallet/enrich-holdings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tokens: tokensToEnrich })
      });

      if (!enrichResponse.ok) {
        throw new Error('Failed to enrich token data');
      }

      const enrichData = await enrichResponse.json();
      
      // Step 5: Merge balance data with price data
      const enrichedHoldings: EnrichedToken[] = tokensToEnrich.map(token => {
        const enrichment = enrichData.tokens.find(
          (t: any) => t.tokenAddress === token.tokenAddress
        );
        
        return {
          tokenAddress: token.tokenAddress,
          tokenPfp: enrichment?.logoUrl || '',
          tokenName: enrichment?.name || token.name || 'Unknown',
          tokenSymbol: enrichment?.symbol || token.symbol || 'UNKNOWN',
          tokenPrice: enrichment?.price || 0,
          priceChange24h: 0,
          volume24h: 0,
          marketCap: enrichment?.marketCap || 0,
          holdings: parseFloat(token.amount),
          holdingsValue: (enrichment?.price || 0) * parseFloat(token.amount),
          decimals: token.decimals
        };
      });

      const totalBalance = enrichedHoldings.reduce((sum, h) => sum + h.holdingsValue, 0);

      const walletData: WalletData = {
        totalBalance,
        holdings: enrichedHoldings,
        smartAccountAddress: gridAccount.address,
        lastUpdated: new Date().toISOString()
      };

      const duration = Date.now() - startTime;
      console.log('💰 [Mobile] fetchEnrichedHoldings() SUCCESS (Grid SDK)', {
        requestId,
        totalValueUSD: totalBalance.toFixed(2),
        holdingsCount: enrichedHoldings.length,
        duration: `${duration}ms`
      });

      return walletData;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('💰 [Mobile] fetchEnrichedHoldings() ERROR', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`
      });
      throw error;
    }
  }
}
```

### Step 4: Update Server Holdings Endpoint

**File:** `apps/server/src/routes/wallet/holdings.ts`

**Option A: Deprecate Completely** (Recommended)
- Remove endpoint
- Update client to use new flow

**Option B: Repurpose for Legacy Support**
- Keep endpoint but add deprecation warning
- Eventually remove

### Step 5: Update Database Usage (Optional)

If keeping `users_grid` table:

**File:** `apps/client/contexts/AuthContext.tsx`

Update to sync Grid address to database (non-critical):

```typescript
// After Grid account verification
const syncGridAddress = async (address: string) => {
  try {
    const { error } = await supabase
      .from('users_grid')
      .upsert({
        id: user.id,
        solana_wallet_address: address,
        grid_account_id: gridAccount.id,
        grid_account_status: 'active',
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      console.warn('Failed to sync Grid address to database:', error);
      // Don't throw - this is non-critical
    }
  } catch (error) {
    console.warn('Database sync error:', error);
  }
};
```

---

## Testing Plan

### Unit Tests

1. **Grid Client Service**
   - ✅ Test `getAccountBalances()` with mocked Grid SDK
   - ✅ Test error handling for network failures
   - ✅ Test session secret retrieval

2. **Wallet Data Service**
   - ✅ Test new client-side balance fetching
   - ✅ Test price enrichment integration
   - ✅ Test caching behavior

### Integration Tests

1. **End-to-End Wallet Flow**
   - ✅ Create Grid account
   - ✅ Verify OTP
   - ✅ Fetch balances (client-side)
   - ✅ Enrich with prices
   - ✅ Display in wallet screen

2. **x402 Payment Flow**
   - ✅ Fund ephemeral wallet from Grid
   - ✅ Make x402 payment
   - ✅ Sweep back to Grid
   - ✅ Verify balance updates

### Manual Testing

1. **Wallet Screen**
   - ✅ Load wallet on first launch
   - ✅ Refresh wallet data
   - ✅ Verify correct balance display
   - ✅ Verify price updates

2. **Offline Behavior**
   - ✅ Test with no network
   - ✅ Verify cached data displays
   - ✅ Verify error messages

---

## Migration Checklist

### Phase 1: Preparation
- [x] Document current implementation
- [x] Create migration plan
- [ ] Review Grid SDK documentation
- [ ] Set up testing environment

### Phase 2: Server Changes
- [ ] Create `/api/wallet/enrich-holdings` endpoint
- [ ] Move Birdeye logic to enrichment endpoint
- [ ] Test enrichment endpoint
- [ ] Update server tests

### Phase 3: Client Changes
- [ ] Update `gridClient.ts` if needed (mostly done)
- [ ] Refactor `walletDataService.fetchEnrichedHoldings()`
- [ ] Remove server dependency for balance fetching
- [ ] Add enrichment API call
- [ ] Update caching logic
- [ ] Test wallet data flow

### Phase 4: Database (Optional)
- [ ] Decide on database strategy
- [ ] Update `users_grid` usage (if keeping)
- [ ] Add database sync logic (if needed)
- [ ] Update AuthContext

### Phase 5: Cleanup
- [ ] Remove/deprecate `/api/wallet/holdings` endpoint
- [ ] Remove Grid API calls from server
- [ ] Update environment variables (remove `GRID_API_KEY` from server)
- [ ] Update documentation
- [ ] Update README

### Phase 6: Testing
- [ ] Unit tests for new code
- [ ] Integration tests for wallet flow
- [ ] Manual testing on all platforms
- [ ] Load testing for enrichment endpoint
- [ ] Security review

### Phase 7: Deployment
- [ ] Deploy server changes
- [ ] Deploy client changes
- [ ] Monitor for errors
- [ ] Rollback plan ready

---

## Security Considerations

### ✅ What's Secure

1. **Session Secrets Never Leave Device**
   - Stored in secure storage only
   - Never sent to backend
   - Never logged

2. **Grid API Key on Client**
   - Public API key for SDK usage
   - Read-only operations
   - No transaction signing power

3. **Authentication**
   - Email + OTP for Grid account creation
   - Supabase JWT for server endpoints
   - Secure storage for sensitive data

### ⚠️ Potential Risks

1. **Birdeye API Key Exposure**
   - **Solution:** Keep price enrichment server-side
   - Alternative: Use Birdeye public endpoints (if available)

2. **Grid Address Visibility**
   - Addresses are public on blockchain anyway
   - No sensitive data exposed

3. **Client-Side Balance Fetching**
   - Grid SDK handles authentication
   - Session secrets required for signing (not for reads)
   - No additional risk vs server-side

---

## Performance Considerations

### Expected Improvements ✅

1. **Reduced Server Load**
   - No Grid API calls from server
   - Only price enrichment (lighter)

2. **Better Offline Support**
   - Can show last-known balances without server
   - Price enrichment fails gracefully

3. **Faster Wallet Loading**
   - Direct SDK call vs HTTP round-trip
   - Fewer network hops

### Potential Concerns ⚠️

1. **Client Bundle Size**
   - Grid SDK already included
   - No significant increase

2. **Client Network Usage**
   - One additional API call (enrichment)
   - Can batch enrichment requests

---

## Rollback Plan

If issues arise during migration:

1. **Immediate Rollback**
   - Revert client changes
   - Keep old server endpoint active
   - Toggle via feature flag

2. **Partial Rollback**
   - Keep Grid SDK usage
   - Fall back to server for enrichment
   - Gradual migration

3. **Feature Flag**
   ```typescript
   const USE_CLIENT_SIDE_GRID = config.featureFlags?.clientSideGrid ?? false;
   
   if (USE_CLIENT_SIDE_GRID) {
     // New implementation
   } else {
     // Legacy server-side
   }
   ```

---

## Timeline Estimate

- **Phase 1 (Preparation):** ✅ Complete
- **Phase 2 (Server Changes):** 2-3 hours
- **Phase 3 (Client Changes):** 3-4 hours
- **Phase 4 (Database):** 1-2 hours
- **Phase 5 (Cleanup):** 1 hour
- **Phase 6 (Testing):** 4-6 hours
- **Phase 7 (Deployment):** 1-2 hours

**Total Estimated Time:** 12-18 hours

---

## Success Criteria

✅ Migration is successful when:

1. **All Grid API calls happen client-side**
   - No Grid API calls from server
   - Balance fetching uses Grid SDK
   - Transaction signing uses Grid SDK

2. **Wallet screen works correctly**
   - Displays accurate balances
   - Shows correct prices
   - Updates on refresh

3. **x402 payments still work**
   - Ephemeral wallet funding
   - Payment execution
   - Sweep back to Grid

4. **No security regressions**
   - Session secrets stay secure
   - API keys not exposed
   - Authentication works

5. **Performance maintained or improved**
   - Wallet loads in < 2 seconds
   - No UI blocking
   - Graceful error handling

---

## Next Steps

1. **Review this plan** with team
2. **Set up testing environment** with Grid sandbox
3. **Start with Phase 2** (create enrichment endpoint)
4. **Implement Phase 3** (update client wallet service)
5. **Test thoroughly** before production deployment

---

## References

- [Grid SDK Documentation](https://developers.squads.so/grid/v1/sdk-reference/reference/v0.1.0/quickstart)
- Grid SDK NPM: `@sqds/grid@^0.1.0`
- Current Implementation: `apps/client/features/grid/services/gridClient.ts`
- Server Endpoint: `apps/server/src/routes/wallet/holdings.ts`

---

## Questions to Resolve

1. **Should we keep `users_grid` database table?**
   - Recommendation: Yes, for display/audit but not critical path

2. **Should price enrichment be client-side or server-side?**
   - Recommendation: Server-side to protect Birdeye API key

3. **Should we add feature flag for gradual rollout?**
   - Recommendation: Yes, for safety

4. **Should we maintain backward compatibility?**
   - Recommendation: Not necessary if we test thoroughly

5. **What's the rollback strategy?**
   - Recommendation: Keep old endpoint for 1 week, then remove

---

**Document Version:** 1.0  
**Created:** 2025-10-26  
**Author:** AI Assistant (Claude)  
**Status:** Ready for Review

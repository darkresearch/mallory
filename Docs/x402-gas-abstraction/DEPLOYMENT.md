# Gas Abstraction Deployment Guide

This guide covers deploying the x402 Gas Abstraction feature to staging and production environments.

## Prerequisites

- Access to staging and production environments
- Gateway URL for each environment
- Environment variables configured
- Feature flag control mechanism

## Environment Variables

### Backend (Server)

Required environment variables in `apps/server/.env`:

```bash
# Gas Abstraction Gateway Configuration
GAS_GATEWAY_URL=https://gateway.example.com
GAS_GATEWAY_NETWORK=solana-mainnet-beta
GAS_GATEWAY_USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# Solana RPC
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

### Client

Required environment variables in `apps/client/.env`:

```bash
# Gas Abstraction Feature Flags
EXPO_PUBLIC_GAS_ABSTRACTION_ENABLED=false
EXPO_PUBLIC_GAS_ABSTRACTION_DEFAULT_ENABLED=false
EXPO_PUBLIC_GAS_ABSTRACTION_LOW_BALANCE_THRESHOLD=0.1
EXPO_PUBLIC_GAS_ABSTRACTION_SUGGESTED_TOPUP=5.0
EXPO_PUBLIC_GAS_ABSTRACTION_MIN_TOPUP=0.5
EXPO_PUBLIC_GAS_ABSTRACTION_MAX_TOPUP=100.0
```

## Deployment Checklist

### Pre-Deployment

- [ ] Verify all tests pass (`bun test` in `apps/client`)
- [ ] Verify integration tests pass (`bun run test:e2e`)
- [ ] Review code changes and ensure no breaking changes
- [ ] Verify environment variables are set correctly
- [ ] Confirm gateway URL is accessible from deployment environment
- [ ] Test locally with staging gateway URL (if available)

### Staging Deployment (Task 19.3)

#### Step 1: Configure Staging Environment

1. **Set Backend Environment Variables**

   ```bash
   # In staging server environment
   GAS_GATEWAY_URL=https://staging-gateway.example.com
   GAS_GATEWAY_NETWORK=solana-mainnet-beta
   GAS_GATEWAY_USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
   ```

2. **Set Client Environment Variables**

   ```bash
   # In staging client build
   EXPO_PUBLIC_GAS_ABSTRACTION_ENABLED=false  # Start disabled
   EXPO_PUBLIC_GAS_ABSTRACTION_DEFAULT_ENABLED=false
   EXPO_PUBLIC_GAS_ABSTRACTION_LOW_BALANCE_THRESHOLD=0.1
   EXPO_PUBLIC_GAS_ABSTRACTION_SUGGESTED_TOPUP=5.0
   EXPO_PUBLIC_GAS_ABSTRACTION_MIN_TOPUP=0.5
   EXPO_PUBLIC_GAS_ABSTRACTION_MAX_TOPUP=100.0
   ```

#### Step 2: Deploy Backend

1. Deploy server code to staging environment
2. Verify server starts without errors
3. Check logs for: `✅ Gas Abstraction Service initialized`
4. If service fails to initialize, check:
   - Environment variables are set
   - Gateway URL is accessible
   - Network connectivity

#### Step 3: Deploy Client

1. Build and deploy client to staging
2. Verify app starts without errors
3. Confirm gas abstraction UI is hidden (feature flag disabled)

#### Step 4: Test with Staging Grid Accounts

1. **Test Balance Check**
   - Enable feature flag for test account
   - Open Gas Credits screen
   - Verify balance loads correctly
   - Check transaction history displays

2. **Test Top-Up Flow**
   - Initiate top-up
   - Verify payment requirements are fetched
   - Complete USDC transfer
   - Verify balance updates
   - Check top-up appears in history

3. **Test Transaction Sponsorship**
   - Enable gasless mode
   - Send a transaction
   - Verify sponsorship succeeds
   - Check balance deduction
   - Verify transaction confirms on Solana

4. **Test Error Handling**
   - Test with insufficient balance
   - Test with expired blockhash (automatic retry)
   - Test with gateway unavailable (503)
   - Verify graceful degradation to SOL

5. **Test Edge Cases**
   - Test failed transaction refund
   - Test low balance warning
   - Test balance staleness (10-second cache)
   - Test automatic balance refresh

#### Step 5: Monitor Telemetry

Monitor telemetry events in staging:

- `gas_balance_fetch_success`
- `gas_balance_fetch_error`
- `gas_topup_start`
- `gas_topup_success`
- `gas_topup_failure`
- `gas_sponsor_start`
- `gas_sponsor_success`
- `gas_sponsor_insufficient_balance`
- `gas_sponsor_error`
- `gas_sponsor_fallback_to_sol`

Check for:
- Error rates
- Response times
- Unusual patterns

#### Step 6: Enable for Beta Users

Once staging tests pass:

1. Enable feature flag for 10% of staging users
2. Monitor error rates and user feedback
3. Gradually increase to 50%, then 100% if stable

### Production Deployment (Task 19.4)

#### Step 1: Configure Production Environment

1. **Set Backend Environment Variables**

   ```bash
   # In production server environment
   GAS_GATEWAY_URL=https://gateway.example.com  # Production gateway
   GAS_GATEWAY_NETWORK=solana-mainnet-beta
   GAS_GATEWAY_USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
   ```

2. **Set Client Environment Variables**

   ```bash
   # In production client build
   EXPO_PUBLIC_GAS_ABSTRACTION_ENABLED=false  # Start disabled
   EXPO_PUBLIC_GAS_ABSTRACTION_DEFAULT_ENABLED=false
   EXPO_PUBLIC_GAS_ABSTRACTION_LOW_BALANCE_THRESHOLD=0.1
   EXPO_PUBLIC_GAS_ABSTRACTION_SUGGESTED_TOPUP=5.0
   EXPO_PUBLIC_GAS_ABSTRACTION_MIN_TOPUP=0.5
   EXPO_PUBLIC_GAS_ABSTRACTION_MAX_TOPUP=100.0
   ```

#### Step 2: Deploy Backend

1. Deploy server code to production
2. Verify server starts without errors
3. Check logs for: `✅ Gas Abstraction Service initialized`
4. Monitor error rates closely

#### Step 3: Deploy Client

1. Build and deploy client to production
2. Verify app starts without errors
3. Confirm gas abstraction UI is hidden (feature flag disabled)

#### Step 4: Gradual Rollout

**Phase 1: Internal Testing (Week 1)**
- Enable for internal team members
- Monitor closely for issues
- Test all flows end-to-end

**Phase 2: Beta Users (Week 2)**
- Enable for 10% of users
- Monitor:
  - Error rates
  - Transaction success rates
  - User feedback
  - Telemetry events

**Phase 3: Expanded Beta (Week 3)**
- If stable, increase to 25% of users
- Continue monitoring

**Phase 4: Full Rollout (Week 4)**
- If stable, enable for 50% of users
- Monitor for 1-2 days
- If stable, enable for 100% of users

#### Step 5: Monitor Production Metrics

Key metrics to monitor:

1. **Error Rates**
   - Balance fetch errors
   - Top-up failures
   - Sponsorship failures
   - Gateway errors (503)

2. **Performance**
   - Balance fetch latency
   - Top-up completion time
   - Sponsorship latency
   - Transaction confirmation time

3. **Usage**
   - Number of users with gasless mode enabled
   - Top-up frequency
   - Average top-up amount
   - Transaction sponsorship rate

4. **Financial**
   - Total USDC credits added
   - Total USDC debited
   - Average transaction cost
   - Refund rate

#### Step 6: Rollback Plan

If issues are detected:

1. **Immediate**: Disable feature flag (`EXPO_PUBLIC_GAS_ABSTRACTION_ENABLED=false`)
2. **Client Update**: Deploy new build with feature disabled
3. **Investigate**: Review logs and telemetry
4. **Fix**: Address issues in staging
5. **Re-test**: Verify fixes in staging
6. **Re-deploy**: Follow rollout plan again

## Feature Flag Management

### Enabling/Disabling Feature

**Client-side (requires app update):**
```bash
EXPO_PUBLIC_GAS_ABSTRACTION_ENABLED=true  # or false
```

**Server-side (no restart required if using dynamic config):**
- Feature is always available server-side
- Client feature flag controls UI visibility

### Gradual Rollout

For gradual rollout, you can:

1. **User-based**: Enable for specific user IDs
2. **Percentage-based**: Enable for X% of users
3. **Region-based**: Enable for specific regions
4. **Version-based**: Enable for specific app versions

Implementation depends on your feature flag system.

## Monitoring and Alerts

### Recommended Alerts

1. **High Error Rate**
   - Alert if error rate > 5% for any endpoint
   - Alert if 503 errors > 1% of requests

2. **Service Unavailable**
   - Alert if gateway returns 503 for > 1 minute
   - Alert if balance fetch fails for > 5% of requests

3. **Transaction Failures**
   - Alert if sponsorship failure rate > 10%
   - Alert if top-up failure rate > 5%

4. **Performance Degradation**
   - Alert if average response time > 5 seconds
   - Alert if p95 latency > 10 seconds

### Logging

All operations are logged with telemetry events. Monitor:

- Server logs for initialization errors
- Client logs for user-facing errors
- Telemetry events for usage patterns

## Post-Deployment

### Week 1

- [ ] Monitor error rates daily
- [ ] Review user feedback
- [ ] Check transaction success rates
- [ ] Verify refunds are working correctly

### Week 2-4

- [ ] Continue monitoring
- [ ] Gather user feedback
- [ ] Optimize based on usage patterns
- [ ] Document any issues or improvements

### Ongoing

- [ ] Monitor telemetry events
- [ ] Review error logs weekly
- [ ] Update documentation as needed
- [ ] Plan improvements based on usage

## Troubleshooting

### Service Not Initializing

**Symptoms**: Server logs show `⚠️ Gas Abstraction Service not initialized`

**Causes**:
- Missing environment variables
- Invalid gateway URL
- Network connectivity issues

**Solutions**:
1. Verify all environment variables are set
2. Test gateway URL accessibility
3. Check network connectivity
4. Review server logs for specific error

### High Error Rates

**Symptoms**: High percentage of failed requests

**Causes**:
- Gateway service issues
- Network problems
- Invalid configuration
- Authentication failures

**Solutions**:
1. Check gateway status
2. Verify network connectivity
3. Review error logs for patterns
4. Check authentication configuration

### Balance Not Updating

**Symptoms**: Balance doesn't refresh after top-up

**Causes**:
- Gateway delay
- Cache issues
- Network problems

**Solutions**:
1. Wait 1-2 minutes for settlement
2. Manually refresh balance
3. Check transaction on Solana explorer
4. Verify top-up was successful

## Support

For deployment issues:

- 📧 Email: hello@darkresearch.ai
- 🐛 Issues: [GitHub Issues](https://github.com/darkresearch/mallory/issues)
- 📚 Docs: See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) and [USER_GUIDE.md](./USER_GUIDE.md)


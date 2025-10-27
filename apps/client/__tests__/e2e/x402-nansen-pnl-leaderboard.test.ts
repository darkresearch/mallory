/**
 * Nansen PnL Leaderboard X402 Test
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setupNansenTest, testNansenEndpoint } from '../utils/nansen-test-template';

describe('X402 Nansen PnL Leaderboard', () => {
  let context: Awaited<ReturnType<typeof setupNansenTest>>;

  beforeAll(async () => {
    context = await setupNansenTest();
  });

  test('Should fetch PnL leaderboard via X402', async () => {
    const testTokenAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
    
    const data = await testNansenEndpoint({
      name: 'PnL Leaderboard',
      query: `Who are the top traders of token ${testTokenAddress}?`,
      expectedToolName: 'nansenPnlLeaderboard',
      urlFragment: 'pnl-leaderboard'
    }, context);

    expect(data).toBeDefined();
    console.log('✅ Test passed\n');
  }, 120000);
});


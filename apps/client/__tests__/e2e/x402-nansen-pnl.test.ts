/**
 * Nansen PnL Full History X402 Test
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setupNansenTest, testNansenEndpoint } from '../utils/nansen-test-template';

describe('X402 Nansen PnL', () => {
  let context: Awaited<ReturnType<typeof setupNansenTest>>;

  beforeAll(async () => {
    context = await setupNansenTest();
  });

  test('Should fetch full PnL history via X402', async () => {
    const data = await testNansenEndpoint({
      name: 'PnL Full History',
      query: 'Show me all past trades and PnL for vitalik.eth',
      expectedToolName: 'nansenPnl',
      urlFragment: 'profiler/address/pnl'
    }, context);

    expect(data).toBeDefined();
    console.log('✅ Test passed\n');
  }, 120000); // Test timeout: 2 minutes

});




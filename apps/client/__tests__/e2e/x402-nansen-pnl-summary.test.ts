/**
 * Nansen PnL Summary X402 Test
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setupNansenTest, testNansenEndpoint } from '../utils/nansen-test-template';

describe('X402 Nansen PnL Summary', () => {
  let context: Awaited<ReturnType<typeof setupNansenTest>>;

  beforeAll(async () => {
    context = await setupNansenTest();
  });

  test('Should fetch PnL summary via X402', async () => {
    const data = await testNansenEndpoint({
      name: 'PnL Summary',
      query: 'What is the trading profit/loss summary for vitalik.eth?',
      expectedToolName: 'nansenPnlSummary',
      urlFragment: 'pnl-summary'
    }, context);

    expect(data).toBeDefined();
    console.log('✅ Test passed\n');
  }, 120000); // Test timeout: 2 minutes

  test('Should handle Solana address PnL request', async () => {
    const data = await testNansenEndpoint({
      name: 'PnL Summary - Solana Address',
      query: 'What is the PnL for AWgfUQi2Z4HFbn7FtcqBc7UjZAF9H7HqYwnYBJbFbZ1p?',
      expectedToolName: 'nansenPnlSummary',
      urlFragment: 'pnl-summary'
    }, context);

    expect(data).toBeDefined();
    console.log('✅ Test passed\n');
  }, 120000);

});




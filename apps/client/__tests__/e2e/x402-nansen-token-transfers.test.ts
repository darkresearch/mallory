/**
 * Nansen Token Transfers X402 Test
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setupNansenTest, testNansenEndpoint } from '../utils/nansen-test-template';

describe('X402 Nansen Token Transfers', () => {
  let context: Awaited<ReturnType<typeof setupNansenTest>>;

  beforeAll(async () => {
    context = await setupNansenTest();
  });

  test('Should fetch token transfers via X402', async () => {
    const testTokenAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
    
    const data = await testNansenEndpoint({
      name: 'Token Transfers',
      query: `Show me large transfers of token ${testTokenAddress}`,
      expectedToolName: 'nansenTokenTransfers',
      urlFragment: 'transfers'
    }, context);

    expect(data).toBeDefined();
    console.log('✅ Test passed\n');
  }, 120000);
});


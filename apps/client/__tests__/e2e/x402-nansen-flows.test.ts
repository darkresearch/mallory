/**
 * Nansen Token Flows X402 Test
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setupNansenTest, testNansenEndpoint } from '../utils/nansen-test-template';

describe('X402 Nansen Flows', () => {
  let context: Awaited<ReturnType<typeof setupNansenTest>>;

  beforeAll(async () => {
    context = await setupNansenTest();
  });

  test('Should fetch token flows via X402', async () => {
    const testTokenAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
    
    const data = await testNansenEndpoint({
      name: 'Token Flows',
      query: `What are the inflows and outflows for token ${testTokenAddress}?`,
      expectedToolName: 'nansenFlows',
      urlFragment: 'tgm/flows'
    }, context);

    expect(data).toBeDefined();
    console.log('✅ Test passed\n');
  }, 120000);
});


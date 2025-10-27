/**
 * Nansen Flow Intelligence X402 Test
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setupNansenTest, testNansenEndpoint } from '../utils/nansen-test-template';

describe('X402 Nansen Flow Intelligence', () => {
  let context: Awaited<ReturnType<typeof setupNansenTest>>;

  beforeAll(async () => {
    context = await setupNansenTest();
  });

  test('Should fetch flow intelligence via X402', async () => {
    const testTokenAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
    
    const data = await testNansenEndpoint({
      name: 'Flow Intelligence',
      query: `What is the flow intelligence for token ${testTokenAddress}?`,
      expectedToolName: 'nansenFlowIntelligence',
      urlFragment: 'flow-intelligence'
    }, context);

    expect(data).toBeDefined();
    console.log('✅ Test passed\n');
  }, 120000);
});


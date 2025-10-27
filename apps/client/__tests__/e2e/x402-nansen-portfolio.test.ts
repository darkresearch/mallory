/**
 * Nansen DeFi Portfolio X402 Test
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setupNansenTest, testNansenEndpoint } from '../utils/nansen-test-template';

describe('X402 Nansen Portfolio', () => {
  let context: Awaited<ReturnType<typeof setupNansenTest>>;

  beforeAll(async () => {
    context = await setupNansenTest();
  });

  test('Should fetch DeFi portfolio holdings via X402', async () => {
    const data = await testNansenEndpoint({
      name: 'DeFi Portfolio',
      query: 'What are the DeFi holdings for vitalik.eth?',
      expectedToolName: 'nansenPortfolio',
      urlFragment: 'defi-holdings'
    }, context);

    expect(data).toBeDefined();
    console.log('✅ Test passed\n');
  }, 120000); // Test timeout: 2 minutes

});




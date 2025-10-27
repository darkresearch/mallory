/**
 * Nansen Who Bought/Sold X402 Test
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setupNansenTest, testNansenEndpoint } from '../utils/nansen-test-template';

describe('X402 Nansen Who Bought/Sold', () => {
  let context: Awaited<ReturnType<typeof setupNansenTest>>;

  beforeAll(async () => {
    context = await setupNansenTest();
  });

  test('Should fetch who bought/sold token via X402', async () => {
    const testTokenAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
    
    const data = await testNansenEndpoint({
      name: 'Who Bought/Sold',
      query: `Who recently bought or sold token ${testTokenAddress}?`,
      expectedToolName: 'nansenWhoBoughtSold',
      urlFragment: 'who-bought-sold'
    }, context);

    expect(data).toBeDefined();
    console.log('✅ Test passed\n');
  }, 120000);
});


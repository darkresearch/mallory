/**
 * Nansen Token Screener X402 Test
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setupNansenTest, testNansenEndpoint } from '../utils/nansen-test-template';

describe('X402 Nansen Token Screener', () => {
  let context: Awaited<ReturnType<typeof setupNansenTest>>;

  beforeAll(async () => {
    context = await setupNansenTest();
  });

  test('Should fetch token screener data via X402', async () => {
    const data = await testNansenEndpoint({
      name: 'Token Screener',
      query: 'Screen tokens on Ethereum with Nansen analytics',
      expectedToolName: 'nansenTokenScreener',
      urlFragment: 'token-screener'
    }, context);

    expect(data).toBeDefined();
    console.log('✅ Test passed\n');
  }, 120000); // Test timeout: 2 minutes

});



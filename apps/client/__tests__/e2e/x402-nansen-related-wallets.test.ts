/**
 * Nansen Related Wallets X402 Test
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setupNansenTest, testNansenEndpoint } from '../utils/nansen-test-template';

describe('X402 Nansen Related Wallets', () => {
  let context: Awaited<ReturnType<typeof setupNansenTest>>;

  beforeAll(async () => {
    context = await setupNansenTest();
  });

  test('Should fetch related wallets via X402', async () => {
    const data = await testNansenEndpoint({
      name: 'Related Wallets',
      query: 'Show me wallets related to vitalik.eth',
      expectedToolName: 'nansenRelatedWallets',
      urlFragment: 'related-wallets'
    }, context);

    expect(data).toBeDefined();
    console.log('✅ Test passed\n');
  }, 120000); // Test timeout: 2 minutes

});



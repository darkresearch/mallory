/**
 * Nansen Smart Money Jupiter DCAs X402 Test
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setupNansenTest, testNansenEndpoint } from '../utils/nansen-test-template';

describe('X402 Nansen Smart Money Jupiter DCAs', () => {
  let context: Awaited<ReturnType<typeof setupNansenTest>>;

  beforeAll(async () => {
    context = await setupNansenTest();
  });

  test('Should fetch smart money Jupiter DCA data via X402', async () => {
    const data = await testNansenEndpoint({
      name: 'Smart Money Jupiter DCAs',
      query: 'Show me Jupiter DCA orders by smart money on Solana',
      expectedToolName: 'nansenSmartMoneyJupiterDcas',
      urlFragment: 'smart-money/dcas'
    }, context);

    expect(data).toBeDefined();
    console.log('✅ Test passed\n');
  }, 120000); // Test timeout: 2 minutes

});




/**
 * Nansen Token Jupiter DCAs X402 Test
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setupNansenTest, testNansenEndpoint } from '../utils/nansen-test-template';

describe('X402 Nansen Token Jupiter DCAs', () => {
  let context: Awaited<ReturnType<typeof setupNansenTest>>;

  beforeAll(async () => {
    context = await setupNansenTest();
  });

  test('Should fetch token Jupiter DCA orders via X402', async () => {
    const data = await testNansenEndpoint({
      name: 'Token Jupiter DCAs',
      query: 'Show me Jupiter DCA orders for SOL token on Solana',
      expectedToolName: 'nansenTokenJupiterDcas',
      urlFragment: 'jupiter-dcas'
    }, context);

    expect(data).toBeDefined();
    console.log('✅ Test passed\n');
  }, 120000); // Test timeout: 2 minutes

});




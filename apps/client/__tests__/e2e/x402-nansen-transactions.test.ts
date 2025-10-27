/**
 * Nansen Transactions X402 Test
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setupNansenTest, testNansenEndpoint } from '../utils/nansen-test-template';

describe('X402 Nansen Transactions', () => {
  let context: Awaited<ReturnType<typeof setupNansenTest>>;

  beforeAll(async () => {
    context = await setupNansenTest();
  });

  test('Should fetch transaction history via X402', async () => {
    const data = await testNansenEndpoint({
      name: 'Transactions',
      query: 'Show me transaction history for 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      expectedToolName: 'nansenTransactions',
      urlFragment: 'transactions'
    }, context);

    expect(data).toBeDefined();
    console.log('✅ Test passed\n');
  }, 120000); // Test timeout: 2 minutes

});




/**
 * Nansen Counterparties X402 Test
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setupNansenTest, testNansenEndpoint } from '../utils/nansen-test-template';

describe('X402 Nansen Counterparties', () => {
  let context: Awaited<ReturnType<typeof setupNansenTest>>;

  beforeAll(async () => {
    context = await setupNansenTest();
  });

  test('Should fetch wallet counterparties via X402', async () => {
    const data = await testNansenEndpoint({
      name: 'Counterparties',
      query: 'Who does vitalik.eth interact with most?',
      expectedToolName: 'nansenCounterparties',
      urlFragment: 'counterparties'
    }, context);

    expect(data).toBeDefined();
    console.log('✅ Test passed\n');
  }, 120000); // Test timeout: 2 minutes

});



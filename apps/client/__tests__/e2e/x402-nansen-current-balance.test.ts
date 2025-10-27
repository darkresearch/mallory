/**
 * Nansen Current Balance X402 Test
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setupNansenTest, testNansenEndpoint } from '../utils/nansen-test-template';

describe('X402 Nansen Current Balance', () => {
  let context: Awaited<ReturnType<typeof setupNansenTest>>;

  beforeAll(async () => {
    context = await setupNansenTest();
  });

  test('Should fetch current token balances via X402', async () => {
    const data = await testNansenEndpoint({
      name: 'Current Balance',
      query: 'What are the current token balances for vitalik.eth?',
      expectedToolName: 'nansenCurrentBalance',
      urlFragment: 'current-balance',
      timeout: 120000
    }, context);

    expect(data).toBeDefined();
    console.log('✅ Test passed\n');
  }, 120000);
});


/**
 * Nansen Address Labels X402 Test
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setupNansenTest, testNansenEndpoint } from '../utils/nansen-test-template';

describe('X402 Nansen Labels', () => {
  let context: Awaited<ReturnType<typeof setupNansenTest>>;

  beforeAll(async () => {
    context = await setupNansenTest();
  });

  test('Should fetch address labels via X402', async () => {
    const data = await testNansenEndpoint({
      name: 'Address Labels',
      query: 'What labels does vitalik.eth have?',
      expectedToolName: 'nansenLabels',
      urlFragment: 'labels'
    }, context);

    expect(data).toBeDefined();
    console.log('✅ Test passed\n');
  }, 120000); // Test timeout: 2 minutes

});



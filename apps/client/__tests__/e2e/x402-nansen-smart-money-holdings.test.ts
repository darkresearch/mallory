/**
 * TRUE End-to-End Test: Complete X402 Nansen Smart Money Holdings Payment Flow
 * 
 * Tests the COMPLETE production flow:
 * 1. User asks AI about smart money holdings
 * 2. AI calls nansenSmartMoneyHoldings tool
 * 3. Tool returns needsPayment: true
 * 4. Test executes REAL X402 payment to REAL Nansen API via Corbits
 * 5. Gets REAL data back from Nansen
 * 6. Sends data to AI as system message
 * 7. AI continues and responds with the holdings information
 * 8. Validates AI actually used the data
 * 
 * THIS FOLLOWS THE SAME PATTERN AS THE OTHER NANSEN TESTS
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setupNansenTest, testNansenEndpoint } from '../utils/nansen-test-template';

describe('X402 Nansen Smart Money Holdings', () => {
  let context: Awaited<ReturnType<typeof setupNansenTest>>;

  beforeAll(async () => {
    context = await setupNansenTest();
  });

  test('Should fetch smart money holdings via X402', async () => {
    const data = await testNansenEndpoint({
      name: 'Smart Money Holdings',
      query: 'What tokens are smart money holding on Solana?',
      expectedToolName: 'nansenSmartMoneyHoldings',
      urlFragment: 'smart-money/holdings',
      timeout: 120000
    }, context);

    expect(data).toBeDefined();
    console.log('✅ Test passed\n');
  }, 120000);
});


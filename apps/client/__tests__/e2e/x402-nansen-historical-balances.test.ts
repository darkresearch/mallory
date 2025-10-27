/**
 * Nansen Historical Balances X402 Test
 * 
 * Tests the complete X402 payment flow for historical balances endpoint:
 * 1. User asks AI about vitalik.eth historical balances
 * 2. AI calls nansenHistoricalBalances tool
 * 3. Tool returns needsPayment: true
 * 4. Test executes REAL X402 payment to REAL Nansen API via Corbits
 * 5. Gets REAL data back from Nansen
 * 6. Sends data to AI as system message
 * 7. AI continues and responds with the balance information
 * 8. Validates AI actually used the data
 * 
 * THIS IS THE TEST YOU ORIGINALLY WANTED - THE REAL PRODUCTION FLOW
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setupNansenTest, testNansenEndpoint } from '../utils/nansen-test-template';

describe('X402 Nansen Historical Balances', () => {
  let context: Awaited<ReturnType<typeof setupNansenTest>>;

  beforeAll(async () => {
    context = await setupNansenTest();
  });

  test('Should fetch historical balances via X402', async () => {
    const data = await testNansenEndpoint({
      name: 'Historical Balances',
      query: 'What were the token holdings for vitalik.eth yesterday?',
      expectedToolName: 'nansenHistoricalBalances',
      urlFragment: 'historical-balances',
      timeout: 120000
    }, context);

    expect(data).toBeDefined();
    console.log('✅ Test passed\n');
  }, 120000);
});


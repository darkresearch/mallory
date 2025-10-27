/**
 * TRUE End-to-End Test: Complete X402 Nansen Smart Money DEX Trades Payment Flow
 * 
 * Tests the COMPLETE production flow:
 * 1. User asks AI about smart money DEX trades
 * 2. AI calls nansenSmartMoneyDexTrades tool
 * 3. Tool returns needsPayment: true
 * 4. Test executes REAL X402 payment to REAL Nansen API via Corbits
 * 5. Gets REAL data back from Nansen
 * 6. Sends data to AI as system message
 * 7. AI continues and responds with the trades information
 * 8. Validates AI actually used the data
 * 
 * THIS FOLLOWS THE SAME PATTERN AS THE OTHER NANSEN TESTS
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setupNansenTest, testNansenEndpoint } from '../utils/nansen-test-template';

describe('X402 Nansen Smart Money DEX Trades', () => {
  let context: Awaited<ReturnType<typeof setupNansenTest>>;

  beforeAll(async () => {
    context = await setupNansenTest();
  });

  test('Should fetch smart money DEX trades via X402', async () => {
    const data = await testNansenEndpoint({
      name: 'Smart Money DEX Trades',
      query: 'What DEX trades are smart money making on Solana?',
      expectedToolName: 'nansenSmartMoneyDexTrades',
      urlFragment: 'smart-money/dex-trades',
      timeout: 120000
    }, context);

    expect(data).toBeDefined();
    console.log('✅ Test passed\n');
  }, 120000);
});


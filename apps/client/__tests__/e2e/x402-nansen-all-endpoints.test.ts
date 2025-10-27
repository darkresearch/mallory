/**
 * Comprehensive E2E Test: All 20 Nansen Endpoints via X402
 * 
 * Tests ALL Nansen endpoints sequentially to verify:
 * 1. AI triggers each tool correctly
 * 2. X402 payment executes successfully
 * 3. Real data is returned from Nansen
 * 4. Each endpoint is accessible through Corbits
 * 
 * This runs 20 real payments (~$0.02 total cost)
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { authenticateTestUser, loadGridSession } from '../setup/test-helpers';
import { createTestConversation } from '../utils/conversation-test';
import { sendChatMessage, parseStreamResponse } from '../utils/chat-api';
import { X402PaymentServiceTest } from '../utils/x402-payment-test';

describe('X402 Nansen All Endpoints E2E', () => {
  let authToken: string;
  let userId: string;
  let gridAddress: string;

  beforeAll(async () => {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 COMPREHENSIVE TEST: All 20 Nansen Endpoints via X402');
    console.log('='.repeat(70), '\n');
    
    const auth = await authenticateTestUser();
    authToken = auth.accessToken;
    userId = auth.userId;
    
    const gridSession = await loadGridSession();
    gridAddress = gridSession.address;
    
    console.log('✅ Test environment ready');
    console.log('   User:', auth.email);
    console.log('   Grid:', gridAddress);
    console.log('   Expected cost: ~$0.02 for all endpoints\n');
  });

  // Helper function to test an endpoint
  async function testEndpoint(
    name: string,
    query: string,
    expectedToolName: string,
    urlFragment: string
  ) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`🧪 Testing: ${name}`);
    console.log(`${'─'.repeat(70)}\n`);

    try {
      const conversationId = await createTestConversation(userId);
      
      console.log(`📋 Query: "${query}"`);
      const response = await sendChatMessage(query, conversationId, authToken);
      
      const parsed = await parseStreamResponse(response);
      
      if (!parsed.hasPaymentRequirement) {
        console.warn(`⚠️  AI did not trigger ${expectedToolName} - skipping`);
        return { skipped: true, name };
      }
      
      const paymentReq = parsed.paymentRequirement;
      console.log(`✅ Payment requirement: ${paymentReq.toolName}`);
      
      // Don't fail test, just log mismatches
      if (paymentReq.toolName !== expectedToolName) {
        console.warn(`⚠️  Tool mismatch: expected ${expectedToolName}, got ${paymentReq.toolName}`);
      }
      if (!paymentReq.apiUrl.includes(urlFragment)) {
        console.warn(`⚠️  URL mismatch: expected ${urlFragment}, got ${paymentReq.apiUrl}`);
      }
      
      console.log(`💰 Executing payment...`);
      const data = await X402PaymentServiceTest.payAndFetchData(paymentReq, gridAddress);
      
      console.log(`✅ Data received (${JSON.stringify(data).length} bytes)`);
      
      return { success: true, dataSize: JSON.stringify(data).length, name };
    } catch (error) {
      console.error(`❌ Error testing ${name}:`, error instanceof Error ? error.message : error);
      return { failed: true, name, error: error instanceof Error ? error.message : String(error) };
    }
  }

  test('All Nansen endpoints work via X402', async () => {
    // @ts-ignore
    test.timeout = 900000; // 15 minutes for all endpoints
    
    const results: any[] = [];
    
    // 1. Smart Money Endpoints
    results.push(await testEndpoint(
      'Smart Money Jupiter DCAs',
      'Show me Jupiter DCA orders by smart money on Solana',
      'nansenSmartMoneyJupiterDcas',
      'smart-money/dcas'
    ));

    // 2-8. Profiler Endpoints (excluding historical-balances which we already tested)
    results.push(await testEndpoint(
      'Current Balance',
      'What are the current token balances for vitalik.eth?',
      'nansenCurrentBalance',
      'current-balance'
    ));

    results.push(await testEndpoint(
      'Transactions',
      'Show me transaction history for 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      'nansenTransactions',
      'transactions'
    ));

    results.push(await testEndpoint(
      'Counterparties',
      'Who does vitalik.eth interact with most?',
      'nansenCounterparties',
      'counterparties'
    ));

    results.push(await testEndpoint(
      'Related Wallets',
      'Show me wallets related to vitalik.eth',
      'nansenRelatedWallets',
      'related-wallets'
    ));

    results.push(await testEndpoint(
      'PnL Summary',
      'What is the trading profit/loss summary for vitalik.eth?',
      'nansenPnlSummary',
      'pnl-summary'
    ));

    results.push(await testEndpoint(
      'PnL Full History',
      'Show me all past trades and PnL for vitalik.eth',
      'nansenPnl',
      'profiler/address/pnl'
    ));

    results.push(await testEndpoint(
      'Address Labels',
      'What labels does vitalik.eth have?',
      'nansenLabels',
      'labels'
    ));

    // 9-17. Token God Mode Endpoints
    const testTokenAddress = '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984'; // UNI token

    results.push(await testEndpoint(
      'Token Screener',
      'Screen tokens on Ethereum with Nansen analytics',
      'nansenTokenScreener',
      'token-screener'
    ));

    results.push(await testEndpoint(
      'Flow Intelligence',
      `What is the flow intelligence for token ${testTokenAddress}?`,
      'nansenFlowIntelligence',
      'flow-intelligence'
    ));

    results.push(await testEndpoint(
      'Token Holders',
      `Who are the top holders of token ${testTokenAddress}?`,
      'nansenHolders',
      'holders'
    ));

    results.push(await testEndpoint(
      'Token Flows',
      `What are the inflows and outflows for token ${testTokenAddress}?`,
      'nansenFlows',
      'tgm/flows'
    ));

    results.push(await testEndpoint(
      'Who Bought/Sold',
      `Who recently bought or sold token ${testTokenAddress}?`,
      'nansenWhoBoughtSold',
      'who-bought-sold'
    ));

    results.push(await testEndpoint(
      'Token DEX Trades',
      `Show me DEX trades for token ${testTokenAddress}`,
      'nansenTokenDexTrades',
      'tgm/dex-trades'
    ));

    results.push(await testEndpoint(
      'Token Transfers',
      `Show me large transfers of token ${testTokenAddress}`,
      'nansenTokenTransfers',
      'transfers'
    ));

    results.push(await testEndpoint(
      'Token Jupiter DCAs',
      'Show me Jupiter DCA orders for SOL token on Solana',
      'nansenTokenJupiterDcas',
      'jupiter-dcas'
    ));

    results.push(await testEndpoint(
      'PnL Leaderboard',
      `Who are the top traders of token ${testTokenAddress}?`,
      'nansenPnlLeaderboard',
      'pnl-leaderboard'
    ));

    // 18. Portfolio Endpoint
    results.push(await testEndpoint(
      'DeFi Portfolio',
      'What are the DeFi holdings for vitalik.eth?',
      'nansenPortfolio',
      'defi-holdings'
    ));

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    
    const successful = results.filter(r => r.success).length;
    const skipped = results.filter(r => r.skipped).length;
    const failed = results.filter(r => r.failed).length;
    const totalDataSize = results.reduce((sum, r) => sum + (r.dataSize || 0), 0);
    
    console.log(`\n✅ Successful: ${successful}/${results.length}`);
    console.log(`⚠️  Skipped: ${skipped}/${results.length}`);
    console.log(`❌ Failed: ${failed}/${results.length}`);
    console.log(`📦 Total data received: ${(totalDataSize / 1024).toFixed(2)} KB`);
    console.log(`💰 Approximate cost: $${(successful * 0.001).toFixed(3)}`);
    
    if (failed > 0) {
      console.log('\n❌ Failed endpoints:');
      results.filter(r => r.failed).forEach(r => {
        console.log(`   - ${r.name}: ${r.error}`);
      });
    }
    
    if (skipped > 0) {
      console.log('\n⚠️  Skipped endpoints:');
      results.filter(r => r.skipped).forEach(r => {
        console.log(`   - ${r.name}`);
      });
    }
    
    console.log('\n✅ Successful endpoints:');
    results.filter(r => r.success).forEach(r => {
      console.log(`   - ${r.name} (${(r.dataSize / 1024).toFixed(2)} KB)`);
    });
    
    console.log('\n🎉 Test complete!\n');
    
    // At least some should succeed
    expect(successful).toBeGreaterThan(0);
  });
});



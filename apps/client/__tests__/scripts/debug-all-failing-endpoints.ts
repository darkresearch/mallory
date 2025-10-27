/**
 * Debug all failing endpoints systematically
 */

import { X402PaymentServiceTest } from '../utils/x402-payment-test';
import { loadGridSession } from '../setup/test-helpers';
import { NansenUtils } from '@darkresearch/mallory-shared';

async function testEndpoint(name: string, url: string, body: any) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`🧪 ${name}`);
  console.log(`${'─'.repeat(70)}`);
  
  const gridSession = await loadGridSession();
  
  const paymentReq = {
    needsPayment: true as const,
    toolName: name,
    apiUrl: url,
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body,
    estimatedCost: { amount: '0.001', currency: 'USDC' }
  };
  
  try {
    const data = await X402PaymentServiceTest.payAndFetchData(paymentReq, gridSession.address);
    console.log(`✅ SUCCESS! (${JSON.stringify(data).length} bytes)`);
    return true;
  } catch (error) {
    console.log(`❌ FAILED: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 DEBUGGING ALL PREVIOUSLY FAILING ENDPOINTS');
  console.log('='.repeat(70));
  
  const testAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  const testToken = '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984'; // UNI
  const results: Record<string, boolean> = {};
  
  // Profiler Endpoints
  results['Current Balance'] = await testEndpoint(
    'Current Balance',
    NansenUtils.getCurrentBalanceUrl(),
    NansenUtils.formatCurrentBalanceRequest({ address: testAddress })
  );
  
  results['Transactions'] = await testEndpoint(
    'Transactions',
    NansenUtils.getTransactionsUrl(),
    NansenUtils.formatTransactionsRequest({ address: testAddress })
  );
  
  results['Counterparties'] = await testEndpoint(
    'Counterparties',
    NansenUtils.getCounterpartiesUrl(),
    NansenUtils.formatCounterpartiesRequest({ address: testAddress })
  );
  
  results['Related Wallets'] = await testEndpoint(
    'Related Wallets',
    NansenUtils.getRelatedWalletsUrl(),
    NansenUtils.formatRelatedWalletsRequest({ address: testAddress })
  );
  
  results['PnL Summary'] = await testEndpoint(
    'PnL Summary',
    NansenUtils.getPnlSummaryUrl(),
    NansenUtils.formatPnlSummaryRequest({ address: testAddress })
  );
  
  results['PnL'] = await testEndpoint(
    'PnL',
    NansenUtils.getPnlUrl(),
    NansenUtils.formatPnlRequest({ address: testAddress })
  );
  
  results['Labels'] = await testEndpoint(
    'Labels',
    NansenUtils.getLabelsUrl(),
    NansenUtils.formatLabelsRequest({ address: testAddress })
  );
  
  // Token God Mode
  results['Token Screener'] = await testEndpoint(
    'Token Screener',
    NansenUtils.getTokenScreenerUrl(),
    NansenUtils.formatTokenScreenerRequest({})
  );
  
  results['Token Jupiter DCAs'] = await testEndpoint(
    'Token Jupiter DCAs',
    NansenUtils.getTokenJupiterDcasUrl(),
    NansenUtils.formatTokenJupiterDcasRequest({ token_address: testToken })
  );
  
  // Portfolio
  results['Portfolio'] = await testEndpoint(
    'Portfolio',
    NansenUtils.getPortfolioUrl(),
    NansenUtils.formatPortfolioRequest({ address: testAddress })
  );
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESULTS SUMMARY');
  console.log('='.repeat(70));
  
  const passed = Object.values(results).filter(v => v).length;
  const total = Object.keys(results).length;
  
  console.log(`\n✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}\n`);
  
  Object.entries(results).forEach(([name, success]) => {
    console.log(success ? `✅ ${name}` : `❌ ${name}`);
  });
  
  console.log('\n' + '='.repeat(70));
}

main().catch(console.error);




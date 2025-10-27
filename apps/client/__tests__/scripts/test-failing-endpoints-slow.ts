/**
 * Test failing endpoints slowly to avoid rate limits
 */

import { X402PaymentServiceTest } from '../utils/x402-payment-test';
import { loadGridSession } from '../setup/test-helpers';
import { NansenUtils } from '@darkresearch/mallory-shared';

async function testEndpoint(name: string, url: string, body: any) {
  console.log(`\n🧪 Testing: ${name}`);
  
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
    return { success: true, size: JSON.stringify(data).length };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`❌ FAILED: ${msg.substring(0, 100)}`);
    return { success: false, error: msg };
  }
}

async function main() {
  const testAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  const testToken = '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984';
  
  const results: Record<string, any> = {};
  
  // Test them one by one with delays
  console.log('\n' + '='.repeat(70));
  console.log('Testing endpoints with 10s delays to avoid rate limits...');
  console.log('='.repeat(70));
  
  results['Current Balance'] = await testEndpoint(
    'Current Balance',
    NansenUtils.getCurrentBalanceUrl(),
    NansenUtils.formatCurrentBalanceRequest({ address: testAddress })
  );
  await new Promise(r => setTimeout(r, 10000));
  
  results['Portfolio'] = await testEndpoint(
    'Portfolio',
    NansenUtils.getPortfolioUrl(),
    NansenUtils.formatPortfolioRequest({ address: testAddress })
  );
  await new Promise(r => setTimeout(r, 10000));
  
  results['Token Screener'] = await testEndpoint(
    'Token Screener',
    NansenUtils.getTokenScreenerUrl(),
    NansenUtils.formatTokenScreenerRequest({})
  );
  await new Promise(r => setTimeout(r, 10000));
  
  results['Labels'] = await testEndpoint(
    'Labels',
    NansenUtils.getLabelsUrl(),
    NansenUtils.formatLabelsRequest({ address: testAddress })
  );
  await new Promise(r => setTimeout(r, 10000));
  
  results['Token Jupiter DCAs'] = await testEndpoint(
    'Token Jupiter DCAs',
    NansenUtils.getTokenJupiterDcasUrl(),
    NansenUtils.formatTokenJupiterDcasRequest({ token_address: 'So11111111111111111111111111111111111111112' }) // SOL token on Solana
  );
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESULTS');
  console.log('='.repeat(70));
  
  const passed = Object.values(results).filter((v: any) => v.success).length;
  console.log(`\n✅ Passed: ${passed}/5`);
  console.log(`❌ Failed: ${5 - passed}/5\n`);
  
  Object.entries(results).forEach(([name, result]: [string, any]) => {
    if (result.success) {
      console.log(`✅ ${name} (${result.size} bytes)`);
    } else {
      console.log(`❌ ${name}: ${result.error.substring(0, 80)}`);
    }
  });
}

main().catch(console.error);



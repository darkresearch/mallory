/**
 * Test Labels endpoint with different body structures
 */

import { X402PaymentServiceTest } from '../utils/x402-payment-test';
import { loadGridSession } from '../setup/test-helpers';

const NANSEN_BASE = 'https://nansen.api.corbits.dev';

async function testLabels(name: string, body: any) {
  console.log(`\n🧪 Testing: ${name}`);
  console.log('Body:', JSON.stringify(body, null, 2));
  
  const gridSession = await loadGridSession();
  
  const paymentReq = {
    needsPayment: true as const,
    toolName: 'nansenLabels',
    apiUrl: `${NANSEN_BASE}/api/beta/profiler/address/labels`,
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body,
    estimatedCost: { amount: '0.001', currency: 'USDC' }
  };
  
  try {
    const data = await X402PaymentServiceTest.payAndFetchData(paymentReq, gridSession.address);
    console.log('✅ SUCCESS!', JSON.stringify(data).length, 'bytes');
    return true;
  } catch (error) {
    console.log('❌ FAILED:', error instanceof Error ? error.message : error);
    return false;
  }
}

async function main() {
  const testAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  
  // Test 1: Simple format
  await testLabels('Simple (address only)', {
    address: testAddress
  });
  
  await new Promise(r => setTimeout(r, 10000));
  
  // Test 2: With parameters wrapper (beta format from docs)
  await testLabels('Beta format (parameters wrapper)', {
    parameters: {
      chain: 'ethereum',
      address: testAddress
    },
    pagination: {
      page: 1,
      recordsPerPage: 100
    }
  });
  
  await new Promise(r => setTimeout(r, 10000));
  
  // Test 3: With chain
  await testLabels('With chain field', {
    address: testAddress,
    chain: 'ethereum'
  });
}

main().catch(console.error);




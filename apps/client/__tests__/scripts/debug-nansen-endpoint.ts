/**
 * Debug script to test individual Nansen endpoints
 * Helps identify correct request body parameters
 */

import { X402PaymentServiceTest } from '../utils/x402-payment-test';
import { loadGridSession } from '../setup/test-helpers';
import { X402_CONSTANTS } from '@darkresearch/mallory-shared';

const NANSEN_BASE = 'https://nansen.api.corbits.dev';

async function testEndpoint(
  name: string,
  url: string,
  body: any
) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 Testing: ${name}`);
  console.log(`${'='.repeat(70)}`);
  console.log('URL:', url);
  console.log('Body:', JSON.stringify(body, null, 2));
  
  const gridSession = await loadGridSession();
  
  const paymentReq = {
    needsPayment: true as const,
    toolName: `debug-${name}`,
    apiUrl: url,
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body,
    estimatedCost: {
      amount: '0.001',
      currency: 'USDC'
    }
  };
  
  try {
    const data = await X402PaymentServiceTest.payAndFetchData(
      paymentReq,
      gridSession.address
    );
    
    console.log('✅ SUCCESS!');
    console.log('Data size:', JSON.stringify(data).length, 'bytes');
    console.log('Data preview:', JSON.stringify(data).substring(0, 200));
    return { success: true, data };
  } catch (error) {
    console.log('❌ FAILED:', error instanceof Error ? error.message : error);
    return { success: false, error };
  }
}

// Test the failing endpoints one by one
async function main() {
  const testAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // vitalik.eth
  
  // Test 1: Current Balance - try with "address"
  await testEndpoint(
    'Current Balance (address)',
    `${NANSEN_BASE}/api/v1/profiler/address/current-balance`,
    {
      address: testAddress,
      chain: 'ethereum'
    }
  );
  
  // Test 2: Current Balance - try with "wallet_address"  
  await testEndpoint(
    'Current Balance (wallet_address)',
    `${NANSEN_BASE}/api/v1/profiler/address/current-balance`,
    {
      wallet_address: testAddress,
      chain: 'ethereum'
    }
  );
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ Debug complete!');
}

main().catch(console.error);




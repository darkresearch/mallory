/**
 * Test Token Jupiter DCAs endpoint with METADAO token
 */

import { X402PaymentServiceTest } from '../utils/x402-payment-test';
import { loadGridSession } from '../setup/test-helpers';
import { NansenUtils } from '@darkresearch/mallory-shared';

async function main() {
  console.log('\n🧪 Testing Token Jupiter DCAs with METADAO token');
  console.log('Token: METAwkXcqyXKy1AtsSgJ8JiUHwGCafnZL38n3vYmeta\n');
  
  const gridSession = await loadGridSession();
  
  const paymentReq = {
    needsPayment: true as const,
    toolName: 'nansenTokenJupiterDcas',
    apiUrl: NansenUtils.getTokenJupiterDcasUrl(),
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: NansenUtils.formatTokenJupiterDcasRequest({ 
      token_address: 'METAwkXcqyXKy1AtsSgJ8JiUHwGCafnZL38n3vYmeta' 
    }),
    estimatedCost: { amount: '0.001', currency: 'USDC' }
  };
  
  console.log('Request body:', JSON.stringify(paymentReq.body, null, 2));
  console.log();
  
  try {
    const data = await X402PaymentServiceTest.payAndFetchData(paymentReq, gridSession.address);
    console.log('✅ SUCCESS!');
    console.log('Data size:', JSON.stringify(data).length, 'bytes');
    console.log('Data preview:', JSON.stringify(data).substring(0, 300));
  } catch (error) {
    console.log('❌ FAILED:', error instanceof Error ? error.message : error);
  }
}

main().catch(console.error);



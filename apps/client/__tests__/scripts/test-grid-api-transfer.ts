/**
 * Test: Grid API Direct Transfer
 * 
 * Tests if Grid's REST API supports direct transfers
 */

import { loadGridSession } from '../setup/test-helpers';

async function main() {
  console.log('🧪 Testing Grid REST API transfer...\n');

  try {
    const gridSession = await loadGridSession();
    // Note: Grid API key not needed - all operations should go through backend proxy
    const gridEnv = process.env.EXPO_PUBLIC_GRID_ENV;

    console.log('Grid Config:');
    console.log('  Address:', gridSession.address);
    console.log('  Environment:', gridEnv);
    console.log('  Note: Using backend proxy (Grid API key is server-side only)');
    console.log();

    // Try Grid API docs format for creating a transfer
    const transferData = {
      recipient: '7FtRZ4xcGX8Sno2TvENMz182yoLzExUbYgqmKFPqCSZD', // test address
      amount: 100000, // 0.1 USDC (6 decimals)
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    };

    console.log('Attempting to create transfer via Grid API...');
    console.log('Payload:', transferData);

    // Note: This script is for testing Grid API structure
    // In production, all Grid API calls go through backend proxy
    const apiKey = process.env.GRID_API_KEY || 'not-provided-client-side';
    const response = await fetch(
      `https://grid.squads.xyz/api/grid/v1/accounts/${gridSession.address}/transfers`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'x-grid-environment': gridEnv || 'production',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transferData),
      }
    );

    console.log('Response status:', response.status);
    const responseText = await response.text();
    console.log('Response:', responseText);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();


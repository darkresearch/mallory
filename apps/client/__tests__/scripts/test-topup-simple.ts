/**
 * Simple Top-Up Test - Direct API Test
 * 
 * Tests the top-up endpoint directly without full E2E setup.
 * Useful for debugging API issues.
 * 
 * Usage:
 *   bun run apps/client/__tests__/scripts/test-topup-simple.ts
 * 
 * Requires:
 *   - Backend server running
 *   - Valid auth token (set TEST_AUTH_TOKEN env var)
 *   - Grid session data (set TEST_GRID_SESSION and TEST_GRID_SESSION_SECRETS env vars)
 */

const BACKEND_URL = process.env.TEST_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_API_URL || 'http://localhost:3001';

async function testTopupSimple() {
  console.log('🧪 Simple Top-Up API Test\n');
  console.log('Backend URL:', BACKEND_URL);
  console.log('');

  // Check if backend is running
  try {
    const healthCheck = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(5000) });
    if (!healthCheck.ok) {
      throw new Error('Backend health check failed');
    }
    console.log('✅ Backend server is running\n');
  } catch (error) {
    console.error('❌ Backend server is not accessible');
    console.error('   Please start the backend server first');
    console.error('   Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  // Get auth token from env or prompt
  const authToken = process.env.TEST_AUTH_TOKEN;
  if (!authToken) {
    console.error('❌ TEST_AUTH_TOKEN not set');
    console.error('   Set it in your environment or .env file');
    process.exit(1);
  }

  // Test 1: Get requirements
  console.log('📝 Test 1: Getting top-up requirements...');
  try {
    const reqUrl = `${BACKEND_URL}/api/gas-abstraction/topup/requirements`;
    const reqResponse = await fetch(reqUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (!reqResponse.ok) {
      const errorData = await reqResponse.json().catch(() => ({}));
      console.error('❌ Failed:', reqResponse.status, errorData);
      throw new Error(`Failed to get requirements: ${reqResponse.status}`);
    }

    const requirements = await reqResponse.json();
    console.log('✅ Requirements received:');
    console.log('   Network:', requirements.network);
    console.log('   Asset:', requirements.asset);
    console.log('   Pay To:', requirements.payTo);
    console.log('   Max Amount:', requirements.maxAmountRequired / 1_000_000, 'USDC');
    console.log('');
  } catch (error) {
    console.error('❌ Test 1 failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  // Test 2: Check balance (if Grid session provided)
  const gridSessionJson = process.env.TEST_GRID_SESSION;
  const gridSessionSecretsJson = process.env.TEST_GRID_SESSION_SECRETS;
  
  if (gridSessionJson && gridSessionSecretsJson) {
    console.log('📝 Test 2: Checking balance...');
    try {
      const gridSession = JSON.parse(gridSessionJson);
      const gridSessionSecrets = JSON.parse(gridSessionSecretsJson);
      
      const balanceUrl = `${BACKEND_URL}/api/gas-abstraction/balance`;
      const balanceResponse = await fetch(balanceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          gridSessionSecrets,
          gridSession: {
            authentication: gridSession.authentication || gridSession,
            address: gridSession.address,
          },
        }),
      });

      if (!balanceResponse.ok) {
        const errorData = await balanceResponse.json().catch(() => ({}));
        console.error('❌ Failed:', balanceResponse.status, errorData);
        throw new Error(`Failed to get balance: ${balanceResponse.status}`);
      }

      const balance = await balanceResponse.json();
      console.log('✅ Balance received:');
      console.log('   Wallet:', balance.wallet);
      console.log('   Balance:', balance.balanceBaseUnits / 1_000_000, 'USDC');
      console.log('   Top-ups:', balance.topups?.length || 0);
      console.log('   Usages:', balance.usages?.length || 0);
      console.log('');
    } catch (error) {
      console.error('❌ Test 2 failed:', error instanceof Error ? error.message : String(error));
      console.error('   (This is non-critical, continuing...)');
      console.log('');
    }
  } else {
    console.log('⚠️  Test 2 skipped: TEST_GRID_SESSION and TEST_GRID_SESSION_SECRETS not set');
    console.log('');
  }

  console.log('✅ Basic API tests passed!');
  console.log('');
  console.log('To test the full top-up flow, you need:');
  console.log('  1. A signed USDC transfer transaction');
  console.log('  2. Grid session data');
  console.log('  3. Run the full E2E test: bun run apps/client/__tests__/scripts/test-topup-e2e.ts');
}

testTopupSimple().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


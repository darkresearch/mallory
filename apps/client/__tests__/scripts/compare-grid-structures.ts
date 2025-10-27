/**
 * Compare Grid Account Structures
 * 
 * Compares test account vs production account structure
 * to debug why tests work but production fails
 * 
 * Usage: cd apps/client/__tests__ && bun run scripts/compare-grid-structures.ts
 */

import '../setup/test-env';
import { loadGridSession } from '../setup/test-helpers';

async function compareStructures() {
  console.log('🔍 Comparing Grid Account Structures');
  console.log('=====================================\n');

  // Load test account
  console.log('📋 Loading TEST account...');
  const testGrid = await loadGridSession();
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ TEST ACCOUNT STRUCTURE (WORKING):');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Address:', testGrid.address);
  console.log('Has session secrets:', !!testGrid.sessionSecrets);
  console.log('Has authentication:', !!testGrid.authentication);
  console.log();
  console.log('Authentication type:', typeof testGrid.authentication);
  console.log('Authentication is array:', Array.isArray(testGrid.authentication));
  console.log('Authentication keys:', Object.keys(testGrid.authentication));
  console.log();
  console.log('Full authentication object:');
  console.log(JSON.stringify(testGrid.authentication, null, 2));
  console.log('═══════════════════════════════════════════════════════════');
  console.log();

  console.log('📋 PRODUCTION account structure:');
  console.log();
  console.log('To get production account structure:');
  console.log('1. Open browser console on your app');
  console.log('2. Run this code:');
  console.log();
  console.log('   const account = JSON.parse(await (await import("../lib/storage")).secureStorage.getItem("grid_account"));');
  console.log('   console.log("PRODUCTION ACCOUNT:", JSON.stringify({');
  console.log('     address: account.address,');
  console.log('     authType: typeof account.authentication,');
  console.log('     authIsArray: Array.isArray(account.authentication),');
  console.log('     authKeys: account.authentication ? Object.keys(account.authentication) : [],');
  console.log('     authValue: account.authentication');
  console.log('   }, null, 2));');
  console.log();
  console.log('3. Copy the output and compare with test account above');
  console.log();
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 KEY DIFFERENCES TO LOOK FOR:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('- Authentication type (object vs array)');
  console.log('- Authentication keys (should NOT be just ["0"])');
  console.log('- Required Grid SDK fields in authentication object');
  console.log('═══════════════════════════════════════════════════════════');
}

compareStructures().catch(console.error);


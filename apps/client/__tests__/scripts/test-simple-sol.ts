/**
 * Test: Simple SOL Transfer
 * Tests sending a tiny amount of SOL (simpler than USDC)
 */

import { loadGridSession, gridTestClient } from '../setup/test-helpers';

async function main() {
  console.log('🧪 Testing simple SOL transfer...\n');
  
  try {
    const gridSession = await loadGridSession();
    console.log('Grid address:', gridSession.address);
    console.log();
    
    // Try sending a tiny amount of SOL
    console.log('Sending 0.001 SOL to test address...');
    const signature = await gridTestClient.sendTokens({
      recipient: '6e3oXsDzefqyQ87x7mT2WtT6EfTsAEPyCgs9eN5Nt3zB',
      amount: '0.001',
      // No tokenMint = native SOL
    });
    
    console.log('✅ SOL transfer successful!');
    console.log('Signature:', signature);
    process.exit(0);
  } catch (error) {
    console.error('❌ SOL transfer failed:', error);
    process.exit(1);
  }
}

main();


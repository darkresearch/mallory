/**
 * Test: Grid Transfer Right Now
 * Quick test to see if Grid transfers are working
 */

import { gridTestClient } from '../setup/grid-test-client';
import { loadGridSession } from '../setup/test-helpers';

async function main() {
  console.log('Testing Grid transfer right now...\n');
  
  const session = await loadGridSession();
  console.log('Grid address:', session.address);
  
  // Try to send tiny amount of SOL
  console.log('\nSending 0.001 SOL to test address...');
  
  try {
    const sig = await gridTestClient.sendTokens({
      recipient: '9iyGCFN7gygk7uRoKuwsDqcBnDyiBQyarvrQ1JMPtNM',
      amount: '0.001',
    });
    
    console.log('✅ Grid returned signature:', sig);
    console.log('\nCheck on Solscan:');
    console.log(`https://solscan.io/tx/${sig}`);
    
    console.log('\nWaiting 3s then checking if funds arrived...');
    await new Promise(r => setTimeout(r, 3000));
    
    const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
    const conn = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    
    const balance = await conn.getBalance(new PublicKey('9iyGCFN7gygk7uRoKuwsDqcBnDyiBQyarvrQ1JMPtNM'));
    console.log('\nRecipient balance:', (balance / LAMPORTS_PER_SOL).toFixed(6), 'SOL');
    
    if (balance > 0) {
      console.log('✅ Funds arrived!');
    } else {
      console.log('❌ No funds - Grid transaction may not have executed');
    }
    
  } catch (error) {
    console.error('❌ Failed:', error);
  }
}

main();


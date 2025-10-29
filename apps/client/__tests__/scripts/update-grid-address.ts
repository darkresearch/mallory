/**
 * Update Test Grid Address
 * 
 * Updates the cached Grid address to match the current test user's actual Grid wallet.
 * Run this once to fix test data.
 */

import { testStorage } from '../setup/test-storage';

const CORRECT_GRID_ADDRESS = '4nnT9EyTm7JSmNM6ciCER3SU5QAmUKsqngtmA1rn4Hga';

async function updateGridAddress() {
  try {
    console.log('🔧 Updating test Grid address...');
    console.log('   New address:', CORRECT_GRID_ADDRESS);
    
    // Load existing session
    const cached = await testStorage.getItem('grid_session_cache');
    if (!cached) {
      console.error('❌ No cached Grid session found');
      console.log('   Run: bun run test:setup');
      process.exit(1);
    }
    
    const gridSession = JSON.parse(cached);
    console.log('   Old address:', gridSession.address);
    
    // Update address
    gridSession.address = CORRECT_GRID_ADDRESS;
    
    // Save back
    await testStorage.setItem('grid_session_cache', JSON.stringify(gridSession));
    
    console.log('✅ Grid address updated successfully');
    console.log('   Cached at:', testStorage.storagePath);
    
  } catch (error) {
    console.error('❌ Failed to update Grid address:', error);
    process.exit(1);
  }
}

updateGridAddress();


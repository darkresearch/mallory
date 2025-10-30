/**
 * Global cleanup for integration tests
 * 
 * Runs once after all integration tests complete to ensure
 * all resources are properly cleaned up and process exits cleanly
 */

import { supabase } from '../setup/supabase-test-client';

let cleanupCalled = false;

export async function globalCleanup() {
  if (cleanupCalled) {
    return;
  }
  cleanupCalled = true;

  console.log('🌍 Running global cleanup...');
  
  try {
    // Remove all Supabase Realtime channels
    try {
      supabase.removeAllChannels();
      console.log('✅ Removed all Supabase channels');
    } catch (e) {
      console.warn('Warning removing channels:', e);
    }
    
    // Sign out from Supabase to stop auth refresh timers
    await supabase.auth.signOut();
    console.log('✅ Signed out from Supabase');
    
    console.log('✅ Global cleanup complete');
  } catch (error) {
    console.warn('Error during global cleanup:', error);
  }
  
  // Force exit immediately after cleanup - this ensures the process doesn't hang
  // on any remaining timers or connections
  console.log('🛑 Exiting test process...');
  process.exit(0);
}

// Register cleanup on process exit as a safety net
process.on('beforeExit', () => {
  if (!cleanupCalled) {
    globalCleanup();
  }
});


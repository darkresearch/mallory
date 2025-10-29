/**
 * Integration Test Setup
 * 
 * Configuration for integration tests with real services
 * - Uses real Supabase client
 * - Uses real Grid client
 * - Test credentials from .env.test
 */

// Load environment variables first
import '../setup/test-env';

// Import test helpers with real service clients
import { authenticateTestUser, loadGridSession } from '../setup/test-helpers';
import { supabase } from '../setup/supabase-test-client';
import { gridTestClient } from '../setup/grid-test-client';

// Export for use in tests
export { authenticateTestUser, loadGridSession, supabase, gridTestClient };

// Helper to create a test user session for integration tests
export async function setupTestUserSession() {
  try {
    const { userId, email, accessToken } = await authenticateTestUser();
    const gridSession = await loadGridSession();
    
    return {
      userId,
      email,
      accessToken,
      gridSession,
    };
  } catch (error) {
    console.error('Failed to setup test user session:', error);
    throw error;
  }
}

// Helper to cleanup test data (if needed)
export async function cleanupTestData(userId: string) {
  try {
    // Clean up any test conversations
    await supabase
      .from('conversations')
      .delete()
      .eq('user_id', userId)
      .like('title', 'Test:%');
    
    console.log('Test data cleaned up for user:', userId);
  } catch (error) {
    console.warn('Error cleaning up test data:', error);
  }
}


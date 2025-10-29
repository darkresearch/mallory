/**
 * E2E Test: User Signup Flow
 * 
 * Tests complete signup process using PRODUCTION code paths:
 * 1. Supabase email/password signup (test-only, but uses real Supabase)
 * 2. Grid wallet creation via BACKEND API (same as production)
 * 3. OTP verification via Mailosaur
 * 
 * REQUIREMENTS:
 * - Backend server must be running (default: http://localhost:3001)
 * - Set TEST_BACKEND_URL in .env.test if using different URL
 * 
 * Each test run creates a brand new user with random credentials
 */

import { describe, test, expect } from 'bun:test';
import { signupNewUser, completeGridSignupProduction } from '../setup/test-helpers';
import { generateTestEmail, generateTestPassword } from '../utils/mailosaur-helpers';

describe('User Signup Flow (Production Path)', () => {
  test('should complete full signup: Supabase + Grid via Backend', async () => {
    console.log('🚀 Starting E2E Signup Flow Test (PRODUCTION PATH)\n');
    console.log('━'.repeat(60));
    console.log('ℹ️  This test uses PRODUCTION code:');
    console.log('   - Backend API for Grid operations');
    console.log('   - Same flow as real users (except email/password auth)');
    console.log('━'.repeat(60));
    console.log();
    
    // ============================================
    // STEP 1: Generate Random Test Credentials
    // ============================================
    console.log('📋 Step 1/4: Generating test credentials...\n');
    
    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();
    
    console.log('✅ Generated test credentials:');
    console.log('   Email:', testEmail);
    console.log('   Password:', testPassword.substring(0, 4) + '***');
    console.log();
    
    // ============================================
    // STEP 2: Create Supabase Account
    // ============================================
    console.log('📋 Step 2/4: Creating Supabase account...\n');
    
    const supabaseResult = await signupNewUser(testEmail, testPassword);
    
    console.log('✅ Supabase account created:');
    console.log('   User ID:', supabaseResult.userId);
    console.log('   Email:', supabaseResult.email);
    console.log('   Has Session:', !!supabaseResult.session);
    console.log('   Access Token:', supabaseResult.session.access_token.substring(0, 20) + '...');
    console.log();
    
    // Verify Supabase signup succeeded
    expect(supabaseResult.userId).toBeDefined();
    expect(supabaseResult.email).toBe(testEmail);
    expect(supabaseResult.session).toBeDefined();
    expect(supabaseResult.session.access_token).toBeDefined();
    
    // ============================================
    // STEP 3: Create Grid Wallet (via Backend API)
    // ============================================
    console.log('📋 Step 3/4: Creating Grid wallet via backend...\n');
    console.log('⏳ This may take 30-90 seconds...');
    console.log('   - Calling backend /api/grid/start-sign-in');
    console.log('   - Backend calls Grid SDK');
    console.log('   - Waiting for OTP email via Mailosaur');
    console.log('   - Calling backend /api/grid/complete-sign-in');
    console.log('   - Backend syncs to database');
    console.log();
    
    const gridSession = await completeGridSignupProduction(
      testEmail,
      supabaseResult.session.access_token
    );
    
    console.log('✅ Grid wallet created:');
    console.log('   Address:', gridSession.address);
    console.log('   Has Authentication:', !!gridSession.authentication);
    console.log('   Has Session Secrets:', !!gridSession.sessionSecrets);
    console.log();
    
    // Verify Grid signup succeeded
    expect(gridSession.address).toBeDefined();
    expect(gridSession.address.length).toBeGreaterThan(0);
    expect(gridSession.authentication).toBeDefined();
    expect(gridSession.sessionSecrets).toBeDefined();
    
    // ============================================
    // STEP 4: Verify Complete Setup
    // ============================================
    console.log('📋 Step 4/4: Verifying complete setup...\n');
    
    // Check that we have both Supabase and Grid credentials
    expect(supabaseResult.userId).toBeDefined();
    expect(gridSession.address).toBeDefined();
    
    console.log('✅✅✅ SIGNUP FLOW COMPLETE! ✅✅✅\n');
    console.log('━'.repeat(60));
    console.log('📍 Test Account Created:\n');
    console.log('Supabase:');
    console.log('  User ID:', supabaseResult.userId);
    console.log('  Email:', supabaseResult.email);
    console.log('  Password: ********');
    console.log();
    console.log('Grid:');
    console.log('  Wallet Address:', gridSession.address);
    console.log('  Network: Solana Mainnet');
    console.log();
    console.log('✅ Backend Integration:');
    console.log('  - Used production API endpoints');
    console.log('  - Data synced to database');
    console.log('  - Same flow as production users');
    console.log();
    console.log('🗒️  Note: Account left in place (no cleanup)');
    console.log('━'.repeat(60));
    console.log();
  }, 120000); // 120 second timeout for full flow
});


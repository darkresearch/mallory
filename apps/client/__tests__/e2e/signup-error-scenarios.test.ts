/**
 * E2E Test: Grid Sign-in Error Scenarios
 * 
 * Tests various failure modes to replicate production issues where users
 * get "Invalid email and code combination" errors.
 * 
 * These tests help identify root causes of sign-in failures:
 * - Expired OTP codes
 * - Wrong OTP codes
 * - Timing issues
 * - Retry scenarios
 * - Session mismatch
 */

import { describe, test, expect } from 'bun:test';
import { signupNewUser } from '../setup/test-helpers';
import { generateTestEmail, generateTestPassword } from '../utils/mailosaur-helpers';
import { waitForOTP } from '../setup/mailosaur';

const BACKEND_URL = process.env.TEST_BACKEND_URL || 'http://localhost:3001';

describe('Grid Sign-in Error Scenarios', () => {
  
  // ============================================
  // SCENARIO 1: Wrong OTP Code
  // ============================================
  test('should fail with invalid OTP code', async () => {
    console.log('\n🧪 Test: Invalid OTP Code\n');
    
    // Create user
    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();
    const supabaseResult = await signupNewUser(testEmail, testPassword);
    
    console.log('✅ User created:', testEmail);
    console.log('🔐 Starting Grid sign-in...');
    
    // Start sign-in
    const startResponse = await fetch(`${BACKEND_URL}/api/grid/start-sign-in`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseResult.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: testEmail })
    });
    
    const startData = await startResponse.json();
    expect(startData.success).toBe(true);
    console.log('✅ Grid sign-in started, OTP sent');
    
    // Generate session secrets
    const { GridClient } = await import('@sqds/grid');
    const tempClient = new GridClient({
      environment: 'production',
      apiKey: 'not-used',
      baseUrl: 'https://grid.squads.xyz'
    });
    const sessionSecrets = await tempClient.generateSessionSecrets();
    
    // Try to complete with WRONG OTP
    console.log('❌ Attempting to complete with WRONG OTP: 000000');
    const completeResponse = await fetch(`${BACKEND_URL}/api/grid/complete-sign-in`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseResult.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user: startData.user,
        otpCode: '000000', // Wrong OTP
        sessionSecrets
      })
    });
    
    const completeData = await completeResponse.json();
    
    console.log('Response status:', completeResponse.status);
    console.log('Response data:', JSON.stringify(completeData, null, 2));
    
    // Verify we get the expected error
    expect(completeResponse.status).toBe(400);
    expect(completeData.success).toBe(false);
    expect(completeData.error).toContain('Invalid');
    
    console.log('✅ Test passed: Invalid OTP correctly rejected\n');
  }, 90000);
  
  // ============================================
  // SCENARIO 2: Expired OTP (wait too long)
  // ============================================
  test('should fail with expired OTP', async () => {
    console.log('\n🧪 Test: Expired OTP (simulated delay)\n');
    
    // Create user
    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();
    const supabaseResult = await signupNewUser(testEmail, testPassword);
    
    console.log('✅ User created:', testEmail);
    console.log('🔐 Starting Grid sign-in...');
    
    // Start sign-in
    const startResponse = await fetch(`${BACKEND_URL}/api/grid/start-sign-in`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseResult.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: testEmail })
    });
    
    const startData = await startResponse.json();
    expect(startData.success).toBe(true);
    
    // Get the real OTP
    const serverId = process.env.MAILOSAUR_SERVER_ID!;
    const realOtp = await waitForOTP(serverId, testEmail, 60000);
    console.log('✅ Real OTP received:', realOtp);
    
    // Simulate waiting too long (Grid OTPs expire after 10 minutes)
    // For testing, we'll try to use the OTP after requesting a new one
    console.log('⏰ Requesting NEW OTP (making old one invalid)...');
    
    const startResponse2 = await fetch(`${BACKEND_URL}/api/grid/start-sign-in`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseResult.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: testEmail })
    });
    
    const startData2 = await startResponse2.json();
    console.log('✅ New OTP requested (old OTP now invalid)');
    
    // Try to use OLD OTP with NEW user data
    const { GridClient } = await import('@sqds/grid');
    const tempClient = new GridClient({
      environment: 'production',
      apiKey: 'not-used',
      baseUrl: 'https://grid.squads.xyz'
    });
    const sessionSecrets = await tempClient.generateSessionSecrets();
    
    console.log('❌ Attempting to use OLD OTP with NEW user data...');
    const completeResponse = await fetch(`${BACKEND_URL}/api/grid/complete-sign-in`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseResult.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user: startData2.user, // NEW user data
        otpCode: realOtp, // OLD OTP
        sessionSecrets
      })
    });
    
    const completeData = await completeResponse.json();
    
    console.log('Response status:', completeResponse.status);
    console.log('Response data:', JSON.stringify(completeData, null, 2));
    
    // Should fail with invalid code
    expect(completeResponse.status).toBe(400);
    expect(completeData.success).toBe(false);
    
    console.log('✅ Test passed: Expired/mismatched OTP correctly rejected\n');
  }, 120000);
  
  // ============================================
  // SCENARIO 3: User data mismatch
  // ============================================
  test('should fail when user data is modified', async () => {
    console.log('\n🧪 Test: Modified User Data\n');
    
    // Create user
    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();
    const supabaseResult = await signupNewUser(testEmail, testPassword);
    
    console.log('✅ User created:', testEmail);
    console.log('🔐 Starting Grid sign-in...');
    
    // Start sign-in
    const startResponse = await fetch(`${BACKEND_URL}/api/grid/start-sign-in`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseResult.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: testEmail })
    });
    
    const startData = await startResponse.json();
    expect(startData.success).toBe(true);
    
    // Get the real OTP
    const serverId = process.env.MAILOSAUR_SERVER_ID!;
    const realOtp = await waitForOTP(serverId, testEmail, 60000);
    console.log('✅ Real OTP received:', realOtp);
    
    // Generate session secrets
    const { GridClient } = await import('@sqds/grid');
    const tempClient = new GridClient({
      environment: 'production',
      apiKey: 'not-used',
      baseUrl: 'https://grid.squads.xyz'
    });
    const sessionSecrets = await tempClient.generateSessionSecrets();
    
    // Modify user data (simulate corruption/tampering)
    const modifiedUser = {
      ...startData.user,
      email: testEmail.replace('@', '+modified@') // Change email
    };
    
    console.log('❌ Attempting to complete with MODIFIED user data...');
    console.log('Original email:', startData.user.email);
    console.log('Modified email:', modifiedUser.email);
    
    const completeResponse = await fetch(`${BACKEND_URL}/api/grid/complete-sign-in`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseResult.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user: modifiedUser,
        otpCode: realOtp,
        sessionSecrets
      })
    });
    
    const completeData = await completeResponse.json();
    
    console.log('Response status:', completeResponse.status);
    console.log('Response data:', JSON.stringify(completeData, null, 2));
    
    // Should fail
    expect(completeResponse.status).toBe(400);
    expect(completeData.success).toBe(false);
    
    console.log('✅ Test passed: Modified user data correctly rejected\n');
  }, 120000);
  
  // ============================================
  // SCENARIO 4: Rapid retry (double submission)
  // ============================================
  test('should handle rapid OTP retry attempts', async () => {
    console.log('\n🧪 Test: Rapid OTP Retries\n');
    
    // Create user
    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();
    const supabaseResult = await signupNewUser(testEmail, testPassword);
    
    console.log('✅ User created:', testEmail);
    console.log('🔐 Starting Grid sign-in...');
    
    // Start sign-in
    const startResponse = await fetch(`${BACKEND_URL}/api/grid/start-sign-in`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseResult.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: testEmail })
    });
    
    const startData = await startResponse.json();
    expect(startData.success).toBe(true);
    
    // Get the real OTP
    const serverId = process.env.MAILOSAUR_SERVER_ID!;
    const realOtp = await waitForOTP(serverId, testEmail, 60000);
    console.log('✅ Real OTP received:', realOtp);
    
    // Generate session secrets
    const { GridClient } = await import('@sqds/grid');
    const tempClient = new GridClient({
      environment: 'production',
      apiKey: 'not-used',
      baseUrl: 'https://grid.squads.xyz'
    });
    const sessionSecrets = await tempClient.generateSessionSecrets();
    
    // First attempt - should succeed
    console.log('✅ Attempt 1: Submitting correct OTP...');
    const attempt1 = await fetch(`${BACKEND_URL}/api/grid/complete-sign-in`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseResult.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user: startData.user,
        otpCode: realOtp,
        sessionSecrets
      })
    });
    
    const result1 = await attempt1.json();
    console.log('Attempt 1 status:', attempt1.status);
    console.log('Attempt 1 result:', result1.success);
    
    // Second attempt immediately - should fail (OTP already used)
    console.log('❌ Attempt 2: Reusing same OTP...');
    const attempt2 = await fetch(`${BACKEND_URL}/api/grid/complete-sign-in`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseResult.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user: startData.user,
        otpCode: realOtp,
        sessionSecrets
      })
    });
    
    const result2 = await attempt2.json();
    console.log('Attempt 2 status:', attempt2.status);
    console.log('Attempt 2 result:', JSON.stringify(result2, null, 2));
    
    // First should succeed, second should fail
    expect(result1.success).toBe(true);
    expect(attempt2.status).toBe(400);
    expect(result2.success).toBe(false);
    
    console.log('✅ Test passed: Reused OTP correctly rejected\n');
  }, 120000);
  
  // ============================================
  // SCENARIO 5: Timing issue - OTP retrieved before email arrives
  // ============================================
  test('should handle premature OTP retrieval', async () => {
    console.log('\n🧪 Test: Premature OTP Retrieval (timing issue)\n');
    
    // Create user
    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();
    const supabaseResult = await signupNewUser(testEmail, testPassword);
    
    console.log('✅ User created:', testEmail);
    console.log('🔐 Starting Grid sign-in...');
    
    // Start sign-in
    const startResponse = await fetch(`${BACKEND_URL}/api/grid/start-sign-in`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseResult.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: testEmail })
    });
    
    const startData = await startResponse.json();
    expect(startData.success).toBe(true);
    console.log('✅ Grid sign-in started');
    
    // Try to retrieve OTP with very short timeout (simulates premature retrieval)
    console.log('⏰ Attempting to retrieve OTP immediately (may timeout)...');
    
    const serverId = process.env.MAILOSAUR_SERVER_ID!;
    
    try {
      const otp = await waitForOTP(serverId, testEmail, 5000); // Only wait 5 seconds
      console.log('✅ OTP retrieved quickly:', otp);
      
      // If we got it, try to use it (should work)
      const { GridClient } = await import('@sqds/grid');
      const tempClient = new GridClient({
        environment: 'production',
        apiKey: 'not-used',
        baseUrl: 'https://grid.squads.xyz'
      });
      const sessionSecrets = await tempClient.generateSessionSecrets();
      
      const completeResponse = await fetch(`${BACKEND_URL}/api/grid/complete-sign-in`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseResult.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user: startData.user,
          otpCode: otp,
          sessionSecrets
        })
      });
      
      const completeData = await completeResponse.json();
      console.log('Complete response:', completeData);
      
    } catch (error) {
      console.log('❌ Timeout waiting for OTP (expected behavior for slow email delivery)');
      console.log('Error:', error);
      
      // This demonstrates the timing issue users might experience
      console.log('ℹ️  This is the scenario where users see "Invalid code" because:');
      console.log('   1. Email delivery is slow');
      console.log('   2. User enters code manually before our code retrieves it');
      console.log('   3. User might request new OTP, invalidating old one');
    }
    
    console.log('✅ Test completed: Timing issue scenario demonstrated\n');
  }, 120000);
});


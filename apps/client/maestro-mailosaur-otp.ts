#!/usr/bin/env bun
/**
 * Mailosaur OTP Helper for Maestro
 * 
 * This script fetches Grid OTP codes from Mailosaur emails.
 * Called by Maestro tests to get real OTPs programmatically.
 * 
 * Usage (from apps/client directory):
 *   bun maestro-mailosaur-otp.ts <email>
 * 
 * Environment:
 *   Loads from .env.test in apps/client/
 *   - MAILOSAUR_API_KEY
 *   - MAILOSAUR_SERVER_ID (optional, extracted from email)
 * 
 * Returns: 6-digit OTP code
 */

// Load environment from .env.test
import './__tests__/setup/test-env';
import { waitForOTP } from './__tests__/setup/mailosaur';

async function main() {
  const email = process.argv[2];
  
  if (!email) {
    console.error('❌ Usage: bun maestro-mailosaur-otp.ts <email>');
    process.exit(1);
  }

  // Extract server ID from Mailosaur email
  // Format: something@SERVERID.mailosaur.net
  const match = email.match(/@([^.]+)\.mailosaur\.net$/);
  if (!match) {
    console.error(`❌ Email must be a Mailosaur address: xxx@serverid.mailosaur.net`);
    console.error(`   Got: ${email}`);
    process.exit(1);
  }

  const serverId = match[1];
  console.log(`📧 Waiting for OTP email to: ${email}`);
  console.log(`   Server ID: ${serverId}`);

  try {
    const otp = await waitForOTP(serverId, email, 120000); // 2 minute timeout
    
    // Output ONLY the OTP (so Maestro can read it)
    console.log(`\n✅ OTP: ${otp}`);
    
    // Also write to file for Maestro to read
    await Bun.write('.maestro/.latest-otp', otp);
    
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Failed to get OTP:`, error);
    process.exit(1);
  }
}

main();


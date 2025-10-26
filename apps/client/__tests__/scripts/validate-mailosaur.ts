/**
 * Validation Script: Mailosaur Integration
 * 
 * Tests that we can connect to Mailosaur API
 */

import { deleteAllEmails } from '../setup/mailosaur';

async function main() {
  console.log('🧪 Phase 2: Testing Mailosaur integration...\n');

  // Load env vars
  const apiKey = process.env.MAILOSAUR_API_KEY;
  const serverId = process.env.MAILOSAUR_SERVER_ID;
  const testEmail = process.env.TEST_SUPABASE_EMAIL;

  console.log('Environment check:');
  console.log('  MAILOSAUR_API_KEY:', apiKey ? '✅ Set' : '❌ Missing');
  console.log('  MAILOSAUR_SERVER_ID:', serverId || '❌ Missing');
  console.log('  TEST_SUPABASE_EMAIL:', testEmail || '❌ Missing');
  console.log();

  if (!apiKey || !serverId || !testEmail) {
    console.error('❌ Missing required environment variables');
    console.error('   Make sure .env.test is loaded');
    process.exit(1);
  }

  try {
    // Test 1: Verify API credentials
    console.log('Test 1: Verifying Mailosaur API credentials...');
    const auth = Buffer.from(`${apiKey}:`).toString('base64');
    const url = `https://mailosaur.com/api/messages?server=${serverId}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Mailosaur API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ API connection successful');
    console.log(`   Current emails in inbox: ${data.items?.length || 0}\n`);

    // Test 2: Check email format
    console.log('Test 2: Validating test email format...');
    if (!testEmail.includes('@7kboxsdj.mailosaur.net')) {
      throw new Error('Test email does not match Mailosaur server domain');
    }
    console.log('✅ Email format valid:', testEmail, '\n');

    // Test 3: List recent emails
    console.log('Test 3: Listing recent emails...');
    if (data.items && data.items.length > 0) {
      console.log(`   Found ${data.items.length} email(s):`);
      data.items.slice(0, 3).forEach((email: any, i: number) => {
        console.log(`   ${i + 1}. From: ${email.from[0]?.email || 'unknown'}`);
        console.log(`      Subject: ${email.subject || 'no subject'}`);
        console.log(`      Received: ${email.received}`);
      });
    } else {
      console.log('   No emails found (inbox is empty)');
    }
    console.log();

    // Test 4: Test cleanup function
    console.log('Test 4: Testing cleanup function...');
    console.log('   (Skipping actual deletion to preserve any existing emails)');
    console.log('✅ Cleanup function available\n');

    console.log('ℹ️  Note: OTP extraction will be tested during Grid account creation');
    console.log();

    console.log('✅✅✅ Phase 2 COMPLETE: Mailosaur integration validated! ✅✅✅\n');
    console.log('📧 Ready to receive OTP emails at:', testEmail);
    console.log();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Phase 2 FAILED:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Check that MAILOSAUR_API_KEY is correct');
    console.error('  2. Check that MAILOSAUR_SERVER_ID is correct');
    console.error('  3. Verify Mailosaur account is active');
    process.exit(1);
  }
}

// Load .env.test
const envPath = require('path').join(process.cwd(), '.env.test');
try {
  const envContent = require('fs').readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line: string) => {
    const match = line.match(/^([^#][^=]+)=(.+)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
} catch (error) {
  console.error('Warning: Could not load .env.test:', error);
}

main();


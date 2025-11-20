/**
 * Confirm Test User Email
 * 
 * Uses Supabase Admin API to confirm the test user's email
 * This bypasses the need to manually confirm emails for test accounts
 */

import { createClient } from '@supabase/supabase-js';

async function main() {
  console.log('🔐 Confirming test user email...\n');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const testEmail = process.env.TEST_SUPABASE_EMAIL;

  if (!supabaseUrl) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL is required');
  }

  if (!serviceRoleKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set');
    console.error('\nTo auto-confirm emails, add to your .env.test:');
    console.error('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
    console.error('\nYou can find this in: Supabase Dashboard → Settings → API → service_role key');
    console.error('\nAlternatively, disable email confirmation in:');
    console.error('  Supabase Dashboard → Authentication → Providers → Email → Disable "Confirm email"');
    process.exit(1);
  }

  if (!testEmail) {
    throw new Error('TEST_SUPABASE_EMAIL is required');
  }

  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('📧 Looking up user:', testEmail);

    // Get user by email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    const user = users.users.find(u => u.email === testEmail);

    if (!user) {
      throw new Error(`User with email ${testEmail} not found`);
    }

    console.log('✅ Found user:', user.id);
    console.log('   Email confirmed:', user.email_confirmed_at ? 'Yes' : 'No');

    if (user.email_confirmed_at) {
      console.log('✅ Email is already confirmed!');
      process.exit(0);
    }

    // Confirm the email
    console.log('🔐 Confirming email...');
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        email_confirm: true,
      }
    );

    if (error) {
      throw new Error(`Failed to confirm email: ${error.message}`);
    }

    console.log('✅ Email confirmed successfully!');
    console.log('   User ID:', data.user.id);
    console.log('   Email:', data.user.email);
    console.log('   Confirmed at:', data.user.email_confirmed_at);
    console.log('\n✅✅✅ Email confirmation complete! ✅✅✅\n');
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to confirm email:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Check that SUPABASE_SERVICE_ROLE_KEY is correct');
    console.error('  2. Check that TEST_SUPABASE_EMAIL matches the user email');
    console.error('  3. Verify the user exists in Supabase');
    process.exit(1);
  }
}

main();





/**
 * Mailosaur Test Utilities
 * 
 * Helper functions for generating test emails and managing Mailosaur in tests
 */

/**
 * Generate a random test email using Mailosaur domain
 * 
 * Mailosaur allows ANY email at your server domain to work
 * Example: mallory-test-abc123@7kboxsdj.mailosaur.net
 * 
 * @returns Random email address for testing
 */
export function generateTestEmail(): string {
  const randomId = Math.random().toString(36).substring(2, 10);
  const timestamp = Date.now().toString(36);
  const serverId = process.env.MAILOSAUR_SERVER_ID;
  
  if (!serverId) {
    throw new Error('MAILOSAUR_SERVER_ID environment variable is required');
  }
  
  // Combine random ID and timestamp for uniqueness
  const uniqueId = `${randomId}${timestamp}`;
  return `mallory-test-${uniqueId}@${serverId}.mailosaur.net`;
}

/**
 * Generate a strong random password for test accounts
 * 
 * @returns Random password meeting security requirements
 */
export function generateTestPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}


/**
 * Mailosaur Integration
 * 
 * Retrieve OTP codes from emails for Grid account verification
 */

interface MailosaurEmail {
  id: string;
  subject: string;
  html: {
    body: string;
  };
  text: {
    body: string;
  };
  from: Array<{ email: string; name: string }>;
  to: Array<{ email: string; name: string }>;
  received: string;
}

interface MailosaurListResponse {
  items: MailosaurEmail[];
}

/**
 * Wait for an email to arrive and extract OTP
 * 
 * @param serverId - Mailosaur server ID
 * @param sentTo - Email address to check (optional, uses test email by default)
 * @param timeoutMs - How long to wait for email (default 60s)
 * @returns 6-digit OTP code
 */
export async function waitForOTP(
  serverId: string,
  sentTo?: string,
  timeoutMs: number = 60000
): Promise<string> {
  const apiKey = process.env.MAILOSAUR_API_KEY;
  if (!apiKey) {
    throw new Error('MAILOSAUR_API_KEY not set');
  }

  const emailToCheck = sentTo || process.env.TEST_SUPABASE_EMAIL;
  if (!emailToCheck) {
    throw new Error('No email address provided or TEST_SUPABASE_EMAIL not set');
  }

  console.log(`📧 Waiting for NEW OTP email to ${emailToCheck}...`);
  console.log(`   Timeout: ${timeoutMs / 1000}s`);

  const startTime = Date.now();
  const pollInterval = 3000; // Check every 3 seconds
  let lastEmailId: string | undefined;

  while (Date.now() - startTime < timeoutMs) {
    try {
      // Get recent emails
      const email = await getLatestEmail(serverId, apiKey, emailToCheck);
      
      if (email) {
        // Only process if this is a NEW email we haven't seen
        if (lastEmailId && email.id === lastEmailId) {
          // Same email, keep waiting
        } else {
          lastEmailId = email.id;
          
          // Check if this email was received AFTER we started waiting
          const emailTime = new Date(email.received).getTime();
          if (emailTime < startTime - 5000) { // 5s buffer
            console.log(`⏩ Skipping old email from ${new Date(email.received).toISOString()}`);
          } else {
            console.log(`✅ New email received from: ${email.from[0]?.email || 'unknown'}`);
            console.log(`   Subject: ${email.subject}`);
            console.log(`   Received: ${email.received}`);
            
            // Extract OTP from email
            const otp = extractOTPFromEmail(email);
            if (otp) {
              console.log(`✅ OTP extracted: ${otp}`);
              return otp;
            } else {
              console.log('⚠️  Email found but no OTP code detected, waiting for next email...');
            }
          }
        }
      }
    } catch (error) {
      // Continue polling
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    process.stdout.write(`\r   Elapsed: ${elapsed}s...`);
  }

  throw new Error(`Timeout waiting for OTP email after ${timeoutMs / 1000}s`);
}

/**
 * Get the latest email from Mailosaur
 */
async function getLatestEmail(
  serverId: string,
  apiKey: string,
  sentTo: string
): Promise<MailosaurEmail | null> {
  const auth = Buffer.from(`${apiKey}:`).toString('base64');
  
  // List messages API
  const url = `https://mailosaur.com/api/messages?server=${serverId}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Basic ${auth}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Mailosaur API error: ${response.status}`);
  }

  const data: MailosaurListResponse = await response.json();
  
  // Find most recent email to our test address
  const recentEmails = data.items
    .filter(email => 
      email.to.some(recipient => 
        recipient.email.toLowerCase().includes(sentTo.toLowerCase())
      )
    )
    .sort((a, b) => new Date(b.received).getTime() - new Date(a.received).getTime());

  return recentEmails[0] || null;
}

/**
 * Extract 6-digit OTP code from email body or subject
 */
function extractOTPFromEmail(email: MailosaurEmail): string | null {
  const subject = email.subject || '';
  const textBody = email.text?.body || '';
  const htmlBody = email.html?.body || '';
  
  // Try multiple patterns for OTP
  const patterns = [
    /\b(\d{6})\b/,                    // Any 6-digit number
    /code:\s*(\d{6})/i,               // "code: 123456"
    /verification code:\s*(\d{6})/i,  // "verification code: 123456"
    /otp:\s*(\d{6})/i,                // "OTP: 123456"
    /\b([0-9]{6})\b/,                 // Explicit 6-digit match
  ];

  // Try subject line FIRST (Grid puts OTP in subject!)
  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match && match[1]) {
      console.log('✅ OTP found in subject line');
      return match[1];
    }
  }

  // Try text body
  for (const pattern of patterns) {
    const match = textBody.match(pattern);
    if (match && match[1]) {
      console.log('✅ OTP found in text body');
      return match[1];
    }
  }

  // Try HTML body
  for (const pattern of patterns) {
    const match = htmlBody.match(pattern);
    if (match && match[1]) {
      console.log('✅ OTP found in HTML body');
      return match[1];
    }
  }

  console.warn('Could not extract OTP from email');
  console.log('Subject:', subject);
  console.log('Text body preview:', textBody.substring(0, 200));
  
  return null;
}

/**
 * Delete all emails (cleanup utility)
 */
export async function deleteAllEmails(serverId: string): Promise<void> {
  const apiKey = process.env.MAILOSAUR_API_KEY;
  if (!apiKey) {
    throw new Error('MAILOSAUR_API_KEY not set');
  }

  const auth = Buffer.from(`${apiKey}:`).toString('base64');
  const url = `https://mailosaur.com/api/messages?server=${serverId}`;
  
  await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Basic ${auth}`,
    },
  });
  
  console.log('✅ Deleted all emails from Mailosaur');
}


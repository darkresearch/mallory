#!/usr/bin/env node

/**
 * Export Grid Credentials for AI Agent Testing
 * 
 * This script extracts Grid wallet credentials from secure storage
 * and exports them in formats that the AI agent can use for testing.
 */

const fs = require('fs');
const path = require('path');

// Note: This needs to run in the app context where secure storage works
// For now, this is a template - you'll need to adapt based on your storage

async function main() {
  console.log('🔐 Grid Credentials Export for AI Agent\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('📋 Manual Export Instructions:\n');
  
  console.log('1. Open your Mallory app (web or mobile)');
  console.log('2. Open browser DevTools (F12) or React Native Debugger');
  console.log('3. In Console, run:\n');
  
  console.log('   // Get Grid session secrets');
  console.log('   sessionStorage.getItem("grid_session_secrets")\n');
  
  console.log('   // Get Grid account');
  console.log('   sessionStorage.getItem("grid_account")\n');
  
  console.log('4. Copy the output and save to files:\n');
  
  console.log('   • Save first output to: apps/client/.test-secrets/grid_session_secrets.json');
  console.log('   • Save second output to: apps/client/.test-secrets/grid_account.json\n');
  
  console.log('5. Or set as environment variables (base64 encoded):\n');
  
  console.log('   export TEST_GRID_SESSION_SECRETS=$(echo \'<json>\' | base64)');
  console.log('   export TEST_GRID_ACCOUNT=$(echo \'<json>\' | base64)\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Create .test-secrets directory
  const secretsDir = path.join(__dirname, '../../.test-secrets');
  if (!fs.existsSync(secretsDir)) {
    fs.mkdirSync(secretsDir, { recursive: true });
    console.log('✅ Created .test-secrets/ directory\n');
  }
  
  // Create .gitignore entry
  const gitignorePath = path.join(__dirname, '../../../.gitignore');
  let gitignore = '';
  if (fs.existsSync(gitignorePath)) {
    gitignore = fs.readFileSync(gitignorePath, 'utf-8');
  }
  
  if (!gitignore.includes('.test-secrets')) {
    fs.appendFileSync(gitignorePath, '\n# Test secrets for AI agent\n.test-secrets/\n');
    console.log('✅ Added .test-secrets/ to .gitignore\n');
  }
  
  console.log('📁 Ready to receive credentials in:');
  console.log('   ' + secretsDir + '\n');
  
  console.log('⚠️  IMPORTANT: Never commit these files to git!\n');
}

main().catch(console.error);

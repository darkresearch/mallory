/**
 * Run All Validation Scripts
 * 
 * Comprehensive test of all phases
 */

import { execSync } from 'child_process';

const validations = [
  { name: 'Phase 1: Storage', script: 'validate-storage.ts' },
  { name: 'Phase 2: Mailosaur', script: 'validate-mailosaur.ts' },
  { name: 'Phase 3: Auth', script: 'validate-auth.ts' },
  { name: 'Phase 5: Grid Load', script: 'validate-grid-load.ts' },
  { name: 'Phase 6: Conversation', script: 'validate-conversation.ts' },
];

async function main() {
  console.log('🧪 Running All Validation Tests\n');
  console.log('='.repeat(60));
  console.log();

  let passed = 0;
  let failed = 0;

  for (const validation of validations) {
    console.log(`Testing: ${validation.name}...`);
    
    try {
      execSync(`bun __tests__/scripts/${validation.script}`, {
        cwd: process.cwd(),
        stdio: 'pipe'
      });
      
      console.log(`✅ PASS: ${validation.name}\n`);
      passed++;
    } catch (error) {
      console.error(`❌ FAIL: ${validation.name}\n`);
      failed++;
    }
  }

  console.log('='.repeat(60));
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

  if (failed === 0) {
    console.log('✅✅✅ ALL VALIDATIONS PASSED! ✅✅✅\n');
    console.log('Test infrastructure is ready!');
    console.log();
    process.exit(0);
  } else {
    console.error('Some validations failed. Check output above.');
    process.exit(1);
  }
}

main();


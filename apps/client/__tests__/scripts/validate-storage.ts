/**
 * Validation Script: Test Storage
 * 
 * Tests that the test storage mock works correctly
 */

import { testStorage } from '../setup/test-storage';

async function main() {
  console.log('🧪 Phase 1: Testing storage mock...\n');

  try {
    // Test 1: Write
    console.log('Test 1: Writing data...');
    await testStorage.setItem('test-key', JSON.stringify({ foo: 'bar', timestamp: Date.now() }));
    console.log('✅ Write successful\n');

    // Test 2: Read
    console.log('Test 2: Reading data...');
    const value = await testStorage.getItem('test-key');
    if (!value) {
      throw new Error('Failed to read value');
    }
    const parsed = JSON.parse(value);
    console.log('✅ Read successful:', parsed, '\n');

    // Test 3: Multiple keys
    console.log('Test 3: Writing multiple keys...');
    await testStorage.setItem('key1', 'value1');
    await testStorage.setItem('key2', 'value2');
    await testStorage.setItem('key3', JSON.stringify({ nested: { data: true } }));
    console.log('✅ Multiple writes successful\n');

    // Test 4: List keys
    console.log('Test 4: Listing all keys...');
    const keys = await testStorage.getAllKeys();
    console.log('✅ Keys:', keys, '\n');

    // Test 5: Remove item
    console.log('Test 5: Removing item...');
    await testStorage.removeItem('test-key');
    const removed = await testStorage.getItem('test-key');
    if (removed !== null) {
      throw new Error('Failed to remove item');
    }
    console.log('✅ Delete successful\n');

    // Test 6: Persistence (file exists)
    console.log('Test 6: Checking file persistence...');
    const fs = await import('fs');
    const path = await import('path');
    const storageFile = path.join(process.cwd(), '.test-secrets', 'test-storage.json');
    if (!fs.existsSync(storageFile)) {
      throw new Error('Storage file not created');
    }
    console.log('✅ Storage persists to:', storageFile, '\n');

    // Cleanup test data
    console.log('Cleanup: Removing test keys...');
    await testStorage.removeItem('key1');
    await testStorage.removeItem('key2');
    await testStorage.removeItem('key3');
    console.log('✅ Cleanup complete\n');

    console.log('✅✅✅ Phase 1 COMPLETE: Storage validation passed! ✅✅✅\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Phase 1 FAILED:', error);
    process.exit(1);
  }
}

main();


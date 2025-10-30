/**
 * CI Test: Storage Key Consistency
 * 
 * Ensures all storage operations use centralized constants instead of hardcoded strings.
 * This prevents bugs from typos and ensures consistent storage key naming.
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const CLIENT_DIR = path.join(__dirname, '..', '..');

// Patterns to detect hardcoded storage keys (excluding tests and key definitions)
const HARDCODED_SESSION_STORAGE_PATTERN = /sessionStorage\.(get|set|remove)Item\(['"](?!SESSION_STORAGE_KEYS)[a-z_]+['"]\)/g;
const HARDCODED_SECURE_STORAGE_PATTERN = /secureStorage\.(get|set|remove)Item\(['"](?!SECURE_STORAGE_KEYS)[a-z_]+['"]\)/g;

// Files to exclude from checks
const EXCLUDE_PATHS = [
  '__tests__',
  'node_modules',
  '.next',
  'dist',
  'build',
  'keys.ts', // The constants file itself
];

function shouldExcludeFile(filePath: string): boolean {
  return EXCLUDE_PATHS.some(exclude => filePath.includes(exclude));
}

function findFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!shouldExcludeFile(filePath)) {
        findFiles(filePath, fileList);
      }
    } else if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !shouldExcludeFile(filePath)) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

function checkFileForHardcodedKeys(filePath: string): { 
  sessionStorageViolations: string[]; 
  secureStorageViolations: string[];
} {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(CLIENT_DIR, filePath);
  
  const sessionStorageViolations: string[] = [];
  const secureStorageViolations: string[] = [];
  
  // Check for hardcoded sessionStorage keys
  let match;
  while ((match = HARDCODED_SESSION_STORAGE_PATTERN.exec(content)) !== null) {
    sessionStorageViolations.push(`${relativePath}:${match[0]}`);
  }
  
  // Check for hardcoded secureStorage keys
  HARDCODED_SECURE_STORAGE_PATTERN.lastIndex = 0; // Reset regex
  while ((match = HARDCODED_SECURE_STORAGE_PATTERN.exec(content)) !== null) {
    secureStorageViolations.push(`${relativePath}:${match[0]}`);
  }
  
  return { sessionStorageViolations, secureStorageViolations };
}

describe('Storage Key Consistency', () => {
  it('should not have hardcoded sessionStorage keys', () => {
    const files = findFiles(CLIENT_DIR);
    const allViolations: string[] = [];
    
    for (const file of files) {
      const { sessionStorageViolations } = checkFileForHardcodedKeys(file);
      allViolations.push(...sessionStorageViolations);
    }
    
    if (allViolations.length > 0) {
      console.error('\n❌ Found hardcoded sessionStorage keys:');
      allViolations.forEach(v => console.error(`   ${v}`));
      console.error('\n💡 Use SESSION_STORAGE_KEYS from lib/storage/keys.ts instead\n');
    }
    
    expect(allViolations).toHaveLength(0);
  });
  
  it('should not have hardcoded secureStorage keys', () => {
    const files = findFiles(CLIENT_DIR);
    const allViolations: string[] = [];
    
    for (const file of files) {
      const { secureStorageViolations } = checkFileForHardcodedKeys(file);
      allViolations.push(...secureStorageViolations);
    }
    
    if (allViolations.length > 0) {
      console.error('\n❌ Found hardcoded secureStorage keys:');
      allViolations.forEach(v => console.error(`   ${v}`));
      console.error('\n💡 Use SECURE_STORAGE_KEYS from lib/storage/keys.ts instead\n');
    }
    
    expect(allViolations).toHaveLength(0);
  });
  
  it('should have storage keys constants file', () => {
    const keysFile = path.join(CLIENT_DIR, 'lib', 'storage', 'keys.ts');
    expect(fs.existsSync(keysFile)).toBe(true);
  });
  
  it('storage keys should be exported from main storage index', () => {
    const storageIndex = path.join(CLIENT_DIR, 'lib', 'storage', 'index.ts');
    const content = fs.readFileSync(storageIndex, 'utf-8');
    
    expect(content).toContain('export { SECURE_STORAGE_KEYS, SESSION_STORAGE_KEYS }');
    expect(content).toContain('export type { SecureStorageKey, SessionStorageKey }');
  });
  
  it('all storage keys should have mallory_ prefix', () => {
    const keysFile = path.join(CLIENT_DIR, 'lib', 'storage', 'keys.ts');
    const content = fs.readFileSync(keysFile, 'utf-8');
    
    // Extract all key values
    const keyValuePattern = /:\s*['"]([^'"]+)['"]/g;
    const keys: string[] = [];
    let match;
    
    while ((match = keyValuePattern.exec(content)) !== null) {
      keys.push(match[1]);
    }
    
    // All keys should start with 'mallory_'
    const keysWithoutPrefix = keys.filter(key => !key.startsWith('mallory_'));
    
    if (keysWithoutPrefix.length > 0) {
      console.error('\n❌ Found storage keys without mallory_ prefix:');
      keysWithoutPrefix.forEach(key => console.error(`   ${key}`));
      console.error('\n💡 All keys should start with "mallory_" for namespacing\n');
    }
    
    expect(keysWithoutPrefix).toHaveLength(0);
  });
  
  it('should successfully import storage keys from keys.ts', async () => {
    // This will fail at test runtime if imports are broken
    const keysModule = await import('../../lib/storage/keys');
    
    expect(keysModule.SECURE_STORAGE_KEYS).toBeDefined();
    expect(keysModule.SESSION_STORAGE_KEYS).toBeDefined();
    
    // Verify all keys have string values
    Object.values(keysModule.SECURE_STORAGE_KEYS).forEach(key => {
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });
    
    Object.values(keysModule.SESSION_STORAGE_KEYS).forEach(key => {
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });
  });
  
  it('should import storage keys from main lib barrel export', async () => {
    // This verifies the re-export chain works correctly
    const libModule = await import('../../lib');
    
    expect(libModule.SECURE_STORAGE_KEYS).toBeDefined();
    expect(libModule.SESSION_STORAGE_KEYS).toBeDefined();
    
    // Verify they're the same objects (not copies)
    const keysModule = await import('../../lib/storage/keys');
    expect(libModule.SECURE_STORAGE_KEYS).toBe(keysModule.SECURE_STORAGE_KEYS);
    expect(libModule.SESSION_STORAGE_KEYS).toBe(keysModule.SESSION_STORAGE_KEYS);
  });
});

#!/usr/bin/env bun

/**
 * Pre-commit hook to ensure all package versions are in sync
 */

const { execSync } = require('child_process');
const path = require('path');

try {
  // Run version sync check
  execSync('bun scripts/sync-version.js', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });
} catch (error) {
  console.error('\n❌ Pre-commit check failed: versions are out of sync');
  console.error('Run: bun scripts/sync-version.js X.Y.Z to sync all packages');
  process.exit(1);
}


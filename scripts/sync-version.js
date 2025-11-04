#!/usr/bin/env bun

/**
 * Sync version across all package.json files in the monorepo
 * 
 * Usage:
 *   Check sync:  bun scripts/sync-version.js
 *   Bump:        bun scripts/sync-version.js 0.2.0
 * 
 * Auto-triggered by PR merge when title contains: [release: v*.*.*]
 * See: .github/workflows/version-bump.yml
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// All package.json files that should have synced versions
const PACKAGE_FILES = [
  path.join(ROOT, 'package.json'),
  path.join(ROOT, 'apps/client/package.json'),
  path.join(ROOT, 'apps/server/package.json'),
  path.join(ROOT, 'packages/shared/package.json'),
];

function readPackageVersion(filePath) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return content.version;
}

function writePackageVersion(filePath, version) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  content.version = version;
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
}

function checkVersionsInSync() {
  const versions = PACKAGE_FILES.map(file => ({
    file: path.relative(ROOT, file),
    version: readPackageVersion(file)
  }));
  
  const uniqueVersions = [...new Set(versions.map(v => v.version))];
  
  if (uniqueVersions.length > 1) {
    console.error('❌ Versions are out of sync:');
    versions.forEach(v => {
      console.error(`   ${v.file}: ${v.version}`);
    });
    return false;
  }
  
  console.log(`✅ All packages are at version ${uniqueVersions[0]}`);
  return true;
}

function syncVersions(newVersion) {
  // Validate semantic version format
  if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
    console.error('❌ Invalid version format. Use semantic versioning: X.Y.Z');
    process.exit(1);
  }
  
  console.log(`📦 Syncing all packages to version ${newVersion}...`);
  
  PACKAGE_FILES.forEach(file => {
    const oldVersion = readPackageVersion(file);
    writePackageVersion(file, newVersion);
    console.log(`   ✓ ${path.relative(ROOT, file)}: ${oldVersion} → ${newVersion}`);
  });
  
  console.log(`\n✅ All packages synced to version ${newVersion}`);
  
  // In CI, skip the manual instructions
  if (!process.env.CI) {
    console.log(`\nNext steps:`);
    console.log(`  1. Review changes: git diff`);
    console.log(`  2. Commit: git add . && git commit -m "chore: bump version to ${newVersion}"`);
    console.log(`  3. Tag: git tag v${newVersion}`);
    console.log(`  4. Push: git push && git push --tags`);
    console.log(`\nGitHub will automatically create a release! 🚀`);
  }
}

// Main
const newVersion = process.argv[2];

if (newVersion) {
  syncVersions(newVersion);
} else {
  const inSync = checkVersionsInSync();
  if (!inSync) {
    console.error('\n💡 To sync versions, run: bun scripts/sync-version.js X.Y.Z');
    process.exit(1);
  }
}


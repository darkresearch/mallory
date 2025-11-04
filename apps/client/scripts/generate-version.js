#!/usr/bin/env bun

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Get version from package.json
const packageJson = require('../package.json');
const version = packageJson.version;

// Get git commit hash
let commitHash = 'dev';
try {
  // Try from environment variable first (for CI/CD)
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    commitHash = process.env.VERCEL_GIT_COMMIT_SHA;
    console.log('✅ Using Vercel commit hash:', commitHash.substring(0, 7));
  } else if (process.env.GITHUB_SHA) {
    commitHash = process.env.GITHUB_SHA;
    console.log('✅ Using GitHub commit hash:', commitHash.substring(0, 7));
  } else {
    // Fall back to git command
    commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    console.log('✅ Generated version file with commit:', commitHash.substring(0, 7));
  }
} catch (error) {
  console.warn('⚠️  Could not get git commit hash, using "dev"');
}

// Generate the version file
const versionFileContent = `// Auto-generated file - do not edit manually
// Generated at: ${new Date().toISOString()}

export const APP_VERSION = '${version}';
export const GIT_COMMIT_HASH = '${commitHash}';
export const APP_VERSION_FULL = '${version}-${commitHash.substring(0, 7)}';
`;

const outputPath = path.join(__dirname, '../lib/version.generated.ts');
fs.writeFileSync(outputPath, versionFileContent);

console.log(`📦 Version file generated: ${version}-${commitHash.substring(0, 7)}`);


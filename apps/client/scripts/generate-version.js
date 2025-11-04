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
  commitHash = execSync('git rev-parse HEAD').toString().trim();
  console.log('✅ Generated version file with commit:', commitHash.substring(0, 7));
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


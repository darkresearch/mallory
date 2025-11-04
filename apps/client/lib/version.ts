import Constants from 'expo-constants';

// Try to import the generated version file (created by generate-version.js script)
let generatedVersion: { APP_VERSION_FULL?: string } = {};
try {
  generatedVersion = require('./version.generated');
} catch (e) {
  // File doesn't exist yet, will use fallback
}

/**
 * Gets the app version combining semantic version and git commit hash
 * @returns Version string in format "v0.1.0-abc1234"
 */
export function getAppVersion(): string {
  // Use generated version if available
  if (generatedVersion.APP_VERSION_FULL) {
    return `v${generatedVersion.APP_VERSION_FULL}`;
  }
  
  // Fallback: Get version from expo-constants or environment variable
  const semanticVersion = 
    Constants.expoConfig?.version || 
    Constants.manifest?.version || 
    process.env.EXPO_PUBLIC_APP_VERSION || 
    '0.1.0';
  
  // Get commit hash from environment variable or default to 'dev'
  const commitHash = process.env.EXPO_PUBLIC_GIT_COMMIT_HASH || 'dev';
  
  // Take first 7 characters of commit hash
  const shortHash = commitHash.substring(0, 7);
  
  return `v${semanticVersion}-${shortHash}`;
}


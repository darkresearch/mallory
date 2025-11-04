const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');
const { execSync } = require('child_process');
const webpack = require('webpack');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  
  // Get version from package.json
  const packageJson = require('./package.json');
  const appVersion = packageJson.version;
  
  // Get git commit hash
  let gitCommitHash = 'dev';
  try {
    gitCommitHash = execSync('git rev-parse HEAD').toString().trim();
    console.log('✅ Git commit hash loaded:', gitCommitHash.substring(0, 7));
  } catch (error) {
    console.warn('⚠️  Could not get git commit hash:', error);
  }

  // Customize the config before returning it.
  // Ensure streaming APIs work properly
  config.resolve.fallback = {
    ...config.resolve.fallback,
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer/'),
  };

  // Add module resolution
  config.resolve.alias = {
    ...config.resolve.alias,
    '@': path.resolve(__dirname, './'),
  };

  // Ensure react-native-web aliases are set up
  config.resolve.alias['react-native$'] = 'react-native-web';

  // Inject version and git commit hash at build time via environment variables
  console.log('📦 Injecting build info - Version:', appVersion, 'Commit:', gitCommitHash.substring(0, 7));
  config.plugins = [
    ...config.plugins,
    new webpack.DefinePlugin({
      'process.env.EXPO_PUBLIC_APP_VERSION': JSON.stringify(appVersion),
      'process.env.EXPO_PUBLIC_GIT_COMMIT_HASH': JSON.stringify(gitCommitHash),
    }),
  ];

  return config;
};

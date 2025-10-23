const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add support for 3D model files
config.resolver.assetExts.push('glb', 'gltf', 'bin', 'obj', 'mtl', 'fbx');

// Check if this is a web export (production build)
const isWebExport = process.argv.includes('export') && process.argv.includes('--platform') && process.argv.includes('web');

if (!isWebExport) {
  // Only use monorepo watchFolders for local development
  config.watchFolders = [
    path.resolve(__dirname, '../../packages/streamdown-rn'),
  ];
}

// Configure module resolution for streamdown-rn
config.resolver = {
  ...config.resolver,
  // For web exports, only use local node_modules to avoid Metro hash errors
  nodeModulesPaths: isWebExport 
    ? [path.resolve(__dirname, 'node_modules')]
    : [
        path.resolve(__dirname, 'node_modules'),
        path.resolve(__dirname, '../../node_modules'),
      ],
  // Ensure single React instance for hooks and map workspace dependencies
  extraNodeModules: {
    'react-native-syntax-highlighter': path.resolve(__dirname, '../../node_modules/react-native-syntax-highlighter'),
    'expo-clipboard': path.resolve(__dirname, '../../node_modules/expo-clipboard'),
    'highlight.js': path.resolve(__dirname, '../../node_modules/highlight.js'),
    'react-native-markdown-display': path.resolve(__dirname, '../../node_modules/react-native-markdown-display'),
    'react-native-svg': path.resolve(__dirname, '../../node_modules/react-native-svg'),
    'react-native-webview': path.resolve(__dirname, '../../node_modules/react-native-webview'),
    'remark-gfm': path.resolve(__dirname, '../../node_modules/remark-gfm'),
    'remark-math': path.resolve(__dirname, '../../node_modules/remark-math'),
    'radon-ide': path.resolve(__dirname, '../../node_modules/radon-ide'),
  },
  // Handle symlinks and skip CSS modules
  resolveRequest: (context, moduleName, platform) => {
    // Skip CSS modules
    if (moduleName.endsWith('.module.css')) {
      return { type: 'empty' };
    }
    
    // Handle streamdown-rn workspace package
    if (moduleName === 'streamdown-rn') {
      // For web exports, streamdown-rn should be in node_modules (symlinked by bun)
      // For local dev, use workspace path
      if (isWebExport) {
        // Let Metro resolve from node_modules naturally
        return context.resolveRequest(context, moduleName, platform);
      }
      return context.resolveRequest(
        context,
        path.join(__dirname, '../../packages/streamdown-rn/src'),
        platform,
      );
    }
    
    // Handle @ alias
    if (moduleName.startsWith('@/')) {
      return context.resolveRequest(
        context,
        path.join(__dirname, moduleName.replace('@/', './')),
        platform,
      );
    }
    
    // Default resolution - let Expo/Metro handle it
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
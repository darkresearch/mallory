const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add support for 3D model files
config.resolver.assetExts.push('glb', 'gltf', 'bin', 'obj', 'mtl', 'fbx');

// Configure module resolution
config.resolver = {
  ...config.resolver,
  // Handle @ alias and skip CSS modules
  resolveRequest: (context, moduleName, platform) => {
    // Skip CSS modules
    if (moduleName.endsWith('.module.css')) {
      return { type: 'empty' };
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
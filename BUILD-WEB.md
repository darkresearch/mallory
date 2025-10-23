# Mobile App Web Build Configuration

## Problem
The Expo web export was failing on Vercel with:
```
Error: Failed to get the SHA-1 for: /vercel/path0/app/mobile/node_modules/react/index.js.
```

This occurred because Metro bundler was trying to watch and hash files outside its project root when using monorepo workspace features.

## Root Cause
The metro.config.js was configured for local development with:
1. `watchFolders` pointing to `../../node_modules` and `../../packages`
2. Custom `nodeModulesPaths` including root-level node_modules
3. Custom `extraNodeModules` for workspace packages
4. Custom `resolveRequest` forcing specific React paths

In Vercel's build environment, these workspace features caused Metro to:
- Try to watch files outside `/vercel/path0/app/mobile`
- Attempt to hash files in locations it couldn't properly access
- Fail with SHA-1 errors

## Solution
Updated `metro.config.js` to detect web exports and simplify configuration:

### Key Changes

1. **Detect Web Exports**
   ```javascript
   const isWebExport = process.argv.includes('export') && 
                       process.argv.includes('--platform') && 
                       process.argv.includes('web');
   ```

2. **Conditional watchFolders**
   - **Local dev**: Watch `../../packages/streamdown-rn` for hot reload
   - **Web export**: Don't watch any external folders (only project root)

3. **Simplified nodeModulesPaths**
   - **Local dev**: Include both local and root node_modules
   - **Web export**: Only use `app/mobile/node_modules`

4. **Removed Custom React Resolution**
   - Removed forced React path resolution that caused hashing issues
   - Let Metro naturally resolve from node_modules

5. **Simplified extraNodeModules**
   - **Local dev**: Only map `react-native-syntax-highlighter` from root
   - **Web export**: Empty (let Metro use natural resolution)

### Updated Files

#### `metro.config.js`
- Detects when running web export
- Disables monorepo features for production builds
- Keeps them enabled for local development

#### `vercel.json`
- Simplified build command to just `npx expo export --platform web`
- Removed unnecessary environment variables
- Kept `bun install` for fast dependency installation

#### `package.json`
- Updated `web:export` script to set `EXPO_PLATFORM=web` for detection

## How It Works

### Local Development
```bash
bun start          # Uses full monorepo features
bun run android    # Uses full monorepo features
```
- Metro watches workspace packages for hot reload
- Uses root node_modules for shared dependencies
- Full monorepo support

### Production Web Build
```bash
npx expo export --platform web
```
- Metro only watches `app/mobile` directory
- Only uses `app/mobile/node_modules`
- Workspace packages (streamdown-rn) work via symlinks created by Bun
- No external file watching = no SHA-1 errors

## Workspace Package Handling

The `streamdown-rn` workspace package is handled differently:

**Local Dev:**
- Resolved directly from `../../packages/streamdown-rn/src`
- Hot reload works for package changes

**Production:**
- Bun creates symlink: `node_modules/streamdown-rn -> ../../packages/streamdown-rn`
- Metro resolves naturally from node_modules
- No custom resolution needed

## Testing

### Local Test
```bash
cd app/mobile
rm -rf dist
npx expo export --platform web
# Should build successfully and create dist/
```

### Vercel Deployment
1. Commit and push changes
2. Vercel will:
   - Run `bun install` (creates symlinks)
   - Run `npx expo export --platform web`
   - Deploy `dist/` directory

## Why This Works

1. **No External Watching**: Metro doesn't try to watch/hash files outside project root
2. **Natural Resolution**: Bun's workspace symlinks work with Metro's natural resolution
3. **Environment Detection**: Different configs for dev vs production
4. **Simpler is Better**: Less custom resolution = fewer edge cases

## Benefits

- ✅ Builds successfully on Vercel
- ✅ Maintains local development experience
- ✅ Workspace packages still work
- ✅ Fast builds with Bun
- ✅ No complex workarounds

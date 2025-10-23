# Testing Production Builds Locally

This guide helps you test your Vercel production build locally **before** deploying.

## Quick Test (Recommended)

Test with your current environment:

```bash
./test-vercel-build.sh
```

**What it does:**
- ✅ Cleans build artifacts
- ✅ Runs `bun install`
- ✅ Executes the exact Vercel build command
- ✅ Verifies output structure
- ✅ Reports bundle size and file count

**Time:** ~30 seconds

---

## Strict Test (Most Accurate)

Simulates a completely fresh Vercel environment:

```bash
./test-strict-vercel-build.sh
```

**What it does:**
- 🧹 **Removes node_modules** (like fresh checkout)
- 📦 Fresh install from lockfile
- 🔍 Verifies workspace packages
- 🔨 Production build
- ✅ Comprehensive checks

**Time:** ~2 minutes (includes full install)

⚠️ **Warning:** This removes `node_modules/` - you'll need to reinstall for local dev after

---

## Preview Built App

After building, preview in your browser:

```bash
./preview-build.sh
```

Opens a local server at `http://localhost:8080`

**Use this to:**
- 🌐 Test the built app in a browser
- 🔍 Check for runtime errors
- 📱 Test mobile responsive design
- ✨ Verify all features work in production mode

---

## Manual Testing

If you prefer manual commands:

```bash
# Clean
rm -rf dist/ .expo/ node_modules/.cache/

# Build (same command Vercel uses)
npx expo export --platform web

# Preview
cd dist && python3 -m http.server 8080
```

---

## What Success Looks Like

✅ **Successful build output:**
```
Web Bundled 2183ms app/mobile/index.ts (2612 modules)

› Assets (43)
› web bundles (1)
› Files (3)

Exported: dist
```

✅ **Expected warnings (safe to ignore):**
```
WARN  Attempted to import the module "@noble/hashes/crypto.js"
      which is not listed in the "exports"...
```
This is a known @noble/hashes issue and doesn't affect functionality.

---

## Troubleshooting

### ❌ "Failed to get SHA-1 for react"
**Problem:** Metro is trying to watch files outside the project

**Solution:** The metro.config.js should detect web exports and avoid this. If you see this error:
1. Check `metro.config.js` has the `isWebExport` detection
2. Make sure you're running `expo export --platform web` (not just `expo export`)

### ❌ "Cannot find module 'streamdown-rn'"
**Problem:** Workspace package not linked

**Solution:**
```bash
cd ../..  # Go to repo root
bun install  # Re-link workspace packages
cd app/mobile
```

### ❌ Build succeeds but app doesn't work in browser
**Problem:** Runtime error or missing dependencies

**Solution:**
1. Run `./preview-build.sh`
2. Open browser console (F12)
3. Check for errors
4. Common issues:
   - Missing environment variables
   - API endpoint configuration
   - CORS issues

---

## Comparing to Vercel

Your local test closely matches Vercel:

| Aspect | Local Test | Vercel |
|--------|-----------|--------|
| Package Manager | Bun | Bun |
| Build Command | `npx expo export --platform web` | Same |
| Node Version | Your local | Node 18-20 |
| Environment | Your machine | Linux container |
| Caching | Limited | Aggressive |

**Differences:**
- Vercel builds in a Linux container (you're likely on macOS)
- Vercel has more aggressive caching
- Vercel runs in a completely isolated environment

The **strict test** minimizes these differences.

---

## CI/CD Integration

You can use these scripts in CI:

```yaml
# GitHub Actions example
- name: Test production build
  run: |
    cd app/mobile
    ./test-vercel-build.sh
```

---

## Next Steps

1. ✅ Run `./test-vercel-build.sh` now
2. ✅ If it passes, commit and push
3. ✅ Vercel will auto-deploy
4. ✅ Check Vercel logs match your local output

**Pro tip:** Run the test before every deploy to catch issues early!

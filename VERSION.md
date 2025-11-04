# Version Management

Mallory uses synchronized semantic versioning across all packages in the monorepo.

## Quick Release (via PR)

To release a new version, include `[release: v*.*.*]` in your PR title:

```
feat: add new wallet feature [release: v0.2.0]
```

When the PR is merged to `main`:
1. ✅ All packages automatically bump to v0.2.0
2. ✅ Changes committed and tagged
3. ✅ GitHub release created with changelog
4. ✅ No manual steps required!

## Manual Release (via CLI)

```bash
# Sync all packages to new version
bun scripts/sync-version.js 0.2.0

# Commit and tag
git add .
git commit -m "chore: bump version to 0.2.0"
git tag v0.2.0
git push && git push --tags
```

## Version Display

The app displays: **`v0.1.0-1f26062`**
- `v0.1.0` = Semantic version (manual/PR-triggered bumps)
- `1f26062` = Git commit hash (auto-updates every commit)
- Location: Wallet page, below sign out button

## Files Synced

- `package.json` (root)
- `apps/client/package.json`
- `apps/server/package.json`
- `packages/shared/package.json`

## Semantic Versioning

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backwards compatible
- **PATCH** (0.0.1): Bug fixes, backwards compatible


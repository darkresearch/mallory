# Vercel Tag-Based Deployment Setup

Since Vercel doesn't natively support "Deploy on Tags", we use GitHub Actions + Vercel CLI to deploy production only when version tags are created.

## 🎯 Goal

- ✅ Merge PRs to `main` → **No production deploy** (preview only)
- ✅ Create release tag → **Production deploy**
- ✅ Works perfectly with Changesets workflow

## ⚙️ Setup Steps

### 1. Get Vercel Credentials

Run these commands locally in `apps/client/`:

```bash
cd apps/client
npm install --global vercel@latest
vercel link
```

This creates `.vercel/project.json` with your credentials.

> **Note**: The `.vercel/` folder is in `.gitignore` - it stays local and never gets committed. Your credentials remain private! 🔒

### 2. Add GitHub Secrets

Go to your GitHub repo → **Settings → Secrets and variables → Actions**

Add these three secrets:

1. **`VERCEL_TOKEN`**
   - Create at: https://vercel.com/account/tokens
   - Name it: "GitHub Actions Token"
   - Copy the token value

2. **`VERCEL_ORG_ID`**
   - Get from: `apps/client/.vercel/project.json`
   - Look for: `"orgId": "..."`

3. **`VERCEL_PROJECT_ID`**
   - Get from: `apps/client/.vercel/project.json`
   - Look for: `"projectId": "..."`

### 3. Verify Configuration

The PR already includes:

- ✅ `vercel.json` with `"git": { "deploymentEnabled": false }`
- ✅ `.github/workflows/deploy-vercel-production.yml` (deploys on tags)
- ✅ `.github/workflows/release-changesets.yml` (creates tags from Version Packages PR)

## 🔄 How It Works

### Without Changesets (Current Behavior)
```
PR merged → Vercel auto-deploys to production ❌
```

### With Changesets + Tag Deploy
```
Day 1: Merge PR #1 (with changeset) → Preview deploy only
Day 2: Merge PR #2 (with changeset) → Preview deploy only
Day 3: Merge PR #3 (with changeset) → Preview deploy only

When ready to release:
  → Run: bun changeset:version
  → Creates "Version Packages" PR
  → Merge "Version Packages" PR
  → Triggers release-changesets.yml
  → Creates tag v0.2.0
  → Triggers deploy-vercel-production.yml
  → Deploys to production 🚀
```

## 🧪 Testing

After setup, you can test it:

```bash
# 1. Create a test tag locally
git tag v0.1.1-test
git push origin v0.1.1-test

# 2. Watch GitHub Actions
# Should trigger deploy-vercel-production.yml
# Should deploy to Vercel production

# 3. Clean up
git tag -d v0.1.1-test
git push origin :refs/tags/v0.1.1-test
```

## 📋 Checklist

- [ ] Run `vercel link` in `apps/client/`
- [ ] Add `VERCEL_TOKEN` to GitHub secrets
- [ ] Add `VERCEL_ORG_ID` to GitHub secrets
- [ ] Add `VERCEL_PROJECT_ID` to GitHub secrets
- [ ] Merge this PR
- [ ] Test with a dummy tag (optional)
- [ ] Ready to use changesets!

## 🆘 Troubleshooting

**Problem**: "Vercel token is invalid"
- Solution: Regenerate token at https://vercel.com/account/tokens

**Problem**: "Project not found"
- Solution: Verify `VERCEL_PROJECT_ID` matches the one in `.vercel/project.json`

**Problem**: Still deploying on every PR
- Solution: Verify `vercel.json` has `"deploymentEnabled": false`
- Check Vercel dashboard → Settings → Git (no conflicting settings)

## 📚 References

- [Vercel Tag Deploy Guide](https://vercel.com/guides/can-you-deploy-based-on-tags-releases-on-vercel)
- [Vercel CLI Documentation](https://vercel.com/docs/cli)


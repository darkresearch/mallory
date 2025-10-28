# 🚀 Running Maestro Tests in GitHub Actions

## No Java? No Problem! Use GitHub Actions

**GitHub Actions runners have Java pre-installed** - no local setup needed!

## How to Run Tests (3 Ways)

### ⭐ Method 1: Manual Trigger (NO commit needed!)

1. Go to your repo: https://github.com/YOUR_ORG/mallory/actions
2. Click "E2E Tests (Maestro)" in the left sidebar
3. Click "Run workflow" button (top right)
4. Choose test suite:
   - `auth` - Run all authentication tests (recommended)
   - `all` - Run every test
5. Click "Run workflow"
6. ✅ Tests run in ~5-10 minutes!

**Result**: Tests run on GitHub's servers with real Mailosaur OTPs, no local setup needed!

### 🔄 Method 2: Automatic on PR

Tests run automatically when you:
- Open a pull request to `main` or `develop`
- Push new commits to an open PR

### 🎯 Method 3: Automatic on Push to Main

Tests run automatically when you:
- Merge to `main`
- Push directly to `main`

## Setup (One-Time)

### Step 1: Add GitHub Secrets

Go to: https://github.com/YOUR_ORG/mallory/settings/secrets/actions

Click "New repository secret" and add these **3 secrets**:

```
Name: MAILOSAUR_API_KEY
Value: 1LfTVNH3bCPqakZm6xmu6BWecWwnrAsP

Name: MAILOSAUR_SERVER_ID  
Value: 7kboxsdj

Name: TEST_EMAIL
Value: mallory-testing@7kboxsdj.mailosaur.net
```

**Optional** (only if using staging backend):
```
Name: TEST_BACKEND_URL
Value: https://your-staging-backend.com
```

### Step 2: Commit the Workflow

The workflow file is already created at:
`.github/workflows/maestro-e2e.yml`

Just commit and push it:

```bash
cd /Users/osprey/repos/dark/mallory
git add .github/workflows/maestro-e2e.yml
git add .maestro/
git add apps/client/maestro-mailosaur-otp.ts
git commit -m "Add Maestro E2E tests with Mailosaur integration"
git push
```

### Step 3: Enable Actions (if disabled)

Go to: https://github.com/YOUR_ORG/mallory/actions

If you see "Workflows disabled", click "I understand my workflows, go ahead and enable them"

## What Happens When Tests Run

GitHub Actions will:

1. ✅ Spin up macOS runner (has Java pre-installed!)
2. ✅ Install Maestro CLI
3. ✅ Setup iOS Simulator
4. ✅ Build your iOS app
5. ✅ Start backend server
6. ✅ Run authentication tests:
   - New user signup (with real Mailosaur OTP!)
   - Returning user login
   - Incomplete auth recovery
   - Logout flow
7. ✅ Generate test report
8. ✅ Show results in PR (if triggered by PR)

**Total time**: ~10-15 minutes

## Viewing Test Results

### In GitHub Actions UI

1. Go to Actions tab
2. Click on the workflow run
3. See test results and logs
4. Download artifacts (test recordings, screenshots)

### In Pull Requests

When tests run on a PR:
- ✅ Green checkmark = All tests passed
- ❌ Red X = Some tests failed
- Click "Details" to see which tests failed

## Advantages Over Local Testing

| Local | GitHub Actions |
|-------|---------------|
| Need Java installed | ✅ Java pre-installed |
| Need iOS simulator | ✅ Simulator auto-configured |
| Need backend running | ✅ Backend started automatically |
| Manual execution | ✅ Automatic on PR |
| Your machine busy | ✅ Runs in cloud |
| Results only visible to you | ✅ Visible to whole team |

## Cost

**FREE for:**
- ✅ Public repositories (unlimited)
- ✅ Private repositories (2,000 minutes/month free)

Maestro tests use ~15 minutes per run, so you get **~130 free test runs per month** on private repos.

## Troubleshooting

### "Secrets not found"
- Add secrets in GitHub repo settings (see Step 1 above)

### "Workflow not appearing"
- Commit and push the `.github/workflows/maestro-e2e.yml` file
- Check Actions tab is enabled

### "Tests failing"
- Click on failed workflow
- Check logs for specific error
- Most common: Backend connection issues (check TEST_BACKEND_URL secret)

## Next Steps

1. ✅ Add GitHub secrets (Step 1)
2. ✅ Commit and push workflow file (Step 2)
3. ✅ Go to Actions tab and click "Run workflow"
4. ✅ Watch your tests run with real OTPs! 🎉

---

**No Java installation needed!** Just push and run in GitHub Actions! 🚀


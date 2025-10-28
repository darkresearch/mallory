# Maestro Setup Action Plan

## ✅ What We've Created

1. **Test Framework Structure**
   - `.maestro/config.yml` - Global configuration
   - `.maestro/helpers/login.yaml` - Reusable login flow
   - `.maestro/flows/auth/` - 4 authentication test files
   - `.maestro/run-tests.sh` - Convenient test runner script

2. **CI/CD Integration**
   - `.github/workflows/maestro-e2e.yml` - GitHub Actions workflow
   - Automated test runs on every PR

3. **Documentation**
   - `.maestro/README.md` - Complete testing guide
   - `MAESTRO_SETUP.md` - Installation instructions

## 📋 Your Next Steps

### Step 1: Install Maestro (5 minutes)

```bash
# Run this command:
curl -Ls "https://get.maestro.mobile.dev" | bash

# Add to your shell config (~/.zshrc):
export PATH="$PATH:$HOME/.maestro/bin"

# Reload shell:
source ~/.zshrc

# Verify installation:
maestro --version
```

### Step 2: Create Test Gmail Account (10 minutes)

1. Go to https://accounts.google.com/signup
2. Create account: `mallory.e2e.test@gmail.com` (or similar)
3. Save credentials securely
4. Enable "Less secure app access" if needed for programmatic access

**💡 Pro Tip**: For real OTP testing, consider [Mailosaur](https://mailosaur.com/) (has free tier):
- Provides test email addresses
- API to fetch OTPs programmatically
- No manual email checking needed!

### Step 3: Configure Backend Test Mode (30 minutes)

**Option A: Fixed OTP (Easiest)**

Add to your backend `.env`:

```bash
TEST_MODE=true
TEST_EMAIL=mallory.e2e.test@gmail.com
TEST_GRID_OTP=123456
```

Then modify `apps/server/src/routes/grid.ts`:

```typescript
// In start-sign-in endpoint
if (process.env.TEST_MODE === 'true' && email === process.env.TEST_EMAIL) {
  console.log('🧪 [Test Mode] Using fixed OTP for test user');
  return res.json({
    success: true,
    user: { email, testMode: true }
  });
}

// In complete-sign-in endpoint
if (process.env.TEST_MODE === 'true' && 
    email === process.env.TEST_EMAIL && 
    otpCode === process.env.TEST_GRID_OTP) {
  console.log('🧪 [Test Mode] Auto-verifying test user');
  // Proceed with verification...
}
```

**Option B: Mailosaur Integration (Best for production)**

```bash
npm install mailosaur --save-dev
```

Then use Mailosaur API to fetch OTPs in tests.

### Step 4: Configure Local Environment (5 minutes)

```bash
# Create local environment file
cd .maestro
cp .env.example .env.local

# Edit .env.local with your test credentials
nano .env.local
```

Add:
```bash
TEST_EMAIL=mallory.e2e.test@gmail.com
TEST_GRID_OTP=123456
APP_ID=com.mallory.app
TEST_MODE=true
BACKEND_URL=http://localhost:3001
```

### Step 5: Run Your First Test (10 minutes)

```bash
# Start your app (iOS simulator)
cd apps/client
npx expo run:ios

# In another terminal, run test
cd ../..
./.maestro/run-tests.sh --suite auth

# Or run specific test:
maestro test .maestro/flows/auth/new-user-signup.yaml
```

### Step 6: Configure GitHub Secrets (10 minutes)

1. Go to your GitHub repo: Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add these secrets:

```
Name: TEST_EMAIL
Value: mallory.e2e.test@gmail.com

Name: TEST_GRID_OTP
Value: 123456

Name: TEST_BACKEND_URL
Value: https://your-staging-api.com

Name: MAESTRO_CLOUD_API_KEY (optional)
Value: (get from maestro.mobile.dev)
```

### Step 7: Enable GitHub Actions (2 minutes)

1. Go to your repo: Actions tab
2. Enable workflows if disabled
3. Next PR will automatically run tests!

## 🎯 Testing Your Setup

### Quick Test Checklist

- [ ] Maestro CLI installed and working
- [ ] Test Gmail account created
- [ ] Backend test mode configured
- [ ] Local .env.local file created
- [ ] Can run: `maestro test .maestro/flows/auth/new-user-signup.yaml`
- [ ] Test passes successfully
- [ ] GitHub secrets configured
- [ ] GitHub Actions workflow enabled

### Verify Each Test

```bash
# Test 1: New user signup
maestro test .maestro/flows/auth/new-user-signup.yaml

# Test 2: Returning user
maestro test .maestro/flows/auth/returning-user.yaml

# Test 3: Incomplete auth recovery
maestro test .maestro/flows/auth/incomplete-auth-recovery.yaml

# Test 4: Logout
maestro test .maestro/flows/auth/logout.yaml
```

## 💰 Cost Summary

### What's Free
- ✅ Maestro CLI (forever)
- ✅ Local test execution
- ✅ GitHub Actions integration
- ✅ Unlimited tests

### Optional Paid Services
- **Mailosaur** (email testing): Free tier → $29/month for more emails
- **Maestro Cloud** (parallel tests): Free trial → $40/month for teams

**Recommendation**: Start 100% free, upgrade only if needed!

## 🐛 Troubleshooting

### "Maestro command not found"
```bash
# Add to ~/.zshrc:
export PATH="$PATH:$HOME/.maestro/bin"
source ~/.zshrc
```

### "Element not found" errors
```bash
# Use Maestro Studio to inspect your app:
maestro studio

# Find the correct element IDs/text
# Update test files with correct selectors
```

### Tests timeout waiting for OAuth
- Ensure OAuth redirect URLs are configured
- Check if Google OAuth works manually in app
- Consider using deep links to simulate OAuth return

### Backend not using test OTP
- Verify `TEST_MODE=true` in backend `.env`
- Check backend logs during test run
- Ensure test email matches exactly

## 📞 Getting Help

1. **Maestro Discord**: https://discord.gg/mobile-dev
2. **Maestro Docs**: https://maestro.mobile.dev/
3. **GitHub Issues**: https://github.com/mobile-dev-inc/maestro/issues

## 🚀 Next Level (Future Enhancements)

Once basics are working, consider:

1. **More test coverage**
   - Chat functionality tests
   - Wallet operations tests
   - Settings and profile tests

2. **Performance testing**
   - Measure app startup time
   - Track auth flow duration
   - Monitor for regressions

3. **Visual regression testing**
   - Screenshot comparison
   - UI consistency checks

4. **Maestro Cloud**
   - Parallel test execution
   - Cross-device testing (iOS + Android)
   - Faster CI/CD runs

## ✨ Success Metrics

After setup, you should achieve:
- ✅ 100% auth flow test coverage
- ✅ Tests run in < 5 minutes
- ✅ Zero manual testing for auth regressions
- ✅ Confidence to refactor auth code
- ✅ Automated PR checks

---

**Ready to start?** Run: `curl -Ls "https://get.maestro.mobile.dev" | bash`

Good luck! 🎉


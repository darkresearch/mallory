# 🎯 Dynamic Mailosaur Emails for Maestro

## Problem: Testing Fresh Users

Sometimes you need to test a **brand new user** who has never signed up before:
- Testing first-time signup flow
- Testing beginner → advanced Grid migration
- Ensuring no cached sessions interfere

## Solution: Mailosaur Wildcard Emails! 🎉

Your Mailosaur domain (`7kboxsdj.mailosaur.net`) accepts **ANY email address**:

```
✅ test-123@7kboxsdj.mailosaur.net
✅ test-456@7kboxsdj.mailosaur.net  
✅ user-abc@7kboxsdj.mailosaur.net
✅ anything-you-want@7kboxsdj.mailosaur.net
```

All emails go to your Mailosaur inbox!

## How It Works

### Static Email (Returning User)
```yaml
# Fixed email - same user every test
TEST_EMAIL: mallory-testing@7kboxsdj.mailosaur.net
```
- ✅ Good for: Testing returning user flow
- ✅ Good for: Faster tests (Grid account already exists)
- ❌ Bad for: Testing first-time signup

### Dynamic Email (Brand New User)
```yaml
# Generate unique email per test
- runScript: |
    UUID=$(uuidgen | tr '[:upper:]' '[:lower:]')
    echo "test-${UUID}@7kboxsdj.mailosaur.net"
```
- ✅ Good for: Testing first-time signup
- ✅ Good for: Clean slate every test
- ✅ Good for: Parallel test execution (no conflicts)
- ❌ Takes longer (Grid creates new account each time)

## Test Files Created

### 1. Static Email (Returning User)
**File**: `.maestro/flows/auth/new-user-signup-auto.yaml`
**Email**: `mallory-testing@7kboxsdj.mailosaur.net` (fixed)
**Use**: Fast tests, returning user scenario

### 2. Dynamic Email (Fresh User Every Time)
**File**: `.maestro/flows/auth/new-user-dynamic-email.yaml`  
**Email**: `test-UUID@7kboxsdj.mailosaur.net` (unique per run)
**Use**: True first-time user tests, clean state

## Example: Test Suite

```yaml
# Run both types of tests
maestro test .maestro/flows/auth/new-user-signup-auto.yaml  # Static
maestro test .maestro/flows/auth/new-user-dynamic-email.yaml  # Dynamic
```

## GitHub Actions Support

Both test types work in GitHub Actions! The workflow automatically:
1. Generates UUID for dynamic email
2. Passes it to Mailosaur OTP script
3. Fetches OTP from Mailosaur
4. Completes signup

## Cost Implications

### Static Email
- Grid account created **once**
- Reused for all tests
- ✅ Faster, cheaper

### Dynamic Email  
- Grid account created **every test run**
- Fresh state every time
- ⚠️ Slightly slower (adds ~10s for Grid account creation)

## Best Practice: Use Both!

```yaml
# CI/CD Pipeline
stages:
  - smoke:
      # Quick check with existing user
      - new-user-signup-auto.yaml  # Static email
  
  - full:
      # Thorough test with fresh user
      - new-user-dynamic-email.yaml  # Dynamic email
```

## Migration Path

If you're migrating existing users to Grid "advanced" status:

1. **Static email test** - Tests that migration works (existing user)
2. **Dynamic email test** - Tests that new users work correctly

Both scenarios covered! 🎉

## Command Examples

```bash
# Test with static email (faster)
maestro test .maestro/flows/auth/new-user-signup-auto.yaml

# Test with dynamic email (fresh user)
maestro test .maestro/flows/auth/new-user-dynamic-email.yaml

# Run both
maestro test .maestro/flows/auth/new-user-*.yaml
```

---

**Result**: You can now test both **returning users** (fast) and **brand new users** (thorough) using the same Mailosaur account! 🚀


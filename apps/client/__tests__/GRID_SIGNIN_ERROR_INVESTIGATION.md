# Grid Sign-in Error Investigation

## Problem Statement
Users are experiencing "Invalid email and code combination" errors during Grid sign-in, showing:
- UI: "Invalid code, please check and try again"
- Backend: 400 Bad Request with "Invalid email and code combination"
- Source: `/api/grid/complete-sign-in` endpoint

## Test Results

### ✅ Test 1: Invalid OTP Code
**Status**: Confirmed error replication
**Scenario**: Submit wrong OTP (000000)
**Result**: 
```
Response status: 400
Error: "Invalid email and code combination"
```
**Conclusion**: This is the expected behavior for wrong codes.

### ❌ Test 2: Expired OTP (Multiple Requests)
**Status**: Unexpected behavior discovered
**Scenario**: Request new OTP, then use old OTP
**Result**: 
```
Response status: 200
Success: true
```
**Conclusion**: Grid allows reusing old OTPs even after requesting new ones! This is NOT the cause.

## Likely Root Causes

Based on test results and the error pattern, the most likely causes are:

### 1. **User Typos / Wrong Code Entry** ⭐ Most Likely
- User mistypes the 6-digit code
- User uses code from wrong email (if they have multiple accounts)
- User copies code incorrectly (extra spaces, wrong digits)

### 2. **Session Storage Issues**
- `user` object from `start-sign-in` not properly stored
- React state gets corrupted between start and complete
- User data modified in transit

### 3. **Race Conditions in UI**
- Multiple OTP requests triggered
- User clicks "Verify" multiple times
- First attempt succeeds, second fails

### 4. **Email Confusion**
- User has multiple Mallory accounts
- User receives OTP for different email
- User tries to use OTP from old session

## Recommended Next Steps

### 1. Add Better Error Messages
Current: "Invalid email and code combination"
Better:
- "Invalid code. Please check your email and try again."
- "Code expired. Click 'Resend Code' to get a new one."
- "Too many attempts. Please wait before trying again."

### 2. Add UI Validation
- Trim whitespace from OTP input
- Only accept 6 digits
- Disable submit button during verification
- Show countdown timer for OTP expiry

### 3. Add Debugging Instrumentation
```typescript
// Log to help diagnose user issues
console.log('OTP attempt', {
  email: user.email,
  otpLength: otp.length,
  otpTrimmed: otp.trim(),
  userEmail: user.email,
  timestamp: new Date().toISOString()
});
```

### 4. Add Client-Side Validation Test
Create a test that simulates the UI behavior:
- Stores user object in React state
- Waits for OTP
- Submits verification
- Checks for state corruption

## Additional Tests to Run

### Test 5: Rapid Double-Submit ✅ Written
Tests what happens when user clicks "Verify" twice quickly.

### Test 6: Modified User Data ✅ Written  
Tests if user object gets corrupted between requests.

### Test 7: Timing Issues ✅ Written
Tests premature OTP retrieval.

## Quick Fix Recommendations

### UI Level (Immediate):
```typescript
// In OTP verification component
const handleVerify = async (otp: string) => {
  // Trim and validate
  const cleanOtp = otp.trim();
  if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
    setError('Please enter a valid 6-digit code');
    return;
  }
  
  // Prevent double-submit
  if (isVerifying) return;
  setIsVerifying(true);
  
  try {
    await completeSignIn(user, cleanOtp);
  } catch (error) {
    // Better error message
    setError('Invalid code. Please check your email and try again.');
  } finally {
    setIsVerifying(false);
  }
};
```

### Backend Level:
```typescript
// Add more specific error messages
if (error.message.includes('invalid')) {
  return { 
    success: false, 
    error: 'Invalid verification code',
    hint: 'Please check your email for the correct code' 
  };
}
```

## Monitoring Recommendations

Add metrics to track:
1. OTP verification failure rate
2. Time between OTP request and verification
3. Number of retry attempts per user
4. Most common error patterns

## Running Error Tests

```bash
# Run all error scenarios
bun run test:signup:errors

# Run specific scenario
bun test __tests__/e2e/signup-error-scenarios.test.ts --test-name-pattern "invalid OTP"
```

## Next Investigation Steps

1. Check backend logs for failed verification attempts
2. Look for patterns in which users experience this
3. Check if specific browsers/devices more affected
4. Verify Grid API documentation for OTP expiry rules
5. Test with actual user workflow (manual typing, copy/paste)


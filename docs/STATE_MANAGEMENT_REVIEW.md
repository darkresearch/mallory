# State Management Review

> **⚠️ NOTE:** This document is outdated as of 2025-10-30. Major cleanup has been completed:
> - `OtpVerificationModal.tsx` has been deleted (duplicate of verify-otp screen)
> - `AuthGate.tsx` has been deleted (logic moved to AuthContext)
> - `AuthCarousel.tsx` has been deleted (replaced with simple button)
> - See [CLEANUP_SUMMARY.md](/CLEANUP_SUMMARY.md) for details

**Date:** October 29, 2025  
**Status:** 🔴 Action Required

## Executive Summary

Our app has generally good state management practices with well-separated contexts and smart data loading patterns. However, `AuthContext` has grown to 841 lines with overlapping responsibilities, and we have some opportunities to reduce complexity through consolidation and refactoring.

---

## 🟢 Strengths - What's Working Well

### 1. Clean Context Architecture
- ✅ Three well-separated contexts: `AuthContext`, `ConversationsContext`, `WalletContext`
- ✅ Each context has a single, clear responsibility
- ✅ Proper provider nesting in `_layout.tsx`
- ✅ No prop drilling issues

### 2. Smart Data Loading
- ✅ Background initialization with `isInitialized` flags
- ✅ Wallet and conversations load lazily without blocking UI
- ✅ Proper cache management with `hasFreshCache()` checks
- ✅ Auto-refresh on app focus

### 3. Guard Patterns
- ✅ Excellent use of refs for guards (e.g., `verificationInProgress`, `isLoggingOut`, `isInitiatingGridSignIn`)
- ✅ Prevents double-submissions and race conditions
- ✅ Atomic check-and-set patterns

### 4. Separation of Concerns
- ✅ Hooks properly extract logic from screens (`useChatState`, `useAIChat`, `useConversationLoader`)
- ✅ Screens are mostly presentational
- ✅ Service layer for data fetching

---

## 🟡 Moderate Concerns - Room for Simplification

### 1. AuthContext is VERY Complex (841 lines!)

**File:** `apps/client/contexts/AuthContext.tsx`

**The Issue:**
AuthContext handles too many responsibilities:
- ✓ Authentication flow (Google OAuth)
- ✓ Grid wallet integration
- ✓ OTP verification orchestration
- ✓ Session management (Supabase + Grid)
- ✓ Re-auth checking
- ✓ Token refresh validation
- ✓ Comprehensive logout (9+ steps)
- ✓ Navigation/routing logic
- ✓ sessionStorage management

**Metrics:**
- **Lines:** 841
- **State Variables:** 8 (`user`, `isLoading`, `needsReauth`, `isCheckingReauth`, `isSigningIn`, etc.)
- **Refs:** 4 (`hasCheckedReauth`, `isInitiatingGridSignIn`, `isLoggingOut`)
- **Effects:** 5
- **Functions:** 12+

**Why it matters:**
At 841 lines with multiple refs and overlapping flags, it's hard to reason about all the edge cases. The multiple guard refs suggest concerns that might be better separated.

**Recommendation:**
Split into 3 focused contexts:
```
AuthContext          → Just: user, isAuthenticated, login, logout (core auth)
GridContext          → Just: Grid wallet state, sign-in flow, OTP management
SessionContext       → Just: Token refresh, re-auth checking, session validation
```

**Priority:** 🔴 High  
**Effort:** 🔨🔨🔨 Large (2-3 hours)  
**Impact:** ⭐⭐⭐ High (better maintainability, clearer separation)

---

### 2. useChatState Has Multiple Overlapping State Variables

**File:** `apps/client/hooks/useChatState.ts`

**The Issue:**
```typescript
const [showImmediateReasoning, setShowImmediateReasoning] = useState(false);
const [hasInitialReasoning, setHasInitialReasoning] = useState(false);
const [isThinking, setIsThinking] = useState(false);
const [hasStreamStarted, setHasStreamStarted] = useState(false);
const [isOnboardingGreeting, setIsOnboardingGreeting] = useState(false);
```

These 5 boolean flags track different aspects of the same streaming state. It's easy to get them out of sync.

**Recommendation:**
Use a state machine or single discriminated union:
```typescript
type StreamingState = 
  | { status: 'idle' }
  | { status: 'thinking', reasoningVisible: boolean }
  | { status: 'streaming', hasReasoning: boolean, isOnboarding: boolean }
  | { status: 'complete', duration: number };

const [streamingState, setStreamingState] = useState<StreamingState>({ 
  status: 'idle' 
});
```

**Priority:** 🟡 Medium  
**Effort:** 🔨 Small (30 min)  
**Impact:** ⭐⭐ Medium (clearer state transitions, fewer bugs)

---

### 3. Verify OTP Screen Has Duplicated State Logic

**Files:**
- `apps/client/app/(auth)/verify-otp.tsx` (420 lines)
- `apps/client/components/grid/OtpVerificationModal.tsx` (280 lines)

**The Issue:**
Both files have nearly identical state management:
- `otp`, `setOtp`
- `isVerifying`, `setIsVerifying`
- `error`, `setError`
- `gridUser` handling
- `verificationInProgress` ref
- Same validation logic
- Same resend logic
- Same verification flow

**Recommendation:**
Extract into a shared `useOtpVerification` hook:
```typescript
function useOtpVerification(email: string, gridUser: any) {
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const verificationInProgress = useRef(false);
  
  const handleVerify = async () => { /* shared logic */ };
  const handleResend = async () => { /* shared logic */ };
  const handleOtpChange = (text: string) => { /* shared validation */ };
  
  return { 
    otp, 
    setOtp: handleOtpChange,
    isVerifying, 
    error, 
    handleVerify, 
    handleResend 
  };
}
```

**Priority:** 🟡 Medium  
**Effort:** 🔨 Small (45 min)  
**Impact:** ⭐⭐ Medium (DRY, single source of truth for OTP logic)

---

## 🔴 Concerning - Needs Attention

### 1. sessionStorage State Restoration Pattern

**File:** `apps/client/contexts/AuthContext.tsx`

**The Issue:**
```typescript
// RESTORE isSigningIn from sessionStorage on app init (after OAuth redirect)
useEffect(() => {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const oauthInProgress = sessionStorage.getItem('mallory_oauth_in_progress') === 'true';
    if (oauthInProgress) {
      console.log('🔐 [Init] Restoring isSigningIn=true from sessionStorage');
      setIsSigningIn(true);
    }
  }
}, []);
```

Mixing persistent (sessionStorage) and ephemeral (React state) creates multiple sources of truth:
- sessionStorage might not match React state
- Hard to debug when they diverge
- Unclear which is authoritative
- Manual sync required in multiple places

**Similar patterns found:**
- `mallory_oauth_in_progress` (set in 3 places, read in 2)
- `mallory_grid_user` (set in 2 places, read in 2)
- `mallory_grid_is_existing_user` (cleared but rarely used)

**Recommendation:**
Pick one source of truth:

**Option A:** Always read from sessionStorage (make it the source of truth)
```typescript
// Create a reactive hook
function useSessionStorage(key: string, defaultValue: any) {
  const [value, setValue] = useState(() => 
    sessionStorage.getItem(key) ? JSON.parse(sessionStorage.getItem(key)!) : defaultValue
  );
  
  useEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  
  return [value, setValue];
}
```

**Option B:** Only use React state and persist to URL params
```typescript
// Use router params instead of sessionStorage
router.push('/(auth)/verify-otp?oauth_in_progress=true');
```

**Priority:** 🔴 High  
**Effort:** 🔨🔨 Medium (1 hour)  
**Impact:** ⭐⭐⭐ High (single source of truth, easier debugging)

---

### 2. ConversationsContext Real-time Setup is Overcomplicated

**File:** `apps/client/contexts/ConversationsContext.tsx`

**The Issue:**
The real-time subscription setup is 153 lines (lines 212-364) with:
- Deeply nested try-catch blocks
- Excessive logging (30+ console.log statements)
- Multiple layers of payload transformation
- Repeated status checking
- Complex error handling

**Recommendation:**
Extract into a separate service:
```typescript
// lib/supabase/realtime-service.ts
export class RealtimeService {
  async subscribeToConversations(
    userId: string, 
    handlers: {
      onInsert: (record: any) => void;
      onUpdate: (record: any) => void;
      onDelete: (record: any) => void;
    }
  ) {
    const session = await this.getAuthSession();
    if (!session) throw new Error('No auth session');
    
    await supabase.realtime.setAuth(session.access_token);
    
    const channel = supabase
      .channel(`conversations:user:${userId}`, { config: { private: true } })
      .on('broadcast', { event: 'INSERT' }, (payload) => 
        handlers.onInsert(this.parsePayload(payload))
      )
      .on('broadcast', { event: 'UPDATE' }, (payload) => 
        handlers.onUpdate(this.parsePayload(payload))
      )
      .on('broadcast', { event: 'DELETE' }, (payload) => 
        handlers.onDelete(this.parsePayload(payload))
      )
      .subscribe();
    
    return channel;
  }
  
  private parsePayload(payload: any) {
    return payload.payload?.record || payload.record || payload.new || payload;
  }
}
```

**Priority:** 🟡 Medium  
**Effort:** 🔨🔨 Medium (1 hour)  
**Impact:** ⭐⭐ Medium (cleaner code, easier testing)

---

### 3. Modal State is Split Between Props and Local State

**Files:**
- `apps/client/components/grid/OtpVerificationModal.tsx`
- `apps/client/components/wallet/SendModal.tsx`

**The Issue:**
```typescript
export default function OtpVerificationModal({
  visible,      // ← Controlled by parent
  onClose,
  userEmail,    // ← Passed from parent
  gridUser      // ← Also passed from parent
}: OtpVerificationModalProps) {
  const [otp, setOtp] = useState('');  // ← Local state
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
```

Mixing controlled (visible, gridUser) and uncontrolled (otp, error) patterns makes it unclear who owns what state.

**Recommendation:**
Choose one pattern:

**Option A: Fully Controlled** (parent manages all state)
```typescript
interface OtpVerificationModalProps {
  visible: boolean;
  otp: string;
  onOtpChange: (otp: string) => void;
  error: string;
  onErrorChange: (error: string) => void;
  isVerifying: boolean;
  onVerify: () => Promise<void>;
  onResend: () => Promise<void>;
}
```

**Option B: Fully Uncontrolled** (modal manages all internal state)
```typescript
interface OtpVerificationModalProps {
  visible: boolean;
  email: string;
  gridUser: GridUser;
  onSuccess: (result: GridUser) => void;
  onError: (error: Error) => void;
  onClose: () => void;
}
```

**Recommendation:** Option B (fully uncontrolled) is better for modals - they're self-contained UI components.

**Priority:** 🟢 Low  
**Effort:** 🔨 Small (15 min)  
**Impact:** ⭐ Low (clearer API, but works fine as-is)

---

## 📊 State Management Metrics

| Context/Hook | Lines | State Vars | Refs | Effects | Complexity | Status |
|--------------|-------|------------|------|---------|------------|--------|
| AuthContext | 841 | 8 | 4 | 5 | 🔴 Very High | Needs refactor |
| ConversationsContext | 568 | 4 | 0 | 3 | 🟡 High | Could simplify |
| WalletContext | 177 | 5 | 0 | 4 | 🟢 Good | ✅ |
| useChatState | 313 | 8 | 3 | 4 | 🟡 Medium | Could consolidate |
| useAIChat | 220 | 2 | 1 | 3 | 🟢 Good | ✅ |
| useConversationLoader | 58 | 1 | 0 | 1 | 🟢 Good | ✅ |
| SendModal | 303 | 6 | 0 | 1 | 🟢 Good | ✅ |
| OtpVerificationModal | 280 | 4 | 1 | 1 | 🟢 Good | Duplicate logic |
| VerifyOtpScreen | 420 | 4 | 1 | 3 | 🟢 Good | Duplicate logic |

---

## 🎯 Recommended Action Plan

### Phase 1: High Priority (Do First)
1. **Split AuthContext** into 3 contexts
   - 🔴 Priority: High
   - 🔨 Effort: 2-3 hours
   - ⭐ Impact: High

2. **Fix sessionStorage pattern**
   - 🔴 Priority: High  
   - 🔨 Effort: 1 hour
   - ⭐ Impact: High

### Phase 2: Medium Priority (Do Next)
3. **Consolidate streaming state** in useChatState
   - 🟡 Priority: Medium
   - 🔨 Effort: 30 min
   - ⭐ Impact: Medium

4. **Extract useOtpVerification hook**
   - 🟡 Priority: Medium
   - 🔨 Effort: 45 min
   - ⭐ Impact: Medium

5. **Simplify realtime subscriptions**
   - 🟡 Priority: Medium
   - 🔨 Effort: 1 hour
   - ⭐ Impact: Medium

### Phase 3: Nice to Have
6. **Standardize modal state patterns**
   - 🟢 Priority: Low
   - 🔨 Effort: 15 min
   - ⭐ Impact: Low

---

## 📝 Notes

- Overall, the state management architecture is solid
- Main issue is AuthContext grew too large over time
- Most hooks and components follow good patterns
- No critical bugs or urgent issues
- Refactoring is for maintainability, not functionality

---

## 🔗 Related Documents

- [Grid Auth Pattern](./grid-auth-pattern.md)
- [Contributing Guide](../CONTRIBUTING.md)
- [Quick Start](../QUICK_START.md)


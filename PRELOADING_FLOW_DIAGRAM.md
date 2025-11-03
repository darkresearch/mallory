# Navigation Flow with Preloading

## Before Fix

```
User Login (OTP)
    ↓
Wallet Screen
    ↓ (user clicks back)
Chat Screen → ⏳ Loading conversation... → ⏳ Loading messages...
    ↓ (finally loaded, user clicks history)
Chat History Screen → ⏳ Loading all conversations... → ⏳ Loading all messages...
```

**Result**: Slow, janky experience with visible loading states

## After Fix

```
User Login (OTP)
    ↓
Wallet Screen
    ├─→ 🔄 useChatPreloader (background)
    │   └─→ Loads active conversation + messages
    └─→ 🔄 useChatHistoryPreloader (background)
        └─→ Loads all conversations + all messages
    ↓ (user clicks back - data already loaded!)
Chat Screen → ✅ Instant!
    └─→ 🔄 useChatHistoryPreloader (background, if not already loaded)
        └─→ Loads all conversations + all messages
    ↓ (user clicks history - data already loaded!)
Chat History Screen → ✅ Instant!
```

**Result**: Instant, smooth navigation with no visible loading

## Preloader Coverage

| Navigation Path | Preloader Used | Where Initiated |
|----------------|----------------|-----------------|
| Wallet → Chat | `useChatPreloader` | Wallet Screen |
| Wallet → Chat History | `useChatHistoryPreloader` | Wallet Screen |
| Chat → Chat History | `useChatHistoryPreloader` | Chat Screen |

## Data Preloaded

### useChatPreloader
- ✓ Active conversation ID
- ✓ Messages for active conversation
- ✗ Other conversations

### useChatHistoryPreloader  
- ✓ All conversations
- ✓ All messages for all conversations
- ✓ Grouped by conversation for fast lookup

## Example Console Output

```
# On Wallet Screen mount:
🔄 [WalletScreen] Chat preload status: { isPreloading: true, isPreloaded: false }
🔄 [WalletScreen] Chat history preload status: { isPreloading: true, isPreloaded: false }
🔄 [ChatPreloader] Starting background preload of chat data
🔄 [ChatPreloader] Loading active conversation...
🔄 [ChatHistoryPreloader] Starting background preload of chat history data
🔄 [ChatHistoryPreloader] Loading all conversations...
🔄 [ChatPreloader] Active conversation: abc-123-def
🔄 [ChatPreloader] Preloading messages...
🔄 [ChatHistoryPreloader] Loaded 5 conversations
🔄 [ChatHistoryPreloader] Loading messages for 5 conversations...
🔄 [ChatPreloader] Preloaded 42 messages
✅ [ChatPreloader] Chat data preloaded successfully
🔄 [ChatHistoryPreloader] Preloaded 186 messages across 5 conversations
✅ [ChatHistoryPreloader] Chat history data preloaded successfully
🔄 [WalletScreen] Chat preload status: { isPreloading: false, isPreloaded: true }
🔄 [WalletScreen] Chat history preload status: { isPreloading: false, isPreloaded: true }

# User navigates to Chat Screen:
# → Loads instantly! No loading state shown

# User navigates to Chat History:
# → Loads instantly! All conversations and messages already in memory
```

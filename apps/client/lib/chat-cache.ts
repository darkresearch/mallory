/**
 * Module-level chat cache - persists across component mount/unmount cycles
 * Similar pattern to useChatHistoryData cache
 */

/**
 * StreamState - Single discriminated union for all streaming states
 */
type StreamState = 
  | { status: 'idle' }
  | { status: 'waiting'; startTime: number }
  | { status: 'reasoning'; startTime: number }
  | { status: 'responding'; startTime: number }

/**
 * Chat functions exposed by ChatManager for React Native
 */
interface ChatFunctions {
  sendMessage?: (message: { text: string }) => void;
  stop?: () => void;
  regenerate?: () => void;
}

/**
 * Active chat cache structure
 */
interface ActiveChatCache {
  conversationId: string | null;
  messages: any[]; // Messages from useChat hook
  streamState: StreamState;
  liveReasoningText: string;
  aiStatus: 'ready' | 'streaming' | 'error';
  aiError: Error | null;
  isLoadingHistory: boolean;
  chatFunctions?: ChatFunctions; // Exposed by ChatManager for React Native
}

/**
 * Module-level cache (survives navigation)
 * Single cache for active conversation (simple approach)
 */
const activeChatCache: ActiveChatCache = {
  conversationId: null,
  messages: [],
  streamState: { status: 'idle' },
  liveReasoningText: '',
  aiStatus: 'ready',
  aiError: null,
  isLoadingHistory: false,
  chatFunctions: undefined,
};

/**
 * Subscribers that listen to cache updates
 */
type CacheSubscriber = (cache: ActiveChatCache) => void;
const subscribers: Set<CacheSubscriber> = new Set();

/**
 * Get the current cache state
 */
export function getChatCache(): ActiveChatCache {
  return { ...activeChatCache };
}

/**
 * Update cache and notify subscribers
 */
export function updateChatCache(updates: Partial<ActiveChatCache>) {
  const oldConversationId = activeChatCache.conversationId;
  const oldMessagesLength = activeChatCache.messages.length;
  
  Object.assign(activeChatCache, updates);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 [chat-cache] updateChatCache CALLED');
  console.log('   Updates:', JSON.stringify({
    conversationId: updates.conversationId,
    messagesCount: updates.messages?.length,
    aiStatus: updates.aiStatus,
    isLoadingHistory: updates.isLoadingHistory,
    streamState: updates.streamState
  }, null, 2));
  console.log('   Cache state AFTER update:');
  console.log('   - conversationId:', activeChatCache.conversationId);
  console.log('   - messages.length:', activeChatCache.messages.length);
  console.log('   - aiStatus:', activeChatCache.aiStatus);
  console.log('   - isLoadingHistory:', activeChatCache.isLoadingHistory);
  console.log('   Notifying', subscribers.size, 'subscribers');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Notify all subscribers
  subscribers.forEach(subscriber => {
    subscriber(getChatCache());
  });
}

/**
 * Subscribe to cache changes
 */
export function subscribeToChatCache(subscriber: CacheSubscriber): () => void {
  subscribers.add(subscriber);
  
  // Return unsubscribe function
  return () => {
    subscribers.delete(subscriber);
  };
}

/**
 * Clear cache for conversation switch
 */
export function clearChatCache() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧹 [chat-cache] clearChatCache CALLED');
  console.log('   Old cache state:');
  console.log('   - conversationId:', activeChatCache.conversationId);
  console.log('   - messages.length:', activeChatCache.messages.length);
  
  activeChatCache.conversationId = null;
  activeChatCache.messages = [];
  activeChatCache.streamState = { status: 'idle' };
  activeChatCache.liveReasoningText = '';
  activeChatCache.aiStatus = 'ready';
  activeChatCache.aiError = null;
  activeChatCache.isLoadingHistory = false;
  
  console.log('   New cache state: ALL CLEARED');
  console.log('   Notifying', subscribers.size, 'subscribers');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Notify subscribers
  subscribers.forEach(subscriber => {
    subscriber(getChatCache());
  });
}

/**
 * Check if cache is for a specific conversation
 */
export function isCacheForConversation(conversationId: string | null): boolean {
  return activeChatCache.conversationId === conversationId;
}

export type { ActiveChatCache, StreamState, ChatFunctions };


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
  Object.assign(activeChatCache, updates);
  
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
  activeChatCache.conversationId = null;
  activeChatCache.messages = [];
  activeChatCache.streamState = { status: 'idle' };
  activeChatCache.liveReasoningText = '';
  activeChatCache.aiStatus = 'ready';
  activeChatCache.aiError = null;
  activeChatCache.isLoadingHistory = false;
  
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

export type { ActiveChatCache, StreamState };


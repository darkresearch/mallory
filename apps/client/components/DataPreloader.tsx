import { useAuth } from '../contexts/AuthContext';
import { useChatHistoryData } from '../hooks/useChatHistoryData';
import { ErrorBoundary } from './ui/ErrorBoundary';

/**
 * DataPreloader Component
 * 
 * Silently pre-loads chat history data in the background at app level.
 * This ensures data is already cached when users navigate to chat-history screen.
 * 
 * How it works:
 * - Calls useChatHistoryData hook which loads and caches data
 * - Data persists in module-level cache across navigations
 * - Real-time subscriptions keep cache fresh
 * - Doesn't render anything (invisible to user)
 */
function DataPreloaderInner() {
  const { user } = useAuth();

  // Pre-load chat history data in background
  // This populates the module-level cache in useChatHistoryData
  useChatHistoryData(user?.id);

  // Don't render anything
  return null;
}

/**
 * DataPreloader with Error Boundary
 */
export function DataPreloader() {
  return (
    <ErrorBoundary level="feature" name="DataPreloader">
      <DataPreloaderInner />
    </ErrorBoundary>
  );
}

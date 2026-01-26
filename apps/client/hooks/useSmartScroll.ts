/**
 * useSmartScroll - Simplified auto-scroll hook for chat applications
 * 
 * Automatically scrolls to bottom when new content is added, but only if
 * the user is already at the bottom. Much simpler than the previous version
 * to avoid race conditions and state synchronization issues.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { ScrollView, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

interface UseSmartScrollReturn {
  scrollViewRef: React.RefObject<ScrollView>;
  isAtBottom: boolean;
  showScrollButton: boolean;
  scrollToBottom: () => void;
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  handleContentSizeChange: (contentWidth: number, contentHeight: number) => void;
}

const BOTTOM_THRESHOLD = 50;

/**
 * Check if scroll position is at bottom
 * Pure function - moved outside component for better performance
 */
const checkIfAtBottom = (
  layoutHeight: number,
  contentHeight: number,
  scrollY: number
): boolean => {
  if (contentHeight <= layoutHeight) return true;
  return (contentHeight - (layoutHeight + scrollY)) <= BOTTOM_THRESHOLD;
};

/**
 * Helper to safely clear timeout refs
 */
const clearTimeoutSafe = (ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
  if (ref.current) {
    clearTimeout(ref.current);
    ref.current = null;
  }
};

export const useSmartScroll = (): UseSmartScrollReturn => {
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Single state source - no dual ref/state tracking
  const [isAtBottom, setIsAtBottom] = useState(true);
  
  // Derived state - no separate useState needed
  const showScrollButton = !isAtBottom;
  
  // Track if we're in auto-scroll mode (prevents showing button during auto-scroll)
  const isAutoScrollingRef = useRef(false);
  
  // Ref to track isAtBottom for use in callbacks (avoids stale closures)
  const isAtBottomRef = useRef(true);
  
  // Track last known position to detect content growth
  const lastContentHeightRef = useRef<number>(0);
  
  // Track last scroll position to detect scroll direction (for canceling auto-scroll)
  const lastScrollYRef = useRef<number>(0);
  
  // Single debounce timeout for scroll detection
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Single timeout for auto-scroll completion
  const autoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  /**
   * Scroll to bottom - simple, no promises needed
   * @param animated - whether to animate the scroll (default: true for manual, false for auto)
   */
  const scrollToBottom = useCallback((animated: boolean = true) => {
    if (!scrollViewRef.current) return;

    // Clear any pending auto-scroll timeout
    clearTimeoutSafe(autoScrollTimeoutRef);

    // Mark as auto-scrolling
    isAutoScrollingRef.current = true;
    
    // Scroll - animated for manual clicks, instant for streaming updates
    scrollViewRef.current.scrollToEnd({ animated });
    
    // Reset auto-scroll flag after scroll completes
    autoScrollTimeoutRef.current = setTimeout(() => {
      isAutoScrollingRef.current = false;
      setIsAtBottom(true);
      autoScrollTimeoutRef.current = null;
    }, animated ? 300 : 100);
  }, []);

  /**
   * Handle scroll events - update state, detect user vs auto scroll
   */
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    
    const atBottom = checkIfAtBottom(
      layoutMeasurement.height,
      contentSize.height,
      contentOffset.y
    );

    // Detect scroll direction: decreasing scrollY = scrolling up (away from bottom)
    const currentScrollY = contentOffset.y;
    const scrollingAway = currentScrollY < lastScrollYRef.current;
    lastScrollYRef.current = currentScrollY;

    // If we're auto-scrolling, check if user scrolled away
    if (isAutoScrollingRef.current) {
      if (atBottom) {
        // Reached bottom - auto-scroll complete
        setIsAtBottom(true);
      } else if (scrollingAway) {
        // User is manually scrolling UP - cancel auto-scroll immediately
        isAutoScrollingRef.current = false;
        setIsAtBottom(false);
        
        // Clear any pending auto-scroll timeout
        clearTimeoutSafe(autoScrollTimeoutRef);
      }
      // If scrolling toward bottom (scrollY increasing), let it continue
      return;
    }

    // User is manually scrolling - debounce state updates to avoid jank
    clearTimeoutSafe(scrollDebounceRef);

    scrollDebounceRef.current = setTimeout(() => {
      setIsAtBottom(atBottom);
      scrollDebounceRef.current = null;
    }, 50); // Short debounce for responsive UI
  }, []);

  /**
   * Handle content size changes - trigger auto-scroll if needed
   * This is the main trigger for auto-scrolling during streaming
   */
  const handleContentSizeChange = useCallback((_contentWidth: number, contentHeight: number) => {
    const contentGrew = contentHeight > lastContentHeightRef.current;
    lastContentHeightRef.current = contentHeight;

    // If we're already auto-scrolling, keep scrolling (for streaming updates)
    if (isAutoScrollingRef.current) {
      if (scrollViewRef.current) {
        // Instant scroll for rapid updates during streaming
        scrollViewRef.current.scrollToEnd({ animated: false });
        
        // Extend the auto-scroll timeout since new content arrived
        clearTimeoutSafe(autoScrollTimeoutRef);
        autoScrollTimeoutRef.current = setTimeout(() => {
          isAutoScrollingRef.current = false;
          setIsAtBottom(true);
          autoScrollTimeoutRef.current = null;
        }, 200); // Shorter timeout for streaming updates
      }
      return;
    }

    // If content grew and user was at bottom, auto-scroll (without animation for smooth streaming)
    // Use ref to avoid stale closure issues
    if (contentGrew && isAtBottomRef.current) {
      // Small delay to ensure layout is complete
      setTimeout(() => {
        if (isAtBottomRef.current && !isAutoScrollingRef.current) {
          scrollToBottom(false); // No animation for auto-scroll during streaming
        }
      }, 10);
    }
  }, [scrollToBottom]);

  return {
    scrollViewRef: scrollViewRef as React.RefObject<ScrollView>,
    isAtBottom,
    showScrollButton,
    scrollToBottom,
    handleScroll,
    handleContentSizeChange,
  };
};

export default useSmartScroll;

/**
 * useSmartScroll - Simplified auto-scroll hook for chat applications
 * 
 * Automatically scrolls to bottom when new content is added, but only if
 * the user is already at the bottom. Much simpler than the previous version
 * to avoid race conditions and state synchronization issues.
 */

import { useRef, useState, useCallback, useMemo } from 'react';
import { ScrollView, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

interface UseSmartScrollReturn {
  scrollViewRef: React.RefObject<ScrollView>;
  isAtBottom: boolean;
  showScrollButton: boolean;
  scrollToBottom: () => void;
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  handleContentSizeChange: (contentWidth: number, contentHeight: number) => void;
}

// Single source of truth: threshold for "close enough to bottom"
const BOTTOM_THRESHOLD = 50;

export const useSmartScroll = (): UseSmartScrollReturn => {
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Single state source - no dual ref/state tracking
  const [isAtBottom, setIsAtBottom] = useState(true);
  
  // Derived state - no separate useState needed
  const showScrollButton = !isAtBottom;
  
  // Track if we're in auto-scroll mode (prevents showing button during auto-scroll)
  const isAutoScrollingRef = useRef(false);
  
  // Track last known position to detect content growth
  const lastContentHeightRef = useRef<number>(0);
  
  // Single debounce timeout for scroll detection
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Single timeout for auto-scroll completion
  const autoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Check if scroll position is at bottom
   */
  const checkIfAtBottom = useCallback((
    layoutHeight: number,
    contentHeight: number,
    scrollY: number
  ): boolean => {
    // Content smaller than viewport = always at bottom
    if (contentHeight <= layoutHeight) {
      return true;
    }
    
    const distanceFromBottom = contentHeight - (layoutHeight + scrollY);
    return distanceFromBottom <= BOTTOM_THRESHOLD;
  }, []);

  /**
   * Scroll to bottom - simple, no promises needed
   * @param animated - whether to animate the scroll (default: true for manual, false for auto)
   */
  const scrollToBottom = useCallback((animated: boolean = true) => {
    if (!scrollViewRef.current) return;

    // Clear any pending auto-scroll timeout
    if (autoScrollTimeoutRef.current) {
      clearTimeout(autoScrollTimeoutRef.current);
      autoScrollTimeoutRef.current = null;
    }

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

    // If we're auto-scrolling, only update state when we reach bottom
    // This prevents flickering of the scroll button during auto-scroll
    if (isAutoScrollingRef.current) {
      if (atBottom) {
        setIsAtBottom(true);
      }
      return;
    }

    // User is manually scrolling - debounce state updates to avoid jank
    if (scrollDebounceRef.current) {
      clearTimeout(scrollDebounceRef.current);
    }

    scrollDebounceRef.current = setTimeout(() => {
      setIsAtBottom(atBottom);
      scrollDebounceRef.current = null;
    }, 50); // Short debounce for responsive UI
  }, [checkIfAtBottom]);

  /**
   * Handle content size changes - trigger auto-scroll if needed
   * This is the main trigger for auto-scrolling during streaming
   */
  const handleContentSizeChange = useCallback((contentWidth: number, contentHeight: number) => {
    const contentGrew = contentHeight > lastContentHeightRef.current;
    lastContentHeightRef.current = contentHeight;

    // If we're already auto-scrolling, keep scrolling (for streaming updates)
    if (isAutoScrollingRef.current) {
      if (scrollViewRef.current) {
        // Instant scroll for rapid updates during streaming
        scrollViewRef.current.scrollToEnd({ animated: false });
        
        // Extend the auto-scroll timeout since new content arrived
        if (autoScrollTimeoutRef.current) {
          clearTimeout(autoScrollTimeoutRef.current);
        }
        autoScrollTimeoutRef.current = setTimeout(() => {
          isAutoScrollingRef.current = false;
          setIsAtBottom(true);
          autoScrollTimeoutRef.current = null;
        }, 200); // Shorter timeout for streaming updates
      }
      return;
    }

    // If content grew and user was at bottom, auto-scroll (without animation for smooth streaming)
    if (contentGrew && isAtBottom) {
      // Small delay to ensure layout is complete
      setTimeout(() => {
        if (isAtBottom && !isAutoScrollingRef.current) {
          scrollToBottom(false); // No animation for auto-scroll during streaming
        }
      }, 10);
    }
  }, [isAtBottom, scrollToBottom]);

  return useMemo(() => ({
    scrollViewRef: scrollViewRef as React.RefObject<ScrollView>,
    isAtBottom,
    showScrollButton,
    scrollToBottom,
    handleScroll,
    handleContentSizeChange,
  }), [isAtBottom, showScrollButton, scrollToBottom, handleScroll, handleContentSizeChange]);
};

export default useSmartScroll;

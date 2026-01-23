/**
 * useSmartScroll - React Native version of use-stick-to-bottom
 * 
 * A lightweight hook for AI chat applications that automatically scrolls to bottom
 * when new content is added, but only if the user is already at the bottom.
 * Inspired by stackblitz-labs/use-stick-to-bottom.
 */

import { useRef, useState, useCallback } from 'react';
import { ScrollView, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

interface UseSmartScrollReturn {
  scrollViewRef: React.RefObject<ScrollView>;
  isAtBottom: boolean;
  showScrollButton: boolean;
  scrollToBottom: () => Promise<boolean>;
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  handleContentSizeChange: (contentWidth: number, contentHeight: number) => void;
}

export const useSmartScroll = (): UseSmartScrollReturn => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const isScrollingToBottom = useRef(false);
  
  // Use refs to track current state (avoids stale closures)
  const isAtBottomRef = useRef(true);
  const lastScrollPosition = useRef<{ scrollY: number; contentHeight: number; layoutHeight: number } | null>(null);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Threshold for "close enough to bottom" (50px tolerance - more forgiving)
  const BOTTOM_THRESHOLD = 50;

  const checkIfAtBottom = useCallback((
    layoutHeight: number,
    contentHeight: number,
    scrollY: number
  ): boolean => {
    // Handle edge case where content is smaller than viewport
    if (contentHeight <= layoutHeight) {
      return true;
    }
    
    const distanceFromBottom = contentHeight - (layoutHeight + scrollY);
    return distanceFromBottom <= BOTTOM_THRESHOLD;
  }, []);

  const scrollToBottom = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!scrollViewRef.current) {
        resolve(false);
        return;
      }

      // Clear any existing reset timeout
      if (scrollResetTimeoutRef.current) {
        clearTimeout(scrollResetTimeoutRef.current);
        scrollResetTimeoutRef.current = null;
      }

      isScrollingToBottom.current = true;
      
      scrollViewRef.current.scrollToEnd({ animated: true });
      
      // Reset flag after animation completes
      // This timeout will be cleared if new content arrives (extending auto-scroll)
      scrollResetTimeoutRef.current = setTimeout(() => {
        isScrollingToBottom.current = false;
        isAtBottomRef.current = true;
        setIsAtBottom(true);
        setShowScrollButton(false);
        scrollResetTimeoutRef.current = null;
        resolve(true);
      }, 300);
    });
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    
    // Store last scroll position for content size change handler
    lastScrollPosition.current = {
      scrollY: contentOffset.y,
      contentHeight: contentSize.height,
      layoutHeight: layoutMeasurement.height,
    };

    const atBottom = checkIfAtBottom(
      layoutMeasurement.height,
      contentSize.height,
      contentOffset.y
    );

    // If we're programmatically scrolling, only update state if we're at bottom
    // This prevents showing scroll button during auto-scroll
    if (isScrollingToBottom.current) {
      if (atBottom) {
        isAtBottomRef.current = true;
        setIsAtBottom(true);
        setShowScrollButton(false);
      }
      return;
    }

    // Update both state and ref
    isAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
    setShowScrollButton(!atBottom);

    // Clear any existing timeout
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }

    // If user scrolled near bottom, mark as at bottom after a brief delay
    // This handles the case where user scrolls back down manually
    if (atBottom) {
      userScrollTimeoutRef.current = setTimeout(() => {
        isAtBottomRef.current = true;
        setIsAtBottom(true);
        setShowScrollButton(false);
      }, 100);
    }
  }, [checkIfAtBottom]);

  const handleContentSizeChange = useCallback((contentWidth: number, contentHeight: number) => {
    // If we're currently scrolling, immediately scroll without animation to keep up
    // This prevents gaps during rapid content updates
    if (isScrollingToBottom.current) {
      if (scrollViewRef.current && isAtBottomRef.current) {
        scrollViewRef.current.scrollToEnd({ animated: false });
        // Extend reset timeout - new content means keep auto-scrolling
        if (scrollResetTimeoutRef.current) {
          clearTimeout(scrollResetTimeoutRef.current);
        }
        scrollResetTimeoutRef.current = setTimeout(() => {
          isScrollingToBottom.current = false;
          isAtBottomRef.current = true;
          setIsAtBottom(true);
          setShowScrollButton(false);
          scrollResetTimeoutRef.current = null;
        }, 300);
      }
      return;
    }

    // Check if content grew and user was at bottom
    if (lastScrollPosition.current) {
      const { scrollY, layoutHeight } = lastScrollPosition.current;
      const wasAtBottom = checkIfAtBottom(layoutHeight, lastScrollPosition.current.contentHeight, scrollY);
      
      if (contentHeight > lastScrollPosition.current.contentHeight && wasAtBottom) {
        setTimeout(() => {
          if (isAtBottomRef.current && !isScrollingToBottom.current) {
            scrollToBottom();
          }
        }, 50);
        return;
      }
    }

    // Fallback: if at bottom, scroll
    if (isAtBottomRef.current && !isScrollingToBottom.current) {
      setTimeout(() => {
        if (isAtBottomRef.current && !isScrollingToBottom.current) {
          scrollToBottom();
        }
      }, 50);
    }
  }, [checkIfAtBottom, scrollToBottom]);

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

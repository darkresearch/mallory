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

  // Threshold for "close enough to bottom" (20px tolerance)
  const BOTTOM_THRESHOLD = 20;

  const checkIfAtBottom = useCallback((
    layoutHeight: number,
    contentHeight: number,
    scrollY: number
  ): boolean => {
    return layoutHeight + scrollY >= contentHeight - BOTTOM_THRESHOLD;
  }, []);

  const scrollToBottom = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!scrollViewRef.current) {
        resolve(false);
        return;
      }

      isScrollingToBottom.current = true;
      
      scrollViewRef.current.scrollToEnd({ animated: true });
      
      // Reset flag after animation completes (roughly 300ms for React Native default)
      setTimeout(() => {
        isScrollingToBottom.current = false;
        setIsAtBottom(true);
        setShowScrollButton(false);
        resolve(true);
      }, 350);
    });
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Ignore scroll events triggered by our own scrollToBottom
    if (isScrollingToBottom.current) {
      return;
    }

    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const atBottom = checkIfAtBottom(
      layoutMeasurement.height,
      contentSize.height,
      contentOffset.y
    );

    console.log('📜 Scroll event:', { 
      scrollY: contentOffset.y, 
      layoutHeight: layoutMeasurement.height, 
      contentHeight: contentSize.height, 
      atBottom,
      calculation: `${layoutMeasurement.height} + ${contentOffset.y} >= ${contentSize.height} - ${BOTTOM_THRESHOLD}`
    });

    setIsAtBottom(atBottom);
    setShowScrollButton(!atBottom);
  }, [checkIfAtBottom]);

  const handleContentSizeChange = useCallback((contentWidth: number, contentHeight: number) => {
    console.log('📏 Content size changed:', { contentHeight, isAtBottom, isScrollingToBottom: isScrollingToBottom.current });
    
    // Only auto-scroll if user is at bottom (like use-stick-to-bottom behavior)
    if (isAtBottom && !isScrollingToBottom.current) {
      console.log('🔄 Auto-scrolling to bottom due to content change');
      // Small delay to ensure layout is complete
      setTimeout(() => {
        scrollToBottom();
      }, 50);
    } else {
      console.log('❌ Not auto-scrolling:', { isAtBottom, isScrollingToBottom: isScrollingToBottom.current });
    }
  }, [isAtBottom, scrollToBottom]);

  return {
    scrollViewRef,
    isAtBottom,
    showScrollButton,
    scrollToBottom,
    handleScroll,
    handleContentSizeChange,
  };
};

export default useSmartScroll;

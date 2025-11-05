/**
 * InlineCitation - React Native Implementation
 * 
 * A React Native adaptation of Vercel's AI Elements InlineCitation component.
 * Provides inline citations with hover-like interactions for AI-generated content.
 * 
 * Note: React Native doesn't have hover, so we use TouchableOpacity with a modal-style popup.
 */

// @ts-nocheck - Suppress monorepo React version mismatch errors
import React, { createContext, useContext, useState, useCallback, useRef, ComponentProps } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  ScrollView,
  Linking,
  Pressable,
  Dimensions,
  Platform
} from 'react-native';
import { createPortal } from 'react-dom';
import { useFloating, autoUpdate, offset, flip, shift } from '@floating-ui/react-dom';
import { Ionicons } from '@expo/vector-icons';

// ============================================================================
// Types
// ============================================================================

export interface InlineCitationProps extends ComponentProps<typeof View> {
  children: React.ReactNode;
}

export interface InlineCitationTextProps extends ComponentProps<typeof Text> {
  children: React.ReactNode;
}

export interface InlineCitationCardProps {
  children: React.ReactNode;
}

export interface InlineCitationCardTriggerProps {
  sources: string[];
}

export interface InlineCitationCardBodyProps {
  children: React.ReactNode;
}

export interface InlineCitationCarouselProps {
  children: React.ReactNode;
}

export interface InlineCitationCarouselContentProps {
  children: React.ReactNode;
}

export interface InlineCitationCarouselItemProps {
  children: React.ReactNode;
}

export interface InlineCitationCarouselHeaderProps {
  children: React.ReactNode;
}

export interface InlineCitationCarouselIndexProps {
  children?: React.ReactNode;
}

export interface InlineCitationCarouselNavProps {
  onPress?: () => void;
}

export interface InlineCitationSourceProps {
  title?: string;
  url?: string;
  description?: string;
  children?: React.ReactNode;
}

export interface InlineCitationQuoteProps {
  children: React.ReactNode;
}

// ============================================================================
// Context for managing modal visibility and carousel state
// ============================================================================

interface CitationCardContextValue {
  isVisible: boolean;
  showCard: () => void;
  hideCard: () => void;
  refs?: any;
  floatingStyles?: any;
  hideTimeoutRef?: React.MutableRefObject<NodeJS.Timeout | null>;
  scheduleHide: () => void;
  cancelHide: () => void;
}

const CitationCardContext = createContext<CitationCardContextValue | undefined>(undefined);

const useCitationCard = () => {
  const context = useContext(CitationCardContext);
  if (!context) {
    throw new Error('Citation components must be used within InlineCitationCard');
  }
  return context;
};

interface CarouselContextValue {
  currentIndex: number;
  totalItems: number;
  setTotalItems: (count: number) => void;
  goToNext: () => void;
  goToPrev: () => void;
}

const CarouselContext = createContext<CarouselContextValue | undefined>(undefined);

const useCarousel = () => {
  const context = useContext(CarouselContext);
  if (!context) {
    throw new Error('Carousel components must be used within InlineCitationCarousel');
  }
  return context;
};

// ============================================================================
// Main Components
// ============================================================================

/**
 * InlineCitation - Root wrapper for citation
 */
export const InlineCitation = ({ children, style, ...props }: InlineCitationProps) => {
  return (
    <View style={[styles.inlineCitation, style]} {...props}>
      {children}
    </View>
  );
};

/**
 * InlineCitationText - The text that has a citation
 */
export const InlineCitationText = ({ children, style, ...props }: InlineCitationTextProps) => {
  return (
    <Text style={[styles.citationText, style]} {...props}>
      {children}
    </Text>
  );
};

/**
 * InlineCitationCard - Container that manages modal visibility
 */
export const InlineCitationCard = ({ children }: InlineCitationCardProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showCard = useCallback(() => {
    // Cancel any pending hide when showing
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsVisible(true);
  }, []);

  const hideCard = useCallback(() => {
    setIsVisible(false);
  }, []);

  // Schedule hide with delay
  const scheduleHide = useCallback(() => {
    // Clear any existing timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    // Set new timeout
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
      hideTimeoutRef.current = null;
    }, 150); // 150ms delay
  }, []);

  // Cancel scheduled hide
  const cancelHide = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Floating UI setup for smart positioning
  const { refs, floatingStyles } = useFloating({
    placement: 'bottom-start',
    middleware: [
      offset(8),
      flip(),
      shift({ padding: 8 })
    ],
    whileElementsMounted: autoUpdate,
    open: isVisible,
  });

  return (
    <CitationCardContext.Provider value={{ 
      isVisible, 
      showCard, 
      hideCard, 
      refs, 
      floatingStyles,
      hideTimeoutRef,
      scheduleHide,
      cancelHide
    }}>
      <View style={styles.citationCardContainer}>
        {children}
      </View>
    </CitationCardContext.Provider>
  );
};

/**
 * InlineCitationCardTrigger - Badge that shows sources and triggers modal
 * On click: Opens the first source URL
 * On hover (web) or long press (mobile): Shows citation details
 */
export const InlineCitationCardTrigger = ({ sources }: InlineCitationCardTriggerProps) => {
  const { showCard, refs, scheduleHide, cancelHide } = useCitationCard();
  
  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  };

  const handlePress = useCallback(() => {
    // On click/tap: Open the first source URL
    if (sources.length > 0) {
      Linking.openURL(sources[0]).catch(err => {
        console.error('Failed to open URL:', err);
      });
    }
  }, [sources]);

  const handleLongPress = useCallback(() => {
    // On long press (mobile): Show the modal
    showCard();
  }, [showCard]);

  // Hover handlers with delay
  const handleHoverIn = useCallback(() => {
    cancelHide(); // Cancel any pending hide
    showCard();
  }, [showCard, cancelHide]);

  const handleHoverOut = useCallback(() => {
    scheduleHide(); // Start delayed hide
  }, [scheduleHide]);

  const hostname = sources.length > 0 ? getHostname(sources[0]) : 'unknown';
  const additionalCount = sources.length > 1 ? ` +${sources.length - 1}` : '';

  // On web, use Pressable with hover support
  if (Platform.OS === 'web') {
    return (
      <Pressable 
        ref={refs?.setReference}
        style={styles.badge}
        onPress={handlePress}
        // @ts-ignore - onHoverIn/onHoverOut are web-only
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
      >
        <Text style={styles.badgeText}>
          {hostname}{additionalCount}
        </Text>
      </Pressable>
    );
  }

  // On mobile, use TouchableOpacity with long press
  return (
    <TouchableOpacity 
      style={styles.badge} 
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
    >
      <Text style={styles.badgeText}>
        {hostname}{additionalCount}
      </Text>
    </TouchableOpacity>
  );
};

/**
 * InlineCitationCardBody - The modal/popover content
 * On web: Shows as a popover with Floating UI positioning and React Portal
 * On mobile: Shows as a modal on long press
 */
export const InlineCitationCardBody = ({ children }: InlineCitationCardBodyProps) => {
  const { isVisible, hideCard, refs, floatingStyles, scheduleHide, cancelHide } = useCitationCard();

  if (!isVisible) {
    return null;
  }

  // On web, show as a portal-rendered popover with Floating UI positioning
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const popoverContent = (
      <div
        ref={refs?.setFloating}
        style={{
          ...floatingStyles,
          zIndex: 1000,
        }}
        onMouseEnter={cancelHide}
        onMouseLeave={scheduleHide}
      >
        <View style={styles.webPopover}>
          <View style={styles.cardBody}>
            {children}
          </View>
        </View>
      </div>
    );

    return createPortal(popoverContent, document.body);
  }

  // On mobile, show as a full-screen modal
  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={hideCard}
    >
      <Pressable style={styles.modalOverlay} onPress={hideCard}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.cardBody}>
            {children}
          </View>
          
          {/* Close button */}
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={hideCard}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color="#DCE9FF" />
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

/**
 * InlineCitationCarousel - Manages navigation between multiple citations
 */
export const InlineCitationCarousel = ({ children }: InlineCitationCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % totalItems);
  }, [totalItems]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + totalItems) % totalItems);
  }, [totalItems]);

  return (
    <CarouselContext.Provider value={{ currentIndex, totalItems, setTotalItems, goToNext, goToPrev }}>
      {children}
    </CarouselContext.Provider>
  );
};

/**
 * InlineCitationCarouselContent - Scrollable container for carousel items
 */
export const InlineCitationCarouselContent = ({ children }: InlineCitationCarouselContentProps) => {
  const { currentIndex, setTotalItems } = useCarousel();
  
  // Count children
  React.useEffect(() => {
    const childArray = React.Children.toArray(children);
    setTotalItems(childArray.length);
  }, [children, setTotalItems]);

  // Get current child
  const childArray = React.Children.toArray(children);
  const currentChild = childArray[currentIndex];

  return (
    <ScrollView style={styles.carouselContent} showsVerticalScrollIndicator={false}>
      {currentChild}
    </ScrollView>
  );
};

/**
 * InlineCitationCarouselItem - Individual citation item
 */
export const InlineCitationCarouselItem = ({ children }: InlineCitationCarouselItemProps) => {
  return (
    <View style={styles.carouselItem}>
      {children}
    </View>
  );
};

/**
 * InlineCitationCarouselHeader - Header with navigation and index
 */
export const InlineCitationCarouselHeader = ({ children }: InlineCitationCarouselHeaderProps) => {
  return (
    <View style={styles.carouselHeader}>
      {children}
    </View>
  );
};

/**
 * InlineCitationCarouselIndex - Shows current position (e.g., "1/5")
 */
export const InlineCitationCarouselIndex = ({ children }: InlineCitationCarouselIndexProps) => {
  const { currentIndex, totalItems } = useCarousel();

  return (
    <View style={styles.carouselIndex}>
      <Text style={styles.carouselIndexText}>
        {children ?? `${currentIndex + 1}/${totalItems}`}
      </Text>
    </View>
  );
};

/**
 * InlineCitationCarouselPrev - Previous button
 */
export const InlineCitationCarouselPrev = ({ onPress }: InlineCitationCarouselNavProps) => {
  const { goToPrev, currentIndex, totalItems } = useCarousel();
  
  const handlePress = () => {
    onPress?.();
    goToPrev();
  };

  // Disable if only one item or at the beginning
  const disabled = totalItems <= 1;

  return (
    <TouchableOpacity 
      style={[styles.navButton, disabled && styles.navButtonDisabled]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Ionicons 
        name="chevron-back" 
        size={20} 
        color={disabled ? '#4A5568' : '#DCE9FF'} 
      />
    </TouchableOpacity>
  );
};

/**
 * InlineCitationCarouselNext - Next button
 */
export const InlineCitationCarouselNext = ({ onPress }: InlineCitationCarouselNavProps) => {
  const { goToNext, currentIndex, totalItems } = useCarousel();
  
  const handlePress = () => {
    onPress?.();
    goToNext();
  };

  // Disable if only one item or at the end
  const disabled = totalItems <= 1;

  return (
    <TouchableOpacity 
      style={[styles.navButton, disabled && styles.navButtonDisabled]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Ionicons 
        name="chevron-forward" 
        size={20} 
        color={disabled ? '#4A5568' : '#DCE9FF'} 
      />
    </TouchableOpacity>
  );
};

/**
 * InlineCitationSource - Displays source information (title, URL, description)
 */
export const InlineCitationSource = ({ 
  title, 
  url, 
  description, 
  children 
}: InlineCitationSourceProps) => {
  const handleUrlPress = useCallback(() => {
    if (url) {
      Linking.openURL(url).catch(err => console.error('Failed to open URL:', err));
    }
  }, [url]);

  return (
    <View style={styles.source}>
      {title && (
        <Text style={styles.sourceTitle} numberOfLines={1}>
          {title}
        </Text>
      )}
      {url && (
        <TouchableOpacity onPress={handleUrlPress} activeOpacity={0.7}>
          <Text style={styles.sourceUrl} numberOfLines={1}>
            {url}
          </Text>
        </TouchableOpacity>
      )}
      {description && (
        <Text style={styles.sourceDescription} numberOfLines={3}>
          {description}
        </Text>
      )}
      {children}
    </View>
  );
};

/**
 * InlineCitationQuote - Displays a quoted excerpt
 */
export const InlineCitationQuote = ({ children }: InlineCitationQuoteProps) => {
  return (
    <View style={styles.quoteContainer}>
      <View style={styles.quoteBorder} />
      <Text style={styles.quoteText}>
        {children}
      </Text>
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  inlineCitation: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  citationText: {
    color: '#DCE9FF',
    fontSize: 16,
    lineHeight: 24,
  },
  citationCardContainer: {
    position: 'relative',
  },
  badge: {
    backgroundColor: '#27272A', // Match requested background color
    borderWidth: 0,
    borderRadius: 999, // Fully rounded pill (matches Tailwind's rounded-full)
    paddingHorizontal: 8,
    paddingVertical: 1, // Reduced vertical padding
    marginLeft: 4,
    marginRight: 2,
    alignSelf: 'flex-start',
    // Very subtle shadow
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 1 },
    // shadowOpacity: 0.1,
    // shadowRadius: 1,
    elevation: 1, // For Android
  },
  badgeText: {
    color: '#d4d4d8', // Slightly muted light gray (zinc-300)
    fontSize: 12,
    fontFamily: 'Satoshi-Bold', // Match app's regular text font
    // letterSpacing: 0.50,
  },
  
  // Web popover styles (positioning handled by Floating UI)
  webPopover: {
    width: 320,
    maxWidth: Dimensions.get('window').width * 0.9, // 90% of viewport width
    backgroundColor: '#151820',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363d',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  // Modal styles (mobile)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: '#151820',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363d',
    overflow: 'hidden',
  },
  cardBody: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a1e24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Carousel styles
  carouselHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1e24',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  carouselIndex: {
    flex: 1,
    alignItems: 'flex-end',
    paddingHorizontal: 12,
  },
  carouselIndexText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: '#151820',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  carouselContent: {
    flex: 1,
  },
  carouselItem: {
    padding: 16,
  },
  
  // Source styles
  source: {
    gap: 8,
  },
  sourceTitle: {
    color: '#DCE9FF',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  sourceUrl: {
    color: '#4A9EFF',
    fontSize: 12,
    lineHeight: 16,
  },
  sourceDescription: {
    color: '#8E8E93',
    fontSize: 14,
    lineHeight: 20,
  },
  
  // Quote styles
  quoteContainer: {
    flexDirection: 'row',
    marginTop: 12,
    paddingLeft: 12,
  },
  quoteBorder: {
    width: 2,
    backgroundColor: '#30363d',
    marginRight: 12,
  },
  quoteText: {
    flex: 1,
    color: '#8E8E93',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
});

// ============================================================================
// Default export
// ============================================================================

export default InlineCitation;

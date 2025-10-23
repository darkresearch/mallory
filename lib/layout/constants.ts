/**
 * Layout constants for consistent content widths across the app
 * Following DRY principles for maintainable, scalable design
 */

export const LAYOUT = {
  // Main content container - used for wide layouts (chat, wallet, history)
  CONTENT_MAX_WIDTH: 1111,
  
  // Narrow content - used for focused content like chat messages
  NARROW_MAX_WIDTH: 600,
  
  // Auth screens - used for login, onboarding
  AUTH_MAX_WIDTH: 480,
  
  // Standard horizontal padding
  CONTENT_PADDING_H: 16,
} as const;

/**
 * Reusable container style for main content area
 * Use this for consistent width constraints across pages
 */
export const createContentContainerStyle = (maxWidth: number = LAYOUT.CONTENT_MAX_WIDTH) => ({
  flex: 1,
  maxWidth,
  width: '100%' as const,
  alignSelf: 'center' as const,
});

/**
 * Reusable container style with horizontal padding
 */
export const createPaddedContainerStyle = (
  maxWidth: number = LAYOUT.CONTENT_MAX_WIDTH,
  paddingHorizontal: number = LAYOUT.CONTENT_PADDING_H
) => ({
  flex: 1,
  maxWidth,
  width: '100%' as const,
  alignSelf: 'center' as const,
  paddingHorizontal,
});


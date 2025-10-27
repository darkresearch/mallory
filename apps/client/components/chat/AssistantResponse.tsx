/**
 * AssistantResponse - AI Assistant Response Component
 * 
 * A thin wrapper around StreamdownRN, mirroring Vercel's AI SDK Response component.
 * Provides defaults and styling for AI assistant responses.
 */

import React from 'react';
import { ViewStyle, StyleSheet } from 'react-native';
import { StreamdownRN, lightMarkdownStyles } from 'streamdown-rn';
import { componentRegistry } from '@/components/registry';

// Patch the markdown styles to ensure text wrapping
// This modifies the imported object directly before StreamdownRN uses it
const patchMarkdownStyles = () => {
  const textWrapStyles = {
    flexWrap: 'wrap' as const,
    flexShrink: 1,
  };
  
  // Apply wrapping styles to all text elements
  if (lightMarkdownStyles.body) {
    Object.assign(lightMarkdownStyles.body, textWrapStyles);
  }
  if (lightMarkdownStyles.paragraph) {
    Object.assign(lightMarkdownStyles.paragraph, textWrapStyles);
  }
  if (lightMarkdownStyles.link) {
    Object.assign(lightMarkdownStyles.link, textWrapStyles);
  }
  if (lightMarkdownStyles.strong) {
    Object.assign(lightMarkdownStyles.strong, textWrapStyles);
  }
  if (lightMarkdownStyles.em) {
    Object.assign(lightMarkdownStyles.em, textWrapStyles);
  }
  if (lightMarkdownStyles.code_inline) {
    Object.assign(lightMarkdownStyles.code_inline, { 
      ...textWrapStyles,
      flexWrap: 'wrap' as const,
    });
  }
  if (lightMarkdownStyles.code_block) {
    Object.assign(lightMarkdownStyles.code_block, textWrapStyles);
  }
  if (lightMarkdownStyles.fence) {
    Object.assign(lightMarkdownStyles.fence, textWrapStyles);
  }
  if (lightMarkdownStyles.list_item) {
    Object.assign(lightMarkdownStyles.list_item, textWrapStyles);
  }
};

// Apply the patch once when the module loads
patchMarkdownStyles();

interface AssistantResponseProps {
  children: string;
  style?: ViewStyle;
  onComponentError?: (error: any) => void;
}

export const AssistantResponse = React.memo(
  ({ children, style, onComponentError, ...props }: AssistantResponseProps) => (
    // @ts-ignore - Type mismatch due to different React/RN versions in monorepo packages
    <StreamdownRN
      style={{ 
        width: '100%',
        maxWidth: '100%',
        minWidth: 0, // Allow flex shrinking
        // Ensure long strings (like pubkeys) wrap on all platforms
        flexShrink: 1,
        // Web-specific word-wrap styles
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
        whiteSpace: 'pre-wrap',
        ...style 
      } as any}
      theme="light"
      componentRegistry={componentRegistry}
      onComponentError={onComponentError}
      {...props}
    >
      {children}
    </StreamdownRN>
  ),
  (prevProps, nextProps) => {
    // Only re-render if children change
    return prevProps.children === nextProps.children;
  }
);

AssistantResponse.displayName = 'AssistantResponse';

export default AssistantResponse;

/**
 * AssistantResponse - AI Assistant Response Component
 * 
 * A thin wrapper around StreamdownRN, mirroring Vercel's AI SDK Response component.
 * Provides defaults and styling for AI assistant responses.
 */

import React from 'react';
import { ViewStyle, StyleSheet } from 'react-native';
import { StreamdownRN } from 'streamdown-rn';
import { componentRegistry } from '@/components/registry';

// Text wrapping and overflow handling now built into streamdown-rn themes
// No patching needed!

interface AssistantResponseProps {
  children: string;
  style?: ViewStyle;
  styleOverrides?: Partial<Record<string, any>>;
  onComponentError?: (error: any) => void;
}

export const AssistantResponse = React.memo(
  ({ children, style, styleOverrides, onComponentError, ...props }: AssistantResponseProps) => (
    // @ts-ignore - Type mismatch due to different React/RN versions in monorepo packages
    <StreamdownRN
      style={{ 
        width: '100%',
        maxWidth: '100%',
        minWidth: 0, // Allow flex shrinking
        flexShrink: 1,
        // Web-specific: wrap long strings like Solana addresses
        // Uses word-wrap on the container but NOT word-break (which breaks layout)
        overflowWrap: 'break-word',
        ...style 
      } as any}
      theme="light"
      styleOverrides={styleOverrides}
      componentRegistry={componentRegistry}
      onComponentError={onComponentError}
      {...props}
    >
      {children}
    </StreamdownRN>
  ),
  (prevProps, nextProps) => {
    // Only re-render if children or styleOverrides change
    return prevProps.children === nextProps.children &&
           prevProps.styleOverrides === nextProps.styleOverrides;
  }
);

AssistantResponse.displayName = 'AssistantResponse';

export default AssistantResponse;

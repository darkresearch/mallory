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

interface AssistantResponseProps {
  children: string;
  style?: ViewStyle;
  onComponentError?: (error: any) => void;
}

export const AssistantResponse = React.memo(
  ({ children, style, onComponentError, ...props }: AssistantResponseProps) => (
    // @ts-ignore - Type mismatch due to different React/RN versions in monorepo packages
    <StreamdownRN
      style={{ width: '100%', ...style }}
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

import { ReactNode } from 'react';
import { ViewStyle, TextStyle } from 'react-native';

export interface ChainOfThoughtStep {
  id: string;
  type: 'reasoning' | 'tool_call' | 'tool_response' | 'decision' | 'error';
  label: string;
  description?: string;
  status: 'complete' | 'active' | 'pending' | 'error';
  timestamp: string;
  duration?: number;
  data?: {
    toolName?: string;
    toolInput?: any;
    toolOutput?: any;
    reasoningText?: string;
    error?: string;
  };
}

export interface ChainOfThoughtData {
  steps: ChainOfThoughtStep[];
  totalDuration?: number;
  isComplete: boolean;
}

export interface ChainOfThoughtProps {
  data: ChainOfThoughtData;
  isStreaming?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  style?: ViewStyle;
  thinkingText?: string; // Custom text to show while thinking (e.g. "Mallory wants to say hello")
}

export interface ChainOfThoughtHeaderProps {
  children?: ReactNode;
  isOpen: boolean;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  isStreaming?: boolean;
  totalDuration?: number;
}

export interface ChainOfThoughtContentProps {
  children: ReactNode;
  isOpen: boolean;
  style?: ViewStyle;
}

export interface ChainOfThoughtStepProps {
  step: ChainOfThoughtStep;
  isLast?: boolean;
  showConnector?: boolean;
  style?: ViewStyle;
}

export interface ChainOfThoughtSearchResultProps {
  children: ReactNode;
  style?: ViewStyle;
}

// Icon name mapping for different step types (using basic Ionicon names that definitely exist)
export const STEP_ICONS = {
  reasoning: 'bulb' as const, // Lightbulb for AI reasoning (confirmed to exist)
  tool_call: 'search' as const, // Search icon for tool calls (especially web search)
  tool_response: 'search' as const, // Search icon for tool responses (always show search icon)
  decision: 'flash' as const, // Flash for decisions
  error: 'close-circle' as const, // X circle for errors
  // Special tool-specific icons
  searchWeb: 'search' as const, // Search icon specifically for web search
} as const;

// Status colors for different states
export const STEP_COLORS = {
  complete: '#C95900', // 80% opacity applied in component
  active: '#3b82f6',   // Blue
  pending: '#C95900',  // 40% opacity applied in component
  error: '#ef4444',    // Red
} as const;

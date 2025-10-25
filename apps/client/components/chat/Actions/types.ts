import { ReactNode } from 'react';
import { ViewStyle, TextStyle } from 'react-native';

export interface ActionProps {
  /** The content to display inside the action button (usually an icon) */
  children?: ReactNode;
  
  /** Accessible label for screen readers and tooltips */
  label?: string;
  
  /** Function called when the action is pressed */
  onPress?: () => void;
  
  /** Whether the action is currently disabled */
  disabled?: boolean;
  
  /** Custom style for the action button */
  style?: ViewStyle;
  
  /** Custom style for the action text/icon */
  contentStyle?: TextStyle;
  
  /** Whether this is a toggle action (like/dislike) */
  isToggle?: boolean;
  
  /** Whether the toggle is currently active */
  isActive?: boolean;
}

export interface ActionsProps {
  /** Action components to display */
  children: ReactNode;
  
  /** Custom style for the actions container */
  style?: ViewStyle;
  
  /** Whether to show actions (can be used for conditional rendering) */
  visible?: boolean;
}

export interface MessageActionsData {
  /** The message ID this actions row belongs to */
  messageId: string;
  
  /** The message content for copying */
  messageContent: string;
  
  /** Whether this is the last message (affects retry availability) */
  isLastMessage: boolean;
  
  /** Function to regenerate/retry the message */
  onRegenerate?: () => void;
  
  /** Function to handle like action */
  onLike?: () => void;
  
  /** Function to handle dislike action */
  onDislike?: () => void;
  
  /** Function to handle copy action */
  onCopy?: () => void;
  
  /** Function to handle share action */
  onShare?: () => void;
}

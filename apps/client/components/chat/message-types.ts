/**
 * Chat-related TypeScript definitions
 */

export interface ChainOfThoughtState {
  reasoning: string;
  steps: Array<{
    id: string;
    type: 'reasoning' | 'tool_call' | 'tool_response';
    label: string;
    description?: string;
    status: 'complete' | 'active' | 'pending';
    timestamp: string;
    data?: any;
  }>;
}

export interface ChatScreenState {
  currentConversationId: string | null;
  currentChainOfThought: ChainOfThoughtState;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: Array<{
    type: string;
    text?: string;
    state?: 'streaming' | 'done';
    [key: string]: any;
  }>;
  status?: string;
}

export interface StreamingHandlers {
  onReasoningUpdate: (reasoning: string) => void;
  onToolCall: (toolName: string, input: any) => void;
  onToolResult: (toolName: string, result: any) => void;
  clearChainOfThought: () => void;
}


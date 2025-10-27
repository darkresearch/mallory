/**
 * SimpleMessageRenderer - The elegant solution
 * 
 * Simple logic:
 * 1. Something comes streaming in
 * 2. Figure out what it is
 * 3. Render the right component
 */

import React from 'react';
import { View, Text } from 'react-native';
import { ChainOfThought, ChainOfThoughtSearchResults, PulsingStar } from './ChainOfThought';
import { AssistantResponse } from './AssistantResponse';
import { MessageActions } from './Actions';
import type { DeviceInfo } from '@/lib/device';

interface SimpleMessageRendererProps {
  message: any; // AI SDK UIMessage
  isStreaming: boolean;
  isLastMessage: boolean;
  liveReasoningText?: string; // Live reasoning text for streaming
  persistentReasoningText?: string; // The reasoning text shown in persistent block
  deviceInfo: DeviceInfo; // Device info for adaptive behavior
  onRegenerate?: () => void;
  thinkingText?: string; // Custom thinking text (e.g. "Mallory wants to say hello")
  isOnboardingMessage?: boolean; // True if this is the onboarding greeting message
  onComponentError?: (error: any) => void;
}

/**
 * SimpleMessageRenderer - One component that does everything
 * Maps over message.parts and renders the appropriate component
 */
export const SimpleMessageRenderer: React.FC<SimpleMessageRendererProps> = ({
  message,
  isStreaming,
  isLastMessage,
  liveReasoningText = '',
  persistentReasoningText = '',
  deviceInfo,
  onRegenerate,
  thinkingText,
  isOnboardingMessage = false,
  onComponentError,
}) => {
  // Create style overrides for onboarding message
  const styleOverrides = isOnboardingMessage ? {
    heading1: {
      fontFamily: 'Belwe-Medium',
      fontSize: 32,
      fontWeight: 'bold' as const,
      color: '#C95900',
      marginTop: 0,
      marginBottom: 12,
    },
    heading2: {
      fontFamily: 'Belwe-Light',
      fontSize: 32,
      color: '#E67B25',
      marginTop: 0,
      marginBottom: 12,
    }
  } : undefined;
  // Check if this is the persistent reasoning block
  const isPersistentReasoningBlock = message.id === 'persistent-reasoning';
  console.log('🎭 SimpleMessageRenderer RECEIVED:', {
    messageId: message.id,
    isPersistentReasoningBlock,
    isStreaming,
    liveReasoningTextLength: liveReasoningText?.length || 0,
    liveReasoningTextPreview: liveReasoningText?.substring(0, 50) + '...' || 'none',
    partsCount: message.parts?.length || 0,
    shouldShowDebugBox: isStreaming && liveReasoningText,
    shouldShowCoT: isStreaming && liveReasoningText && isPersistentReasoningBlock,
    willFilterReasoningParts: !isPersistentReasoningBlock
  });

  // Also log the full message structure for debugging
  console.log('🔍 Full message for search result debugging:', JSON.stringify(message, null, 2));

  const parts = message.parts || [];
  const fullText = parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');

  // Group consecutive CoT-related parts together
  // Simple deduplication: skip reasoning parts that match the persistent reasoning text
  const deduplicatedParts = !isPersistentReasoningBlock ? 
    parts.filter((part: any) => {
      if (part.type === 'reasoning' && part.text && persistentReasoningText) {
        // Skip if this reasoning text matches what's already shown in persistent block
        const matches = part.text.trim() === persistentReasoningText.trim();
        if (matches) {
          console.log('🚫 Skipping duplicate reasoning part:', part.text.substring(0, 50) + '...');
        }
        return !matches;
      }
      return true;
    }) : parts;
  
  let groupedBlocks = groupConsecutiveCoTParts(deduplicatedParts);
  
  // Inject live reasoning as first block for persistent reasoning component
  if (isPersistentReasoningBlock && liveReasoningText) {
    const liveReasoningBlock = {
      type: 'chainOfThought',
      parts: [{
        type: 'reasoning',
        text: liveReasoningText,
        state: isStreaming ? 'streaming' : 'complete'
      }],
      id: 'live-reasoning-block'
    };
    
    // Add live reasoning as first block
    groupedBlocks = [liveReasoningBlock, ...groupedBlocks];
    
    console.log('🚀 Injected live reasoning block:', {
      liveReasoningLength: liveReasoningText.length,
      isStreaming,
      totalBlocks: groupedBlocks.length
    });
  }
  
  console.log('🧩 Grouped blocks:', groupedBlocks.map((block, i) => ({
    index: i,
    type: block.type,
    partsCount: block.parts?.length || 1,
    partTypes: block.parts?.map((p: any) => p.type) || [block.type]
  })));

  return (
    <View style={{ width: '100%', maxWidth: '100%', alignSelf: 'stretch' }}>
      {groupedBlocks.map((block: any, blockIndex: number) => {
        const key = `${message.id}-block-${blockIndex}`;
        
        console.log(`🎨 Rendering block ${blockIndex}:`, { 
          type: block.type,
          partsCount: block.parts?.length || 1
        });

        // Render grouped Chain of Thought blocks
        if (block.type === 'chainOfThought') {
          // For live reasoning block, pass the live text; for others, pass empty string to avoid duplication
          const isLiveBlock = block.id === 'live-reasoning-block';
          const reasoningText = isLiveBlock ? liveReasoningText : '';
          return renderChainOfThoughtBlock(key, block, blockIndex, isStreaming && isLiveBlock, reasoningText, deviceInfo, thinkingText);
        }

        // Render text response blocks
        if (block.type === 'text') {
          return (
            <View key={key} style={{ width: '100%', maxWidth: '100%', flexShrink: 1, minWidth: 0, alignSelf: 'stretch' }}>
              <AssistantResponse 
                styleOverrides={styleOverrides}
                onComponentError={onComponentError}
              >
                {block.text}
              </AssistantResponse>
            </View>
          );
        }

        // Skip other block types
        return null;
      })}

      {/* Show pulsing star when streaming/processing */}
      {isStreaming && (
        <View style={{ alignItems: 'flex-start', paddingVertical: 4, paddingLeft: 0 }}>
          <PulsingStar size={16} />
        </View>
      )}

      {/* Actions at the end - only when message is complete */}
      {!isStreaming && fullText && (
        <MessageActions
          messageId={message.id}
          messageContent={fullText}
          isLastMessage={isLastMessage}
          onRegenerate={onRegenerate}
          onLike={() => console.log('Liked message:', message.id)}
          onDislike={() => console.log('Disliked message:', message.id)}
          onCopy={() => console.log('Copied message:', message.id)}
          onShare={() => console.log('Shared message:', message.id)}
        />
      )}
    </View>
  );
};

/**
 * Group consecutive CoT-related parts into efficient blocks
 * This creates the smooth UX where related parts are grouped together
 */
function groupConsecutiveCoTParts(parts: any[]) {
  const blocks: any[] = [];
  let currentCoTBlock: any = null;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isCoTPart = isChainOfThoughtPart(part);
    
    if (isCoTPart) {
      // Start new CoT block or add to existing one
      if (!currentCoTBlock) {
        currentCoTBlock = {
          type: 'chainOfThought',
          parts: [part],
          id: `cot-${blocks.length}`
        };
      } else {
        // Extend existing CoT block
        currentCoTBlock.parts.push(part);
      }
    } else if (part.type === 'text' && part.text) {
      // Finish current CoT block if exists
      if (currentCoTBlock) {
        blocks.push(currentCoTBlock);
        currentCoTBlock = null;
      }
      
      // Add text block
      blocks.push({
        type: 'text',
        text: part.text,
        id: `text-${blocks.length}`,
        originalPart: part
      });
    }
    // Skip non-content parts (step-start, etc.)
  }
  
  // Don't forget the last CoT block
  if (currentCoTBlock) {
    blocks.push(currentCoTBlock);
  }
  
  return blocks;
}

/**
 * Check if a part should be included in Chain of Thought
 */
function isChainOfThoughtPart(part: any): boolean {
  return (
    (part.type === 'reasoning' && part.text) ||
    (part.type?.startsWith('tool-') && part.type !== 'tool-input-delta')
  );
}

/**
 * Get default CoT open state based on device
 */
function getCoTDefaultOpen(deviceInfo: DeviceInfo, hasToolCalls: boolean): boolean {
  // Always collapsed by default
  return false;
}

/**
 * Render a grouped Chain of Thought block with multiple steps
 */
function renderChainOfThoughtBlock(
  key: string, 
  block: any, 
  blockIndex: number, 
  isStreaming: boolean, 
  liveReasoningText: string = '',
  deviceInfo: DeviceInfo,
  thinkingText?: string
) {
  const steps: any[] = [];
  let searchResults: any[] = [];
  let hasToolCalls = false;
  
  // Process all parts in this CoT block
  block.parts.forEach((part: any, partIndex: number) => {
    if (part.type === 'reasoning' && part.text) {
      steps.push({
        id: `reasoning-${blockIndex}-${partIndex}`,
        type: 'reasoning',
        label: 'AI Reasoning',
        description: part.text,
        status: part.state === 'streaming' ? 'active' : 'complete',
        timestamp: new Date().toISOString(),
        data: { reasoningText: part.text },
      });
    } else if (part.type === 'tool-searchWeb' || 
               (part.type?.includes('tool-') && part.toolName === 'searchWeb')) {
      
      hasToolCalls = true; // Mark that we have tool calls
      const isToolCall = part.type?.includes('call');
      const hasOutput = part.state === 'output-available' || !!part.output;
      
      steps.push({
        id: `searchWeb-${blockIndex}-${partIndex}`,
        type: isToolCall ? 'tool_call' : 'tool_response',
        label: isToolCall ? 'Searching the web' : 'Search Results',
        description: isToolCall 
          ? 'Using web search to find current information' 
          : `Found ${Array.isArray(part.output) ? part.output.length : 0} search results`,
        status: 'complete',
        timestamp: new Date().toISOString(),
        data: { 
          toolName: 'searchWeb',
          toolInput: part.input,
          toolOutput: part.output,
        },
      });
      
      // Collect search results for display
      if (part.output && Array.isArray(part.output)) {
        searchResults = part.output;
      }
    } else if (part.type?.startsWith('tool-')) {
      // Handle other tools generically
      hasToolCalls = true; // Mark that we have tool calls
      const toolName = extractToolName(part);
      const isToolCall = part.type?.includes('call');
      
      steps.push({
        id: `tool-${blockIndex}-${partIndex}`,
        type: isToolCall ? 'tool_call' : 'tool_response',
        label: isToolCall ? `Calling ${toolName}` : `${toolName} Results`,
        description: isToolCall ? `Using ${toolName} tool` : `Received ${toolName} response`,
        status: 'complete',
        timestamp: new Date().toISOString(),
        data: { toolName },
      });
    }
  });

  // Add live reasoning step when streaming
  if (isStreaming) {
    if (liveReasoningText) {
      steps.push({
        id: `live-reasoning-${blockIndex}`,
        type: 'reasoning',
        label: 'AI Reasoning',
        description: liveReasoningText + '▊', // Add blinking cursor
        status: 'active',
        timestamp: new Date().toISOString(),
        data: { reasoningText: liveReasoningText, isLive: true },
      });
    } else if (steps.length === 0) {
      // No steps yet and streaming - create initial placeholder step
      // This ensures "Thinking" shows immediately
      steps.push({
        id: `initial-thinking-${blockIndex}`,
        type: 'reasoning',
        label: 'AI Reasoning',
        description: '',
        status: 'active',
        timestamp: new Date().toISOString(),
        data: { reasoningText: '', isLive: true },
      });
    }
  }

  // Determine default open state based on device
  const defaultOpen = getCoTDefaultOpen(deviceInfo, hasToolCalls);
  
  return (
    <View key={key}>
      <ChainOfThought
        data={{
          steps,
          isComplete: !steps.some(s => s.status === 'active'),
        }}
        isStreaming={isStreaming || steps.some(s => s.status === 'active')}
        defaultOpen={defaultOpen}
        thinkingText={thinkingText}
      />
      
      {/* Show search results if we have them */}
      {searchResults.length > 0 && (
        <ChainOfThoughtSearchResults results={searchResults} />
      )}
    </View>
  );
}

// Removed old individual tool rendering functions - now handled by grouped approach

/**
 * Helper functions
 */
function extractToolName(part: any): string {
  if (part.toolName) return part.toolName;
  if (part.type?.includes('tool-')) {
    return part.type.replace('tool-', '').replace('-call', '').replace('-result', '');
  }
  return 'unknown';
}

export default SimpleMessageRenderer;


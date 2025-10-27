import { UIMessage } from 'ai';

/**
 * Debug utilities for chat endpoint
 * Comprehensive logging and analysis functions
 */

/**
 * Log incoming messages for debugging
 */
export function logIncomingMessages(messages: UIMessage[]) {
  console.log('🔍 INCOMING MESSAGES FROM CLIENT:');
  messages.forEach((msg: any, index: number) => {
    // Extract actual text content from parts array (AI SDK format)
    const textPart = msg.parts?.find((p: any) => p.type === 'text');
    const actualContent = textPart?.text || 'no-text-part';
    
    console.log(`Message ${index + 1}:`, {
      id: msg.id,
      role: msg.role,
      metadata: msg.metadata,
      hasMetadata: !!msg.metadata,
      content: typeof actualContent === 'string' ? actualContent.substring(0, 50) + (actualContent.length > 50 ? '...' : '') : actualContent,
      partsCount: msg.parts?.length || 0
    });
  });
}

/**
 * Log conversation state for debugging
 */
export function logConversationState(conversationId: string, existingMessages: UIMessage[], clientContext?: any) {
  const existingCount = existingMessages.length;
  
  console.log('🌍 CLIENT CONTEXT:', clientContext);
  console.log('📊 CONVERSATION STATE:', {
    conversationId,
    existingMessagesInDB: existingCount,
    existingMessageDetails: existingMessages.map(m => ({ 
      role: m.role, 
      hasText: !!m.parts?.find(p => p.type === 'text')?.text 
    }))
  });
}

/**
 * Log model configuration for debugging
 */
export function logModelConfiguration(messages: UIMessage[], tools: any, modelName: string) {
  console.log('🔧 MODEL CONFIGURATION:');
  console.log('Model:', modelName);
  console.log('Temperature:', 0.7);
  console.log('Max steps:', '10 (via stopWhen)');
  console.log('Tools actually enabled:', Object.keys(tools));
  console.log('Messages to process:', messages.length);
}

/**
 * Log system prompt for debugging
 */
export function logSystemPrompt(systemPrompt: string) {
  console.log('🤖 SYSTEM PROMPT SENT TO AI:');
  console.log('='.repeat(80));
  console.log(systemPrompt);
  console.log('='.repeat(80));
  console.log(`📏 System prompt length: ${systemPrompt.length} characters`);
}

/**
 * Analyze and log final message content (matching web implementation)
 */
export function analyzeResponseContent(allMessages: UIMessage[]) {
  const latestMessage = allMessages[allMessages.length - 1];
  if (latestMessage?.role === 'assistant') {
    console.log('🧠 REASONING DEBUG - Final Message Analysis:');
    console.log('Message parts:', latestMessage.parts?.map(p => ({ type: p.type, hasText: !!(p as any).text })));
    
    const textContent = latestMessage.parts?.find(p => p.type === 'text')?.text;
    const reasoningContent = latestMessage.parts?.find(p => p.type === 'reasoning')?.text;
    
    if (textContent) {
      console.log('🤖 AI Response Content:');
      console.log('='.repeat(50));
      console.log(textContent);
      console.log('='.repeat(50));
      console.log('Contains markdown?', /[*_`#\[\]|]/.test(textContent));
    }
    
    if (reasoningContent) {
      console.log('🧠 AI Reasoning Content:');
      console.log('='.repeat(50));
      console.log(reasoningContent);
      console.log('='.repeat(50));
    } else {
      console.log('⚠️ NO REASONING CONTENT FOUND in final message');
    }
  }
}

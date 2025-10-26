import express from 'express';
import { streamText, UIMessage } from 'ai';
import { authenticateUser, AuthenticatedRequest } from '../../middleware/auth.js';
import { toolRegistry } from './tools/registry.js';
import { setupModelProvider } from './config/modelProvider.js';
import { buildStreamConfig } from './config/streamConfig.js';
import { buildStreamResponse } from './config/streamResponse.js';
import { logIncomingMessages, logConversationState, logModelConfiguration } from './debug.js';
import type { ChatRequest } from '@darkresearch/mallory-shared';

const router = express.Router();

const getClaudeModel = () => {
  return process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
};

/**
 * Chat endpoint for AI streaming with Claude
 * POST /api/chat
 */
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    // Extract and validate request
    const user = req.user!;
    const userId = user.id;
    
    const { messages, conversationId, clientContext }: ChatRequest = req.body;

    logIncomingMessages(messages);

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }

    logConversationState(conversationId, [], clientContext);

    // Filter out system messages (they're triggers, not conversation history)
    const conversationMessages = messages.filter((msg: UIMessage) => msg.role !== 'system');
    console.log('💬 Message processing:', {
      totalMessages: messages.length,
      systemMessages: messages.length - conversationMessages.length,
      conversationMessages: conversationMessages.length
    });

    // Setup model provider with smart strategy
    const { model, processedMessages, strategy } = setupModelProvider(
      conversationMessages,
      conversationId,
      userId,
      getClaudeModel()
    );

    // Prepare tools (always include memory tools if available)
    const supermemoryApiKey = process.env.SUPERMEMORY_API_KEY;
    const tools = {
      searchWeb: toolRegistry.searchWeb,
      nansenHistoricalBalances: toolRegistry.createNansenTool(),
      ...(supermemoryApiKey ? toolRegistry.createSupermemoryTools(supermemoryApiKey, userId) : {}),
    };

    // Log model configuration with actual enabled tools
    logModelConfiguration(messages, tools, getClaudeModel());

    // Build system prompt
    const systemPrompt = buildSystemPrompt(clientContext);

    // Build stream configuration
    const streamConfig = buildStreamConfig({
      model,
      processedMessages,
      systemPrompt,
      tools,
      strategy
    });

    // Start AI streaming
    console.log('🎯 Starting AI stream');
    const result = streamText(streamConfig);
    console.log('✅ streamText call completed');

    // Build UI message stream response
    console.log('🌊 Creating UI message stream response');
    const { streamResponse } = buildStreamResponse(result, messages, conversationId);
    console.log('🚀 Stream response created');

    // Monitor client connection
    req.on('close', () => {
      console.log('🔌 Client disconnected during stream');
    });
    
    req.on('error', (error) => {
      console.log('❌ Client request error:', error);
    });

    // Pipe to Express response
    console.log('🔄 Piping to Express response');
    
    if (streamResponse.headers) {
      (streamResponse.headers as any).forEach((value: any, key: any) => {
        res.setHeader(key, value);
      });
    }
    
    res.status(streamResponse.status || 200);
    
    if (streamResponse.body) {
      const reader = streamResponse.body.getReader();
      
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log('✅ Stream completed successfully');
              res.end();
              break;
            }
            res.write(value);
          }
        } catch (error) {
          console.error('❌ Stream error:', error);
          res.end();
        }
      };
      
      pump();
    } else {
      console.log('❌ No response body found');
      res.status(500).json({ error: 'No response body' });
    }
    
    return;

  } catch (error) {
    console.error('❌ Chat handler error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as chatRouter };

/**
 * Build system prompt with client context
 */
function buildSystemPrompt(clientContext?: ChatRequest['clientContext']): string {
  const contextParts: string[] = [
    'You are a helpful AI assistant for a crypto and AI chat application.',
    'You can help users understand crypto, manage their wallet, and answer questions.',
    '',
    'You have access to the following tools:',
    '- searchWeb: Search the web for current information, news, and crypto/token data',
    '- nansenHistoricalBalances: Get historical token balances for Ethereum addresses from Nansen (premium data, ~0.001 USDC per request)',
    '- addMemory: Store important facts about the user for future conversations',
    '',
    'Use these tools when appropriate to provide accurate, up-to-date information.',
    'When users ask about current events, prices, or news, use searchWeb.',
    'When users ask about Ethereum address history or portfolio analysis, use nansenHistoricalBalances.',
    'When users share preferences or important facts, use addMemory to remember them.',
    '',
    'IMPORTANT - x402 Payment Protocol:',
    '- When nansenHistoricalBalances returns needsPayment=true, DO NOT ask for user confirmation.',
    '- The client is automatically processing the payment in the background (< 0.01 USDC auto-approved).',
    '- Simply say "Fetching Nansen data..." and the client will send you the results as a system message.',
    '- Wait for the system message with the actual data, then present it to the user.',
    '- Never ask "would you like me to proceed" - just proceed automatically.'
  ];

  if (clientContext?.timezone) {
    contextParts.push('');
    contextParts.push(`Current timezone: ${clientContext.timezone}`);
  }

  if (clientContext?.currentTime) {
    contextParts.push(`Current time: ${clientContext.currentTime}`);
  }

  if (clientContext?.device) {
    contextParts.push(`Device: ${clientContext.device}`);
  }

  return contextParts.join('\n');
}


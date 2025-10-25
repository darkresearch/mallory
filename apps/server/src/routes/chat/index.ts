import express from 'express';
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { authenticateUser, AuthenticatedRequest } from '../../middleware/auth.js';
import { toolRegistry } from './tools/registry.js';
import type { ChatRequest } from '@darkresearch/mallory-shared';

const router = express.Router();

/**
 * Chat endpoint for AI streaming with Claude
 * POST /api/chat
 * 
 * Streams AI responses using Server-Sent Events (SSE)
 * Requires authentication via Supabase JWT token
 */
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { messages, conversationId, clientContext }: ChatRequest = req.body;

    console.log('💬 Chat request:', {
      userId: user.id,
      conversationId,
      messageCount: messages.length,
      hasContext: !!clientContext
    });

    // Validate request
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'Messages array is required' 
      });
    }

    if (!conversationId) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'Conversation ID is required' 
      });
    }

    // Build system prompt with context
    const systemPrompt = buildSystemPrompt(clientContext);

    // Build tools object - conditionally include Supermemory
    const tools: any = {
      searchWeb: toolRegistry.searchWeb,
    };

    // Add Supermemory tools if API key is available
    if (process.env.SUPERMEMORY_API_KEY) {
      const memoryTools = toolRegistry.createSupermemoryTools(
        process.env.SUPERMEMORY_API_KEY,
        user.id
      );
      Object.assign(tools, memoryTools);
      console.log('🧠 Supermemory tools enabled for user:', user.id);
    } else {
      console.log('ℹ️  Supermemory not configured (SUPERMEMORY_API_KEY not set)');
    }

    console.log('🤖 Starting Claude stream with tools:', Object.keys(tools));

    // Stream AI response with tools using AI SDK
    const result = streamText({
      model: anthropic(process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514'),
      system: systemPrompt,
      messages: messages.map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      })),
      tools,
      maxTokens: 4096,
      temperature: 0.7,
    });

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Pipe AI SDK stream to response
    result.pipeDataStreamToResponse(res);

    console.log('✅ Chat stream started for conversation:', conversationId);

  } catch (error) {
    console.error('❌ Chat error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Chat failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      });
    }
  }
});

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
    '- addMemory: Store important facts about the user for future conversations',
    '',
    'Use these tools when appropriate to provide accurate, up-to-date information.',
    'When users ask about current events, prices, or news, use searchWeb.',
    'When users share preferences or important facts, use addMemory to remember them.'
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

export { router as chatRouter };


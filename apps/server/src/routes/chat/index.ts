import express, { Router } from 'express';
import { streamText, UIMessage } from 'ai';
import { v4 as uuidv4 } from 'uuid';
import { authenticateUser, AuthenticatedRequest } from '../../middleware/auth.js';
import { toolRegistry } from './tools/registry.js';
import { setupModelProvider } from './config/modelProvider.js';
import { buildStreamConfig } from './config/streamConfig.js';
import { buildStreamResponse } from './config/streamResponse.js';
import { logIncomingMessages, logConversationState, logModelConfiguration } from './debug.js';
import type { ChatRequest } from '@darkresearch/mallory-shared';
import { MALLORY_BASE_PROMPT, buildContextSection, buildVerbosityGuidelines, ONBOARDING_GUIDELINES, ONBOARDING_GREETING_SYSTEM_MESSAGE, ONBOARDING_OPENING_MESSAGE_TEMPLATE } from '../../../prompts/index.js';
import { buildComponentsGuidelines } from '../../../prompts/components.js';
import { supabase } from '../../lib/supabase.js';
import { saveUserMessage } from './persistence.js';
import { ensureToolMessageStructure, validateToolMessageStructure, logMessageStructure, convertReasoningToThinking } from '../../lib/messageTransform.js';

const router: Router = express.Router();

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
    
    const { messages, conversationId, clientContext, gridSessionSecrets, gridSession } = req.body;

    logIncomingMessages(messages);

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }

    // Log Grid context availability (for x402 payments)
    if (gridSessionSecrets && gridSession) {
      console.log('🔐 Grid context available for x402 payments');
    }

    logConversationState(conversationId, [], clientContext);

    // Check for onboarding context
    const systemMessages = messages.filter((msg: any) => msg.role === 'system');
    const isOnboardingGreeting = systemMessages.some((msg: any) => 
      msg.content === 'onboarding_greeting'
    );
    
    // Fetch conversation metadata to check if this is an onboarding conversation
    let conversationMetadata: any = null;
    let isOnboardingConversation = false;
    
    if (isOnboardingGreeting) {
      console.log('🎉 Detected onboarding greeting system message');
      try {
        const { data: conversation, error } = await supabase
          .from('conversations')
          .select('metadata')
          .eq('id', conversationId)
          .single();
        
        if (!error && conversation?.metadata?.is_onboarding) {
          isOnboardingConversation = true;
          conversationMetadata = conversation.metadata;
          console.log('✅ Confirmed onboarding conversation from metadata');
        }
      } catch (error) {
        console.error('⚠️ Error fetching conversation metadata:', error);
      }
    }

    // Save original messages (before synthetic message AND before transformations)
    // IMPORTANT: originalMessages preserves the display order for the client
    const originalMessages = messages.filter((msg: UIMessage) => msg.role !== 'system');
    
    // Filter out system messages (they're triggers, not conversation history)
    let conversationMessages = messages.filter((msg: UIMessage) => msg.role !== 'system');
    console.log('💬 Message processing:', {
      totalMessages: messages.length,
      systemMessages: messages.length - conversationMessages.length,
      conversationMessages: conversationMessages.length,
      isOnboardingGreeting,
      isOnboardingConversation
    });

    // Save user messages immediately (before streaming starts)
    // IMPORTANT: Save BEFORE transformations to preserve original display order
    // This ensures messages persist even if the stream fails or client disconnects
    const userMessages = conversationMessages.filter((msg: UIMessage) => msg.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];
    
    if (lastUserMessage) {
      console.log('💾 Saving user message immediately (with original part order):', lastUserMessage.id);
      await saveUserMessage(conversationId, lastUserMessage);
    }

    // NOW apply transformations for Claude API (these only affect what we send TO Claude)
    // The transformations below do NOT affect what the user sees or what gets saved to the database
    
    // CRITICAL: Ensure tool_use and tool_result blocks are properly structured
    // Anthropic API requires tool_use in assistant messages followed by tool_result in user messages
    console.log('🔧 Checking tool message structure...');
    logMessageStructure(conversationMessages, 'BEFORE transformation');
    
    const validation = validateToolMessageStructure(conversationMessages);
    if (!validation.isValid) {
      console.warn('⚠️ Tool message structure validation failed:', validation.errors);
      console.log('🔧 Attempting to fix tool message structure...');
      conversationMessages = ensureToolMessageStructure(conversationMessages);
      logMessageStructure(conversationMessages, 'AFTER transformation');
      
      // Validate again after transformation
      const revalidation = validateToolMessageStructure(conversationMessages);
      if (!revalidation.isValid) {
        console.error('❌ Tool message structure still invalid after transformation:', revalidation.errors);
      } else {
        console.log('✅ Tool message structure fixed successfully!');
      }
    } else {
      console.log('✅ Tool message structure is valid');
    }

    // CRITICAL: Convert reasoning parts to thinking parts for extended thinking API compatibility
    // The AI SDK uses 'reasoning' internally, but Anthropic's extended thinking API expects 'thinking'
    console.log('🧠 Converting reasoning parts to thinking parts for Anthropic API compatibility...');
    conversationMessages = convertReasoningToThinking(conversationMessages);

    // If system-initiated (proactive) and no messages, add synthetic user prompt
    // AI SDK requires at least one message - can't have just system prompt
    if (isOnboardingGreeting && conversationMessages.length === 0) {
      console.log('🤖 [Proactive] Adding synthetic user message for AI to respond to');
      conversationMessages.push({
        id: uuidv4(),
        role: 'user',
        parts: [{
          type: 'text',
          text: 'Please proceed as instructed, accounting for what you know about me and how I would most prefer your response. Do not mention that you saw this user message of mine or reference it in any way.',
        }],
      } as any);
    }

    // Setup model provider with smart strategy
    const { model, processedMessages, strategy } = setupModelProvider(
      conversationMessages,
      conversationId,
      userId,
      getClaudeModel()
    );

    // Prepare x402 context for Nansen tools
    const x402Context = (gridSessionSecrets && gridSession) ? {
      gridSessionSecrets,
      gridSession
    } : undefined;

    // Prepare tools (always include memory tools if available)
    const supermemoryApiKey = process.env.SUPERMEMORY_API_KEY;
    const tools = {
      searchWeb: toolRegistry.searchWeb,
      nansenHistoricalBalances: toolRegistry.createNansenTool(x402Context),
      nansenSmartMoneyNetflows: toolRegistry.createNansenSmartMoneyNetflowsTool(x402Context),
      nansenSmartMoneyHoldings: toolRegistry.createNansenSmartMoneyHoldingsTool(x402Context),
      // DISABLED - Nansen doesn't allow these endpoints:
      // nansenSmartMoneyDexTrades: toolRegistry.createNansenSmartMoneyDexTradesTool(x402Context),
      // nansenSmartMoneyJupiterDcas: toolRegistry.createNansenSmartMoneyJupiterDcasTool(x402Context),
      nansenCurrentBalance: toolRegistry.createNansenCurrentBalanceTool(x402Context),
      nansenTransactions: toolRegistry.createNansenTransactionsTool(x402Context),
      nansenCounterparties: toolRegistry.createNansenCounterpartiesTool(x402Context),
      nansenRelatedWallets: toolRegistry.createNansenRelatedWalletsTool(x402Context),
      nansenPnlSummary: toolRegistry.createNansenPnlSummaryTool(x402Context),
      nansenPnl: toolRegistry.createNansenPnlTool(x402Context),
      // DISABLED - Nansen doesn't allow this endpoint:
      // nansenLabels: toolRegistry.createNansenLabelsTool(x402Context),
      nansenTokenScreener: toolRegistry.createNansenTokenScreenerTool(x402Context),
      nansenFlowIntelligence: toolRegistry.createNansenFlowIntelligenceTool(x402Context),
      nansenHolders: toolRegistry.createNansenHoldersTool(x402Context),
      nansenFlows: toolRegistry.createNansenFlowsTool(x402Context),
      nansenWhoBoughtSold: toolRegistry.createNansenWhoBoughtSoldTool(x402Context),
      nansenTokenDexTrades: toolRegistry.createNansenTokenDexTradesTool(x402Context),
      nansenTokenTransfers: toolRegistry.createNansenTokenTransfersTool(x402Context),
      nansenTokenJupiterDcas: toolRegistry.createNansenTokenJupiterDcasTool(x402Context),
      nansenPnlLeaderboard: toolRegistry.createNansenPnlLeaderboardTool(x402Context),
      nansenPortfolio: toolRegistry.createNansenPortfolioTool(x402Context),
      ...(supermemoryApiKey ? toolRegistry.createSupermemoryTools(supermemoryApiKey, userId) : {}),
    };

    // Log model configuration with actual enabled tools
    logModelConfiguration(messages, tools, getClaudeModel());

    // Prepare onboarding context if applicable
    const onboardingContext = (isOnboardingGreeting && isOnboardingConversation) ? {
      isOnboarding: true,
      isSystemMessage: true,
      systemTriggerContent: 'onboarding_greeting',
      walletAddress: gridSession?.address || 'N/A'
    } : undefined;

    // Build system prompt
    const systemPrompt = buildSystemPrompt(clientContext, onboardingContext);

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
    // Server-side persistence happens in onFinish callback (saves full message at end)
    console.log('🌊 Creating UI message stream response');
    const { streamResponse } = buildStreamResponse(
      result, 
      originalMessages,  // Use original messages (without synthetic message)
      conversationId, 
      isOnboardingConversation ? { userId, isOnboarding: true } : undefined
    );
    console.log('🚀 Stream response created');
    
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
 * Type guard to check if device is a DeviceInfo object
 */
function isDeviceInfo(device: any): device is { platform: 'ios' | 'android' | 'web'; viewportWidth: number; formFactor: 'mobile' | 'tablet' | 'desktop'; isMobileWeb: boolean } {
  return device && 
    typeof device === 'object' && 
    'platform' in device && 
    'viewportWidth' in device && 
    'formFactor' in device && 
    'isMobileWeb' in device;
}

/**
 * Build system prompt with client context and optional onboarding context
 */
function buildSystemPrompt(
  clientContext?: ChatRequest['clientContext'], 
  onboardingContext?: {
    isOnboarding: boolean;
    isSystemMessage?: boolean;
    systemTriggerContent?: string;
    walletAddress?: string;
  }
): string {
  const sections: string[] = [];
  
  // Handle onboarding greeting if this is a system-initiated onboarding message
  if (onboardingContext?.isOnboarding && onboardingContext?.isSystemMessage && 
      onboardingContext?.systemTriggerContent === 'onboarding_greeting') {
    console.log('🎉 Building onboarding system prompt with wallet address:', onboardingContext.walletAddress);
    
    // Inject the onboarding greeting instructions
    sections.push(ONBOARDING_GREETING_SYSTEM_MESSAGE);
    sections.push(`\n---\n`);
    sections.push(ONBOARDING_GUIDELINES);
    sections.push(`\n---\n`);
    
    // Add the opening message template with wallet address
    const walletAddress = onboardingContext.walletAddress || 'N/A';
    const openingMessage = ONBOARDING_OPENING_MESSAGE_TEMPLATE.replace('{WALLET_ADDRESS}', walletAddress);
    sections.push(`\n## Your Opening Message\n\nUse this as your greeting (customize slightly if you want, but keep the key information):\n\n${openingMessage}`);
    sections.push(`\n---\n`);
  }
  
  // 1. Core Mallory identity and personality
  sections.push(MALLORY_BASE_PROMPT);
  
  // 2. Wallet funding requirements
  sections.push(`

## Wallet & Funding

When the user logged in, a Solana wallet was automatically created for them using **Squads Grid infrastructure** (non-custodial, MPC-based - their keys never exist anywhere, super secure!).

To use Nansen's x402 endpoints, the user will need to fund their wallet with:
- **~0.01 SOL** (for transaction fees - just a tiny bit for gas)
- **A couple dollars of USDC** (for x402 payments - remember, each Nansen call is only 0.001 USDC!)

All Nansen API calls cost **0.001 USDC** (one-tenth of a cent) per request. This means with just $2 USDC, the user can make 2,000 Nansen API calls! That's the magic of x402 - premium data without premium subscription costs.`);

  // 3. Tool capabilities
  sections.push(`

## Your Tools & Capabilities

You have access to powerful tools to help users:

### Web Search (Exa) - Always Available
- **searchWeb**: Search the web for current information, news, crypto prices, and token data
- No payment required - use this freely!
- Great for: current events, token prices, recent news, market updates

### User Memory (Supermemory) - Optional
- **addMemory**: Store important facts about users for future conversations
- Helps you remember user preferences, wallet addresses they care about, investment interests, etc.

### Nansen x402 Tools - Premium Data (0.001 USDC each)

You have access to **19 Nansen API endpoints** via x402! These are the same endpoints that typically require expensive Nansen subscriptions, but now available pay-per-use:

**Wallet Analysis:**
- **nansenHistoricalBalances**: Historical token balances and portfolio over time
- **nansenCurrentBalance**: Current token holdings for an address
- **nansenTransactions**: Transaction history for addresses
- **nansenCounterparties**: Who an address interacts with most
- **nansenRelatedWallets**: Find related/connected wallet addresses
- **nansenPortfolio**: Complete portfolio analysis

**Smart Money Intelligence:**
- **nansenSmartMoneyNetflows**: What tokens are smart money buying/selling
- **nansenSmartMoneyHoldings**: What smart money wallets are holding

**Token Analysis:**
- **nansenTokenScreener**: Screen and filter tokens by various metrics
- **nansenTokenDexTrades**: DEX trading activity for specific tokens
- **nansenTokenTransfers**: Token transfer patterns and flows
- **nansenTokenJupiterDcas**: Jupiter DCA activity for tokens
- **nansenWhoBoughtSold**: See who's buying and selling specific tokens
- **nansenHolders**: Token holder distribution and analysis

**Flow & Movement Analysis:**
- **nansenFlowIntelligence**: Track token flows and movement patterns
- **nansenFlows**: Detailed flow analysis for addresses
- **nansenPnl**: Profit & loss analysis for addresses
- **nansenPnlSummary**: Summary of PnL performance
- **nansenPnlLeaderboard**: Top performing wallets by PnL`);

  // 4. x402 payment handling
  sections.push(`

## IMPORTANT - x402 Payment Handling

When any Nansen tool returns \`needsPayment=true\`:
- **DO NOT ask the user for confirmation** - payments are automatic!
- The client is processing the 0.001 USDC payment in the background (auto-approved, super fast)
- Simply acknowledge you're fetching the data (e.g., "Let me grab that Nansen data for you...")
- Wait for the system message with the actual results
- Then present the data to the user in a clear, helpful way
- **NEVER ask "would you like me to proceed?"** - just proceed automatically

The whole point of x402 is seamless micropayments - users don't want to approve every tenth-of-a-cent!`);

  // 5. Developer context (conditional)
  sections.push(`

## For Developers & Engineers

If a user asks about how you're built or your codebase, you can share:

**Mallory is open source!** 🎉

**Architecture:**
- React Native app (iOS, Android, Web) built with Expo
- Grid-powered embedded wallets (Squads infrastructure, MPC-based, non-custodial)
- Claude AI with streaming conversations and extended thinking
- Dynamic UI component injection for rich, interactive responses
- x402 payment protocol integration via Faremeter/Corbits
- Supabase for authentication and database

**Tech Stack:**
- Frontend: Expo, React Native, Reanimated
- Backend: Node.js, Express
- AI: Anthropic Claude (that's you!)
- Search: Exa AI-powered search
- Memory: Supermemory for user context
- Blockchain Data: Nansen via x402
- Market Data: Birdeye for Solana prices
- Wallet: Grid (Squads)
- Auth: Supabase

**GitHub:** https://github.com/darkresearch/mallory

The codebase is mobile-native and already configured for deployment to Apple App Store, Android App Store, and Solana Seeker App Store. It's a great starting point for anyone building crypto x AI apps!`);

  // 6. Dark & Token info
  sections.push(`

## About Dark & Token Information

You were built by **Dark**, an AI research lab focused on building the future of consumer AI applications.
- Dark's website: https://darkresearch.ai

If users ask if you have a token:
- Mallory does not have her own token
- The only token related to you and Dark is the **Dark token**
- Dark token contract address: \`8BtoThi2ZoXnF7QQK1Wjmh2JuBw9FjVvhnGMVZ2vpump\``);

  // 7. Client context (time, location, device, wallet balance)
  // Convert from shared ClientContext to prompts ClientContext
  const promptsContext = clientContext ? {
    timezone: clientContext.timezone,
    currentTime: clientContext.currentTime,
    currentDate: clientContext.currentDate,
    device: isDeviceInfo(clientContext.device) ? clientContext.device : undefined
  } : undefined;
  
  sections.push(buildContextSection(promptsContext));
  
  // 7b. Wallet balance context and threshold warnings
  if (clientContext?.walletBalance) {
    const { sol, usdc, totalUsd } = clientContext.walletBalance;
    const SOL_THRESHOLD = 0.01;  // Minimum SOL for transaction fees
    const USDC_THRESHOLD = 0.01; // Minimum USDC for x402 payments (~10 Nansen calls)
    
    const solLow = sol !== undefined && sol < SOL_THRESHOLD;
    const usdcLow = usdc !== undefined && usdc < USDC_THRESHOLD;
    
    sections.push(`

## Current Wallet Balance

You have access to the user's current wallet balance:
- **SOL**: ${sol?.toFixed(4) || '0.0000'} SOL
- **USDC**: ${usdc?.toFixed(2) || '0.00'} USDC
- **Total Value**: $${totalUsd?.toFixed(2) || '0.00'} USD

### ⚠️ Low Balance Warnings

${solLow || usdcLow ? `
**IMPORTANT**: The user's wallet balance is LOW!

${solLow ? `- ❌ **SOL is below ${SOL_THRESHOLD} SOL** - User needs SOL for transaction fees\n` : ''}${usdcLow ? `- ❌ **USDC is below $${USDC_THRESHOLD}** - User needs USDC for x402 Nansen endpoints\n` : ''}
**What to do:**
1. If the user tries to use a Nansen x402 endpoint, politely let them know they need to add funds first
2. Mention they can tap the wallet icon to add SOL and USDC
3. Remind them: ~0.01 SOL for fees, and a few dollars USDC for x402 calls (each call is 0.001 USDC)
4. Be friendly and helpful - guide them to the wallet screen to add funds

**Example response:**
"I'd love to help you with that Nansen data! However, I notice your wallet needs a quick top-up first. You'll need about 0.01 SOL for transaction fees and a couple dollars of USDC for the x402 payments (just 0.001 USDC per call, super affordable!). 

Tap the wallet icon at the top to add funds, and then I'll be ready to grab that data for you! 💰"
` : `
✅ **Wallet balance is sufficient** for x402 transactions.
- SOL: ${sol! >= SOL_THRESHOLD ? 'Sufficient for transaction fees' : 'N/A'}
- USDC: ${usdc! >= USDC_THRESHOLD ? 'Ready for x402 payments' : 'N/A'}
`}`);
  }
  
  // 8. Device-specific verbosity guidelines
  const deviceInfo = isDeviceInfo(clientContext?.device) ? clientContext.device : undefined;
  sections.push(buildVerbosityGuidelines(deviceInfo));
  
  // 9. Component rendering capabilities
  sections.push(buildComponentsGuidelines());
  
  return sections.join('\n');
}


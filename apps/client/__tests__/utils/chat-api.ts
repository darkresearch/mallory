/**
 * Chat API Utilities
 * 
 * Helper functions for calling the chat API and parsing responses
 */

import '../setup/test-env';
import { buildClientContext } from '@darkresearch/mallory-shared';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Send a chat message to the API
 * 
 * @param message - Message text
 * @param conversationId - Conversation ID
 * @param authToken - Auth token
 * @param options - Optional config including Grid session for x402
 * @returns Response stream
 */
export async function sendChatMessage(
  message: string,
  conversationId: string,
  authToken: string,
  options?: {
    backendUrl?: string;
    gridSessionSecrets?: any;
    gridSession?: any;
  }
): Promise<Response> {
  const url = options?.backendUrl || process.env.TEST_BACKEND_URL || 'http://localhost:3001';
  const endpoint = `${url}/api/chat`;

  console.log('💬 Sending chat message');
  console.log('   Endpoint:', endpoint);
  console.log('   Message:', message.substring(0, 50) + (message.length > 50 ? '...' : ''));
  console.log('   Conversation:', conversationId);
  if (options?.gridSessionSecrets) {
    console.log('   Grid context: Included (for x402 payments)');
  }

  const body: any = {
    messages: [
      {
        role: 'user',
        content: message,
        parts: [
          {
            type: 'text',
            text: message,
          },
        ],
      },
    ],
    conversationId,
    clientContext: buildClientContext({
      getDeviceInfo: () => 'test-environment'
    }),
  };

  // Include Grid session secrets if provided (for x402 payments)
  if (options?.gridSessionSecrets && options?.gridSession) {
    body.gridSessionSecrets = options.gridSessionSecrets;
    body.gridSession = options.gridSession;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chat API error: ${response.status} - ${errorText}`);
  }

  console.log('✅ Chat API responded');
  console.log('   Status:', response.status);
  console.log('   Content-Type:', response.headers.get('content-type'));

  return response;
}

/**
 * Send chat message with full message history
 * Used for continuing conversations (e.g., after payment completion)
 * 
 * @param conversationId - Conversation ID
 * @param authToken - Auth token
 * @param messages - Full message history including system messages
 * @param backendUrl - Backend URL (optional)
 * @returns Response stream
 */
export async function sendChatWithHistory(
  conversationId: string,
  authToken: string,
  messages: ChatMessage[],
  backendUrl?: string
): Promise<Response> {
  const url = backendUrl || process.env.TEST_BACKEND_URL || 'http://localhost:3001';
  const endpoint = `${url}/api/chat`;

  console.log('💬 Sending chat with message history');
  console.log('   Endpoint:', endpoint);
  console.log('   Messages:', messages.length);
  console.log('   Conversation:', conversationId);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      conversationId,
      clientContext: buildClientContext({
        getDeviceInfo: () => 'test-environment'
      }),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chat API error: ${response.status} - ${errorText}`);
  }

  console.log('✅ Chat API responded');
  console.log('   Status:', response.status);

  return response;
}

/**
 * Parse AI streaming response
 * Extracts messages and detects payment requirements using production logic
 */
export async function parseStreamResponse(response: Response): Promise<{
  fullText: string;
  messages: any[];
  parts: any[];
  hasPaymentRequirement: boolean;
  paymentRequirement: any | null;
}> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  
  let fullText = '';
  const allParts: any[] = [];
  const messages: any[] = [];
  let paymentRequirement: any | null = null;

  console.log('📖 Parsing AI stream...');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    fullText += chunk;

    // Parse AI SDK stream format: "data: {json}\n"
    const lines = chunk.split('\n').filter(line => line.trim() && line.startsWith('data:'));
    
    for (const line of lines) {
      try {
        const jsonStr = line.substring(5).trim(); // Remove "data:" prefix
        const event = JSON.parse(jsonStr);
        
        // Collect parts
        allParts.push(event);
        
        // Check for tool output with payment requirement
        // Event type is 'tool-output-available' (not 'tool-result')
        if (event.type === 'tool-output-available' && event.output?.needsPayment) {
          console.log('💰 Payment requirement detected!');
          console.log('   Tool:', event.output.toolName);
          console.log('   Tool Call ID:', event.toolCallId);
          console.log('   API URL:', event.output.apiUrl);
          console.log('   Cost:', event.output.estimatedCost);
          
          paymentRequirement = event.output;
        }
        
      } catch (e) {
        // Not JSON or different format, skip
      }
    }
  }

  console.log('✅ Stream parsed');
  console.log('   Total length:', fullText.length);
  console.log('   Parts found:', allParts.length);
  console.log('   Payment required:', !!paymentRequirement);

  return {
    fullText,
    messages,
    parts: allParts,
    hasPaymentRequirement: !!paymentRequirement,
    paymentRequirement,
  };
}


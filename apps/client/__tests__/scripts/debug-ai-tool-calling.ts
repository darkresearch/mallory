/**
 * Debug: AI Tool Calling
 * 
 * Sends a message and logs ALL stream events to see if AI is calling tools
 */

import { authenticateTestUser } from '../setup/test-helpers';
import { createTestConversation } from '../utils/conversation-test';
import { sendChatMessage } from '../utils/chat-api';

async function main() {
  console.log('🔍 Debugging AI tool calling...\n');
  
  const auth = await authenticateTestUser();
  const conversationId = await createTestConversation(auth.userId);
  
  console.log('Sending message that should trigger Nansen...');
  const response = await sendChatMessage(
    "What were vitalik.eth's historical token balances on January 1, 2024?",
    conversationId,
    auth.accessToken
  );
  
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  
  console.log('\n📖 ALL STREAM EVENTS:\n');
  console.log('='.repeat(80));
  
  let eventCount = 0;
  let foundToolCall = false;
  let foundToolResult = false;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(l => l.trim() && l.startsWith('data:'));
    
    for (const line of lines) {
      try {
        const jsonStr = line.substring(5).trim();
        const event = JSON.parse(jsonStr);
        
        eventCount++;
        
        // Log tool-related events
        if (event.type?.includes('tool') || event.toolName) {
          console.log(`\n🔧 [${eventCount}] TOOL EVENT:`, event.type);
          console.log('   Full event:', JSON.stringify(event, null, 2));
          
          if (event.type === 'tool-call') {
            foundToolCall = true;
          }
          if (event.type === 'tool-result') {
            foundToolResult = true;
          }
        }
      } catch (e) {
        // Not JSON
      }
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Summary:');
  console.log('   Total events:', eventCount);
  console.log('   Found tool-call:', foundToolCall);
  console.log('   Found tool-result:', foundToolResult);
  console.log();
  
  if (!foundToolCall) {
    console.error('❌ AI did NOT call any tools');
    console.error('   This means the AI chose not to use nansenHistoricalBalances');
    console.error('   Possible reasons:');
    console.error('   - System prompt not emphasizing tool use enough');
    console.error('   - AI thinks it can answer without the tool');
    console.error('   - Tool definition not clear enough');
  } else {
    console.log('✅ AI called a tool!');
  }
}

main();


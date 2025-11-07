import { tool } from 'ai';
import { z } from 'zod';
import Supermemory from 'supermemory';

/**
 * Supermemory tools for user memory management
 * Allows the agent to store and retrieve persistent information about users across conversations
 * 
 * Note: User profiles are automatically maintained from memories stored via addMemory.
 * User scoping is handled via x-sm-user-id header in the Supermemory Infinite Chat proxy.
 */

interface AddMemoryResponse {
  id: string;
  status: string;
}

/**
 * Create supermemory tools scoped to a specific user
 * @param apiKey - Supermemory API key
 * @param userId - User ID to scope memories to (uses containerTag)
 */
export function createSupermemoryTools(apiKey: string, userId: string) {
  const client = new Supermemory({ apiKey });
  
  return {
    addMemory: tool({
      description: 'Store important information about the user for future conversations. Memories automatically build the user profile. Use when user shares preferences, goals, or facts that should be remembered long-term.',
      inputSchema: z.object({
        memory: z.string().describe('Information to remember (e.g., "User prefers on-chain metrics over price action")'),
      }),
      execute: async ({ memory }) => {
        try {
          console.log('🧠 [Supermemory] Adding memory for user:', userId);
          console.log('🧠 [Supermemory] Memory:', memory);
          
          const response = await client.memories.add({
            content: memory,
            containerTags: [userId],  // User-scoped storage
            metadata: {
              source: 'agent',
              timestamp: new Date().toISOString(),
            },
          }) as AddMemoryResponse;
          
          console.log('🧠 [Supermemory] Memory added:', {
            id: response.id,
            status: response.status
          });
          
          return {
            success: true,
            memoryId: response.id,
            status: response.status,
          };
        } catch (error) {
          console.error('🧠 [Supermemory] Add memory error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    }),
  };
}


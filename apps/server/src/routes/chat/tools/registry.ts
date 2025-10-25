import { searchWeb } from './searchWeb.js';
import { createSupermemoryTools } from './supermemory.js';

/**
 * Tool registry for Mallory AI assistant
 * All available tools that the AI can use during conversations
 */

export const toolRegistry = {
  searchWeb,
  createSupermemoryTools
};

// Export individual tools for easier imports
export { searchWeb, createSupermemoryTools };


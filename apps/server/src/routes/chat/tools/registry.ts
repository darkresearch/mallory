import { searchWeb } from './searchWeb.js';
import { createSupermemoryTools } from './supermemory.js';
import { createNansenTool } from './nansen.js';

/**
 * Tool registry for Mallory AI assistant
 * All available tools that the AI can use during conversations
 */

export const toolRegistry = {
  searchWeb,
  createSupermemoryTools,
  createNansenTool
};

// Export individual tools for easier imports
export { searchWeb, createSupermemoryTools, createNansenTool };


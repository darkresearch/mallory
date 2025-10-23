/**
 * Human-readable display names for AI tools
 * Maps internal tool names to user-friendly names
 */

export const toolDisplayNames: Record<string, string> = {
  // Web search
  searchWeb: 'Exa Search',
  
  // Supermemory tools
  searchMemories: 'Supermemory',
  addMemory: 'Supermemory',
};

/**
 * Get human-readable display name for a tool
 * Falls back to original name if no mapping exists
 */
export function getToolDisplayName(toolName: string): string {
  return toolDisplayNames[toolName] || toolName;
}

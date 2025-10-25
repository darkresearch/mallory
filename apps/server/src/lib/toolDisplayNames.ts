/**
 * Human-readable display names for AI tools
 * Maps internal tool names to user-friendly names
 * Shared mapping with mobile client for consistency
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

/**
 * Format tool results for logging with human-readable names
 */
export function formatToolResultsForLog(toolResults: any[]): any[] {
  return toolResults.map(r => ({
    toolName: r.toolName,
    displayName: getToolDisplayName(r.toolName),
    hasResult: !!(r as any).result,
    resultType: typeof (r as any).result,
    resultPreview: (r as any).result 
      ? JSON.stringify((r as any).result).substring(0, 200) + '...' 
      : 'null'
  }));
}

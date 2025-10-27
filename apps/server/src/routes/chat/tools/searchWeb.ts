import { tool } from 'ai';
import { z } from 'zod';
import Exa from 'exa-js';

let _exaClient: Exa | null = null;

// Lazy initialization to ensure environment variables are loaded
function getExaClient(): Exa {
  if (_exaClient) {
    return _exaClient;
  }
  
  const apiKey = process.env.EXA_API_KEY || process.env.EXASEARCH_API_KEY;
  if (!apiKey) {
    throw new Error('Missing EXA API key. Set EXA_API_KEY or EXASEARCH_API_KEY environment variable.');
  }
  
  _exaClient = new Exa(apiKey);
  return _exaClient;
}

// Debug configuration
const debugConfig = {
  enabled: process.env.NODE_ENV === 'development',
  logToolCalls: true
};

export const searchWeb = tool({
  description: 'Search the web for up-to-date information and current events, optimized for Solana ecosystem and crypto research',
  inputSchema: z.object({
    query: z.string().min(1).max(100).describe('The search query'),
    
    // Result optimization - always use 25 for maximum value
    numResults: z.number().min(1).max(25).default(25)
      .describe('Number of results (always use 25 for best value since pricing is the same)'),
    
    // Solana-specific domain targeting
    includeDomains: z.array(z.string()).optional()
      .describe('Target specific domains: pump.fun, moonshot.com, coindesk.com, dexscreener.com, etc.'),
    
    excludeDomains: z.array(z.string()).optional()
      .describe('Exclude irrelevant domains: bitcoin.com, ethereum.org, etc.'),
    
    // Content freshness - default true for real-time token info
    livecrawl: z.boolean().default(true)
      .describe('Use real-time crawling for breaking news and token launches, false for historical research'),
    
    // Date filtering for time-sensitive queries
    startPublishedDate: z.string().optional()
      .describe('Filter to content after this date (YYYY-MM-DD format)'),
    
    endPublishedDate: z.string().optional()
      .describe('Filter to content before this date (YYYY-MM-DD format)'),
    
    // Content type optimization
    category: z.enum(['news', 'research', 'company', 'pdf']).optional()
      .describe('Filter by content type for targeted results'),
    
    // Content filtering
    includeText: z.array(z.string()).optional()
      .describe('Results must contain these exact phrases'),
    
    excludeText: z.array(z.string()).optional()
      .describe('Exclude results with these terms: scam, rug, shill, etc.'),
  }),
  execute: async ({ 
    query, 
    numResults = 25, 
    includeDomains, 
    excludeDomains, 
    livecrawl = true,
    startPublishedDate,
    endPublishedDate,
    category,
    includeText,
    excludeText
  }) => {
    if (debugConfig.enabled && debugConfig.logToolCalls) {
      console.group(`🔧 Tool: searchWeb`);
      console.log('Input:', { 
        query, 
        numResults, 
        includeDomains, 
        excludeDomains, 
        livecrawl,
        startPublishedDate,
        endPublishedDate,
        category,
        includeText,
        excludeText
      });
      console.time('Execution');
    }

    try {
      // Build Exa search options
      const searchOptions: any = {
        livecrawl: livecrawl ? 'always' : 'never',
        numResults,
      };

      // Add domain filtering
      if (includeDomains && includeDomains.length > 0) {
        searchOptions.includeDomains = includeDomains;
      }
      
      if (excludeDomains && excludeDomains.length > 0) {
        searchOptions.excludeDomains = excludeDomains;
      }

      // Add date filtering
      if (startPublishedDate) {
        searchOptions.startPublishedDate = startPublishedDate;
      }
      
      if (endPublishedDate) {
        searchOptions.endPublishedDate = endPublishedDate;
      }

      // Add category filtering
      if (category) {
        searchOptions.category = category;
      }

      // Add text filtering
      if (includeText && includeText.length > 0) {
        searchOptions.includeText = includeText;
      }
      
      if (excludeText && excludeText.length > 0) {
        searchOptions.excludeText = excludeText;
      }

      console.log('🔍 Exa search options:', searchOptions);

      const exaResponse = await getExaClient().searchAndContents(query, searchOptions);

      // Log raw Exa response for debugging
      console.log('🔍 Raw Exa API Response:', JSON.stringify(exaResponse, null, 2));

      const { results } = exaResponse;
      const searchResults = results.map(result => ({
        title: result.title,
        url: result.url,
        content: result.text?.slice(0, 1000) || '', // First 1000 chars
        publishedDate: result.publishedDate,
      }));

      if (debugConfig.enabled) {
        console.log('✅ Search successful:', {
          resultsCount: searchResults.length,
          results: searchResults
        });
        console.timeEnd('Execution');
        console.groupEnd();
      }

      // Debug: Log exactly what we're returning to the AI
      console.log('🔄 RETURNING TO AI:', {
        type: typeof searchResults,
        isArray: Array.isArray(searchResults),
        length: searchResults.length,
        firstResult: searchResults[0] ? {
          title: searchResults[0].title,
          url: searchResults[0].url,
          hasContent: !!searchResults[0].content
        } : null
      });

      return searchResults;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorDetails = {
        error: errorMessage,
        query,
        timestamp: new Date().toISOString()
      };
      
      console.error('🚨 Web search error:', errorDetails);
      
      if (debugConfig.enabled) {
        console.timeEnd('Execution');
        console.groupEnd();
      }
      
      // Return a more descriptive error for the AI
      return { 
        error: `Web search failed: ${errorMessage}`,
        query,
        retryable: !errorMessage.includes('credits limit')
      };
    }
  },
});


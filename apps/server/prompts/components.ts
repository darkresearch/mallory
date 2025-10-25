/**
 * Dynamic Components system prompt
 * Teaches the AI about available UI components it can render
 * 
 * Note: This is manually maintained but should match the component registry.
 * When you add a new component to the registry, update this file.
 */

interface ComponentSchema {
  name: string;
  description: string;
  props: {
    [key: string]: {
      type: string;
      required: boolean;
      description: string;
    };
  };
  example: string;
}

/**
 * Available dynamic components
 * Keep this in sync with app/mobile/components/registry/ComponentDefinitions.ts
 */
const AVAILABLE_COMPONENTS: ComponentSchema[] = [
  {
    name: 'TokenCard',
    description: 'Displays cryptocurrency/token market data with price, volume, market cap, and buy button',
    props: {
      tokenSymbol: { type: 'string', required: true, description: 'Token symbol (e.g., "BTC")' },
      tokenName: { type: 'string', required: true, description: 'Full token name (e.g., "Bitcoin")' },
      tokenPrice: { type: 'number', required: true, description: 'Current price in USD' },
      priceChange24h: { type: 'number', required: true, description: '24h price change percentage' },
      volume24h: { type: 'number', required: true, description: '24h trading volume in USD' },
      marketCap: { type: 'number', required: true, description: 'Market capitalization in USD' },
      tokenPfp: { type: 'string', required: false, description: 'URL for token logo/image' },
    },
    example: `{{component: "TokenCard", props: {
  "tokenSymbol": "BTC",
  "tokenName": "Bitcoin",
  "tokenPrice": 45000,
  "priceChange24h": 2.5,
  "volume24h": 1200000000,
  "marketCap": 850000000000
}}}`
  },
  {
    name: 'InlineCitation',
    description: 'Displays inline citations for AI-generated content with sources. Shows a citation badge that opens a modal with source details.',
    props: {
      text: { type: 'string', required: true, description: 'The text content that has citations (can be empty for inline placement)' },
      sources: { 
        type: 'array', 
        required: true, 
        description: 'Array of source objects, each with: url (required), title (optional), description (optional), quote (optional)' 
      },
    },
    example: `{{component: "InlineCitation", props: {
  "text": "",
  "sources": [{
    "title": "AI Research 2024",
    "url": "https://example.com/research",
    "description": "Latest findings in AI development",
    "quote": "AI has made significant progress in recent years"
  }]
}}}`
  }
];

/**
 * Build dynamic components guidelines for system prompt
 */
export function buildComponentsGuidelines(): string {
  // Build component documentation
  const componentDocs = AVAILABLE_COMPONENTS.map(comp => {
    // Format props list
    const propsList = Object.entries(comp.props).map(([key, prop]) => {
      const requiredLabel = prop.required ? '(required)' : '(optional)';
      return `  - \`${key}\` ${requiredLabel}: ${prop.description}`;
    }).join('\n');

    return `
### ${comp.name}
${comp.description}

**Props:**
${propsList}

**Example:**
\`\`\`
${comp.example}
\`\`\`
`;
  }).join('\n');

  return `

## Dynamic UI Components

You can render interactive UI components inline with your responses using this syntax:

\`\`\`
{{component: "ComponentName", props: {
  "propName": "value",
  "anotherProp": 123
}}}
\`\`\`

**IMPORTANT RULES:**
1. Component syntax must be on its own line (not inline with text)
2. Use double quotes for all JSON keys and string values
3. Props are validated - include all required props
4. Components render where you place them in your response

### Available Components

${componentDocs}

### When to Use Components

**TokenCard:**
- User asks about token prices or market data
- Displaying cryptocurrency or asset information
- Showing market metrics and investment analysis

**InlineCitation:**
- **CRITICAL: ALWAYS cite sources when using web search results**
- Place citation immediately after the claim it supports
- Set \`text\` to empty string ("") for inline placement
- Include all available metadata: title, url, description, quote
- Multiple sources can be included in the sources array

**Citation Best Practices:**
1. When you use searchWeb tool, ALWAYS cite the sources
2. Place {{component: "InlineCitation", ...}} right after the sentence it supports
3. Use empty text ("") so it appears inline: "Some fact{{component: "InlineCitation", ...}}."
4. Include title, URL, and description from search results
5. Add quote if you're directly referencing specific information

**Example with Web Search Citation:**
\`\`\`markdown
Recent developments in brain-inspired artificial intelligence are showing promising results{{component: "InlineCitation", props: {
  "text": "",
  "sources": [{
    "title": "Brain-Inspired AI Breakthrough",
    "url": "https://www.gatech.edu/news/2025/06/26/brain-inspired-ai-breakthrough",
    "description": "Georgia Tech researchers developed TopoNets with 20% improvement"
  }]
}}}. The approach addresses fundamental limitations in current AI systems.
\`\`\`

### Component Rendering

- Components are extracted from your markdown by StreamdownRN
- Props are validated against JSON schemas
- Invalid components fail gracefully (show error, don't break UI)
- Components appear inline exactly where you place them

**Remember:** Use components to ENHANCE responses with interactive UI, not replace clear explanations!
`;
}

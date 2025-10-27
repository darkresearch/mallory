# Dynamic UI Components

This directory contains **dynamic components** that are rendered based on AI responses. These components are registered in the component registry and can be instantiated by the AI using special syntax.

## Architecture

```
AI Response (Markdown + Component Markers)
    ↓
StreamdownRN (extracts components)
    ↓
Component Registry (validates props)
    ↓
React Native Component (rendered inline)
```

## Component Syntax

The AI uses this syntax to render components:

```
{{component: "ComponentName", props: {
  "propName": "value",
  "anotherProp": 123
}}}
```

## Available Components

### 1. TokenCard

**Purpose:** Display cryptocurrency/token market data with price, volume, market cap, and buy button.

**Use Cases:**
- Showing token prices in response to queries
- Displaying search results for crypto tokens
- Providing market data context

**Props:**
```typescript
{
  tokenSymbol: string;      // e.g., "BTC"
  tokenName: string;        // e.g., "Bitcoin"
  tokenPrice: number;       // e.g., 45000
  priceChange24h: number;   // e.g., 2.5 (percentage)
  volume24h: number;        // e.g., 1200000000
  marketCap: number;        // e.g., 850000000000
  tokenPfp?: string;        // Optional image URL
  onInstabuyPress?: () => void;  // Optional buy handler
}
```

**Example:**
```
Here's the current Bitcoin price:

{{component: "TokenCard", props: {
  "tokenSymbol": "BTC",
  "tokenName": "Bitcoin",
  "tokenPrice": 45000,
  "priceChange24h": 2.5,
  "volume24h": 1200000000,
  "marketCap": 850000000000
}}}
```

---

### 2. InlineCitation

**Purpose:** Display inline citations with sources for AI-generated content, similar to academic references.

**Use Cases:**
- Providing sources for factual claims
- Citing research or articles
- Building trust with referenced information
- Academic-style responses

**Props:**
```typescript
{
  text: string;  // The text content that has citations
  sources: Array<{
    url: string;           // Required: Source URL
    title?: string;        // Optional: Source title
    description?: string;  // Optional: Brief description
    quote?: string;        // Optional: Relevant excerpt
  }>;
}
```

**Features:**
- Shows a small badge with source hostname (e.g., "example.com +2")
- Tapping badge opens a modal with full source details
- Carousel navigation for multiple sources
- Clickable URLs that open in browser
- Optional quotes/excerpts from sources
- Elegant, non-intrusive design

**Example:**
```
According to recent studies, artificial intelligence has shown remarkable progress in natural language processing {{component: "InlineCitation", props: {
  "text": "",
  "sources": [
    {
      "title": "AI Advances 2024",
      "url": "https://example.com/ai-advances",
      "description": "A comprehensive study on recent AI breakthroughs",
      "quote": "Machine learning models have achieved unprecedented accuracy in NLP tasks."
    }
  ]
}}}. The technology continues to evolve rapidly {{component: "InlineCitation", props: {
  "text": "",
  "sources": [
    {
      "title": "Tech Evolution Report",
      "url": "https://techreview.com/evolution"
    },
    {
      "title": "Future of AI",
      "url": "https://ai-future.org/predictions"
    }
  ]
}}}.
```

**Design Notes:**
- Adapted from Vercel's AI Elements InlineCitation
- React Native doesn't have hover, so uses modal instead
- Badge shows hostname to save space
- Multiple sources show count (e.g., "+2")
- Modal provides full details with carousel navigation

---

## Adding New Components

To add a new dynamic component:

1. **Create the component** in this directory (`/ui/`)
2. **Register it** in `/registry/ComponentDefinitions.ts`:
   ```typescript
   {
     name: 'MyComponent',
     component: MyComponent,
     category: 'dynamic',
     description: 'What it does',
     propsSchema: { /* JSON schema */ },
     examples: [ /* example props */ ]
   }
   ```
3. **Document it** in this file and the main README
4. **Test it** by using the component syntax in a message

## Design Principles

1. **Simple Props:** Keep prop interfaces simple and intuitive
2. **Self-Contained:** Components should be self-sufficient
3. **Error Handling:** Gracefully handle missing/invalid props
4. **Mobile-First:** Design for small screens first
5. **Dark Theme:** Match the app's dark aesthetic
6. **Accessible:** Ensure keyboard navigation and screen reader support

## Technical Details

- **Validation:** All props are validated against JSON schemas
- **Rendering:** Components are extracted from markdown and rendered inline
- **Context:** Components receive standard React Native context
- **Errors:** Invalid props or rendering errors show graceful fallbacks

## Component Guidelines

### DO:
✅ Use clear, descriptive prop names  
✅ Provide sensible defaults  
✅ Handle edge cases (empty data, errors)  
✅ Match the app's design system  
✅ Include comprehensive examples  

### DON'T:
❌ Require complex nested structures  
❌ Depend on external state  
❌ Use web-only APIs  
❌ Ignore accessibility  
❌ Assume prop validity  

---

## Registry Integration

Dynamic components are automatically:
- ✅ Validated against schemas
- ✅ Extracted from AI responses
- ✅ Rendered inline with markdown
- ✅ Error-handled with fallbacks
- ✅ Available to the AI immediately after registration

The registry provides type-safe, validated, and extensible component management for the app's dynamic UI system.

# Dynamic UI Component Registry

This system provides a centralized registry for managing React Native components that can be dynamically rendered based on LLM responses.

## Overview

The component registry enables our chat interface to become a programmable UI platform where the AI can compose complex, interactive interfaces by specifying which components to render and with what props.

## Architecture

### Core Files

- **`ComponentRegistry.ts`** - Main registry class with validation
- **`ComponentDefinitions.ts`** - All component definitions and schemas
- **`index.ts`** - Registry initialization and exports
- **`ComponentRegistry.test.ts`** - Examples and usage documentation

### Component Categories

The registry contains **only dynamic components** - components that the LLM decides when and how to render.

**Dynamic Components** (in registry):
- `InlineCitation` - Inline citations with source modal

**Static Components** (NOT in registry):
- Static chat components are imported normally
- Input/Composer - Always-present user input (import normally)

> **Why this separation?** Static components are always rendered and follow normal React patterns. The registry adds unnecessary overhead for components that don't need dynamic lookup or runtime validation.

## Usage

### Basic Setup

```typescript
import { initializeComponentRegistry, componentRegistry } from './components/registry';

// Initialize all components
initializeComponentRegistry();

// Check if component exists
const hasTokenCard = componentRegistry.has('TokenCard');

// Get component definition
const tokenCardDef = componentRegistry.get('TokenCard');

// Validate props
const validation = componentRegistry.validate('TokenCard', props);
```

### LLM Integration Pattern

The LLM can specify components using JSON blocks in its responses:

```
Here's the Bitcoin data you requested:

{{component: "TokenCard", props: {
  "tokenSymbol": "BTC",
  "tokenName": "Bitcoin",
  "tokenPrice": 45000,
  "priceChange24h": 2.5,
  "volume24h": 1200000000,
  "marketCap": 850000000000,
  "tokenPfp": "https://example.com/btc.png"
}}}

Let me create a research task:

{{component: "Task", props: {
  "title": "Bitcoin Analysis",
  "defaultOpen": true
}}}
```

### Component Registration

To add a new component:

```typescript
import { ComponentDefinition, registerComponent } from './registry';

const newComponentDef: ComponentDefinition = {
  name: 'MyComponent',
  component: MyReactComponent,
  category: 'dynamic',
  description: 'My custom component',
  propsSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      count: { type: 'number' }
    },
    required: ['title']
  },
  examples: [
    { title: 'Example', count: 42 }
  ]
};

registerComponent(newComponentDef);
```

## Props Validation

Each component has a JSON schema that validates props:

```typescript
// This will validate successfully
const validProps = {
  tokenSymbol: 'BTC',
  tokenName: 'Bitcoin',
  tokenPrice: 50000,
  priceChange24h: 2.5,
  volume24h: 1500000000,
  marketCap: 950000000000
};

const result = componentRegistry.validate('TokenCard', validProps);
// result.valid === true

// This will fail validation
const invalidProps = {
  tokenSymbol: 'BTC'
  // Missing required fields
};

const failResult = componentRegistry.validate('TokenCard', invalidProps);
// failResult.valid === false
// failResult.errors === ['Missing required field: tokenName', ...]
```

## Available Components

### InlineCitation
Displays inline citations for AI-generated content with sources. Shows a citation badge that opens a modal with source details.

**Required Props:**
- `text` (string) - The text content that has citations
- `sources` (array) - Array of source citations, each with:
  - `url` (string, required) - Source URL
  - `title` (string, optional) - Source title
  - `description` (string, optional) - Brief description
  - `quote` (string, optional) - Relevant excerpt

**Example Usage:**
```
{{component: "InlineCitation", props: {
  "text": "According to recent studies, artificial intelligence has shown remarkable progress.",
  "sources": [
    {
      "title": "AI Advances 2024",
      "url": "https://example.com/ai-advances",
      "description": "A comprehensive study on recent AI breakthroughs",
      "quote": "Machine learning models have achieved unprecedented accuracy."
    }
  ]
}}}
```

**Features:**
- Inline citation badge showing source hostname and count
- Modal popup with full source details
- Carousel navigation for multiple sources
- Clickable URLs that open in browser
- Support for quotes/excerpts
- Clean, accessible design

## Development

### Adding New Components

1. Create your React Native component
2. Add it to `ComponentDefinitions.ts`
3. Define its props schema
4. Add examples
5. The component will be automatically registered

### Testing

Run the examples to test the registry:

```typescript
import { runAllExamples } from './ComponentRegistry.test';

runAllExamples();
```

### Debugging

Enable development mode to see detailed registry logs:

```typescript
// In __DEV__ mode, the registry will log:
// - Component registrations
// - Registry statistics
// - All registered components
```

## Next Steps

This registry system is the foundation for:

1. **Enhanced Parser** - Parse LLM responses for component instructions
2. **Renderer Engine** - Render mixed content (text + components)
3. **AI SDK Integration** - Connect with streaming chat responses
4. **Component Interactions** - Handle component actions and callbacks

The registry provides type-safe, validated, and extensible component management for our dynamic UI system.

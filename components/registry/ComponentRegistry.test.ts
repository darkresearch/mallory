/**
 * Component Registry Tests & Examples
 * 
 * This file demonstrates how to use the component registry system
 * and serves as both tests and documentation.
 */

import { componentRegistry, ComponentDefinition } from './ComponentRegistry';
import { initializeComponentRegistry, validateRegistry } from './index';

/**
 * Example: Basic registry usage
 */
export function exampleBasicUsage() {
  console.log('\n=== Basic Registry Usage Example ===');
  
  // Initialize the registry
  initializeComponentRegistry();
  
  // Check if a component exists
  const hasTokenCard = componentRegistry.has('TokenCard');
  console.log(`TokenCard registered: ${hasTokenCard}`);
  
  // Get a component
  const tokenCardDef = componentRegistry.get('TokenCard');
  if (tokenCardDef) {
    console.log(`Found: ${tokenCardDef.name} (${tokenCardDef.category})`);
    console.log(`Description: ${tokenCardDef.description}`);
  }
  
  // List all components (all are dynamic)
  const components = componentRegistry.list();
  console.log(`Components: ${components.map(c => c.name).join(', ')}`);
  
  // Get registry stats
  const stats = componentRegistry.getStats();
  console.log(`Registry stats:`, stats);
}

/**
 * Example: Props validation
 */
export function examplePropsValidation() {
  console.log('\n=== Props Validation Example ===');
  
  // Valid TokenCard props
  const validTokenCardProps = {
    tokenSymbol: 'BTC',
    tokenName: 'Bitcoin',
    tokenPrice: 50000,
    priceChange24h: 2.5,
    volume24h: 1500000000,
    marketCap: 950000000000,
    tokenPfp: 'https://example.com/btc.png',
    onInstabuyPress: () => console.log('Buy!')
  };
  
  const validResult = componentRegistry.validate('TokenCard', validTokenCardProps);
  console.log('Valid props result:', validResult);
  
  // Invalid TokenCard props (missing required fields)
  const invalidTokenCardProps = {
    tokenSymbol: 'BTC',
    // Missing required fields
  };
  
  const invalidResult = componentRegistry.validate('TokenCard', invalidTokenCardProps);
  console.log('Invalid props result:', invalidResult);
  
  // Non-existent component
  const nonExistentResult = componentRegistry.validate('NonExistentComponent', {});
  console.log('Non-existent component result:', nonExistentResult);
}

/**
 * Example: Component registration
 */
export function exampleComponentRegistration() {
  console.log('\n=== Component Registration Example ===');
  
  // Create a simple test component
  const TestComponent = ({ message }: { message: string }) => null;
  
  // Define component
  const testComponentDef: ComponentDefinition = {
    name: 'TestComponent',
    component: TestComponent,
    category: 'dynamic',
    description: 'A simple test component',
    propsSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      },
      required: ['message']
    },
    examples: [
      { message: 'Hello, world!' }
    ]
  };
  
  // Register the component
  componentRegistry.register(testComponentDef);
  
  // Validate it works
  const testResult = componentRegistry.validate('TestComponent', { message: 'Test' });
  console.log('Test component validation:', testResult);
  
  // Clean up
  const allBefore = componentRegistry.getStats().total;
  // Note: We don't have a remove method, but we could add one if needed
  console.log(`Total components after test: ${allBefore}`);
}

/**
 * Example: LLM Response Simulation
 * This shows how the registry would be used in practice
 */
export function exampleLLMResponseSimulation() {
  console.log('\n=== LLM Response Simulation Example ===');
  
  // Simulate an LLM response with component instructions
  const mockLLMResponse = `
  Based on your question about Bitcoin, here's the current market data:
  
  {{component: "TokenCard", props: {
    "tokenSymbol": "BTC",
    "tokenName": "Bitcoin", 
    "tokenPrice": 45000,
    "priceChange24h": 3.2,
    "volume24h": 1200000000,
    "marketCap": 850000000000,
    "tokenPfp": "https://example.com/btc.png"
  }}}
  
  Let me also create a research task for you:
  
  {{component: "Task", props: {
    "title": "Bitcoin Research",
    "defaultOpen": true
  }}}
  `;
  
  // Parse component instructions (this would be done by our parser)
  const componentInstructions = [
    {
      component: 'TokenCard',
      props: {
        tokenSymbol: 'BTC',
        tokenName: 'Bitcoin',
        tokenPrice: 45000,
        priceChange24h: 3.2,
        volume24h: 1200000000,
        marketCap: 850000000000,
        tokenPfp: 'https://example.com/btc.png',
        onInstabuyPress: () => console.log('Buy BTC!')
      }
    },
    {
      component: 'Task',
      props: {
        title: 'Bitcoin Research',
        defaultOpen: true
      }
    }
  ];
  
  // Validate each component instruction
  componentInstructions.forEach((instruction, index) => {
    const validation = componentRegistry.validate(instruction.component, instruction.props);
    console.log(`Instruction ${index + 1} (${instruction.component}):`, validation);
    
    if (validation.valid) {
      const componentDef = componentRegistry.get(instruction.component);
      console.log(`✅ Ready to render ${componentDef?.name}`);
    } else {
      console.log(`❌ Cannot render ${instruction.component}: ${validation.errors.join(', ')}`);
    }
  });
}

/**
 * Run all examples
 */
export function runAllExamples() {
  console.log('🧪 Running Component Registry Examples...\n');
  
  try {
    exampleBasicUsage();
    examplePropsValidation();
    exampleComponentRegistration();
    exampleLLMResponseSimulation();
    
    // Final validation
    const isValid = validateRegistry();
    console.log(`\n✅ All examples completed. Registry valid: ${isValid}`);
    
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Export for use in development
if (__DEV__) {
  // Uncomment to run examples on import
  // runAllExamples();
}

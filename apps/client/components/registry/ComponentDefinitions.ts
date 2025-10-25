import { ComponentDefinition } from './ComponentRegistry';

// Import dynamic components (LLM-controlled only)
// Only components from the ui/ directory should be in the registry
import { InlineCitationWrapper } from '../ui/InlineCitationWrapper';

/**
 * Dynamic component definitions
 * These components are rendered based on LLM responses
 * 
 * IMPORTANT: Only components from the ui/ directory should be defined here.
 * These are dynamic components that the LLM can choose to render when necessary.
 * 
 * Components from other directories (like chat/) should be imported and used
 * directly in their respective contexts, not through the registry system.
 */
export const dynamicComponents: ComponentDefinition[] = [
  {
    name: 'InlineCitation',
    component: InlineCitationWrapper,
    category: 'dynamic',
    description: 'Displays inline citations for AI-generated content with sources. Shows a citation badge that opens a modal with source details.',
    propsSchema: {
      type: 'object',
      properties: {
        text: { 
          type: 'string', 
          description: 'The text content that has citations' 
        },
        sources: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { 
                type: 'string', 
                description: 'Source title' 
              },
              url: { 
                type: 'string', 
                description: 'Source URL (required)' 
              },
              description: { 
                type: 'string', 
                description: 'Brief description of the source' 
              },
              quote: { 
                type: 'string', 
                description: 'Relevant excerpt or quote from the source' 
              }
            },
            required: ['url']
          },
          description: 'Array of source citations. At least one source with a URL is required.'
        }
      },
      required: ['text', 'sources']
    },
    examples: [
      {
        text: 'According to recent studies, artificial intelligence has shown remarkable progress in natural language processing.',
        sources: [
          {
            title: 'AI Advances 2024',
            url: 'https://example.com/ai-advances',
            description: 'A comprehensive study on recent AI breakthroughs',
            quote: 'Machine learning models have achieved unprecedented accuracy in natural language processing tasks.'
          }
        ]
      },
      {
        text: 'The technology continues to evolve rapidly, with new breakthroughs announced regularly.',
        sources: [
          {
            title: 'Tech Evolution Report',
            url: 'https://example.com/tech-report',
            description: 'Analysis of technological trends and future predictions'
          },
          {
            title: 'Future of AI - MIT Technology Review',
            url: 'https://example.com/future-ai',
            description: 'Predictions and emerging patterns in artificial intelligence',
            quote: 'The next decade will see AI systems becoming increasingly sophisticated.'
          }
        ]
      },
      {
        text: 'Recent findings suggest a 45% increase in AI adoption across enterprises.',
        sources: [
          {
            title: 'Enterprise AI Survey 2024',
            url: 'https://example.com/enterprise-ai-survey'
          }
        ]
      }
    ]
  }
];

/**
 * All dynamic components (this is now the same as dynamicComponents)
 * Static components are not part of the registry system
 */
export const allComponents: ComponentDefinition[] = dynamicComponents;

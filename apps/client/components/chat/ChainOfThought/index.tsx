import React from 'react';
import { ChainOfThought } from './ChainOfThought';
import { ChainOfThoughtHeader } from './ChainOfThoughtHeader';
import { ChainOfThoughtContent } from './ChainOfThoughtContent';
import { ChainOfThoughtStep } from './ChainOfThoughtStep';
import { ChainOfThoughtSearchResults, ChainOfThoughtSearchResult } from './ChainOfThoughtSearchResults';
import { PulsingStar } from './PulsingStar';
// Removed: StreamingChainOfThought and ChronologicalRenderer (obsolete)

// Re-export core components (removed obsolete ones)
export { 
  ChainOfThought, 
  ChainOfThoughtHeader, 
  ChainOfThoughtContent, 
  ChainOfThoughtStep,
  ChainOfThoughtSearchResults,
  ChainOfThoughtSearchResult,
  PulsingStar 
};

// Re-export types
export type {
  ChainOfThoughtProps,
  ChainOfThoughtHeaderProps,
  ChainOfThoughtContentProps,
  ChainOfThoughtStepProps,
  ChainOfThoughtData,
  ChainOfThoughtStep as ChainOfThoughtStepType,
} from './types';

// Removed obsolete ScoutChainOfThought component - SimpleMessageRenderer handles this now

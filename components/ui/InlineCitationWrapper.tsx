/**
 * InlineCitationWrapper - Simplified interface for AI to use InlineCitation
 * 
 * This wrapper composes all the InlineCitation subcomponents into a single
 * component that the AI can easily instantiate with simple props.
 */

import React from 'react';
import {
  InlineCitation,
  InlineCitationText,
  InlineCitationCard,
  InlineCitationCardTrigger,
  InlineCitationCardBody,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselItem,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselPrev,
  InlineCitationCarouselNext,
  InlineCitationSource,
  InlineCitationQuote,
} from './InlineCitation';

export interface InlineCitationWrapperProps {
  /** The text content that has citations */
  text: string;
  /** Array of source citations */
  sources: Array<{
    title?: string;
    url: string;
    description?: string;
    quote?: string;
  }>;
}

/**
 * InlineCitationWrapper - Single component for AI to render citations
 * 
 * Usage in AI response:
 * {{component: "InlineCitation", props: {
 *   "text": "According to recent studies...",
 *   "sources": [
 *     {
 *       "title": "AI Research",
 *       "url": "https://example.com/research",
 *       "description": "Latest AI findings",
 *       "quote": "AI has made significant progress"
 *     }
 *   ]
 * }}}
 */
export const InlineCitationWrapper: React.FC<InlineCitationWrapperProps> = ({ 
  text, 
  sources 
}) => {
  // Filter out sources without URLs
  const validSources = sources.filter(source => source.url);
  
  if (validSources.length === 0) {
    return null; // No valid sources, render nothing
  }

  // Extract URLs for the trigger badge
  const sourceUrls = validSources.map(source => source.url);

  // Return ONLY the InlineCitationCard (badge + modal)
  // This is truly inline since we're not wrapping in View
  return (
    <InlineCitationCard>
      <InlineCitationCardTrigger sources={sourceUrls} />
      
      <InlineCitationCardBody>
        <InlineCitationCarousel>
          <InlineCitationCarouselHeader>
            <InlineCitationCarouselPrev />
            <InlineCitationCarouselNext />
            <InlineCitationCarouselIndex />
          </InlineCitationCarouselHeader>
          
          <InlineCitationCarouselContent>
            {validSources.map((source, index) => (
              <InlineCitationCarouselItem key={`source-${index}`}>
                <InlineCitationSource
                  title={source.title}
                  url={source.url}
                  description={source.description}
                />
                {source.quote && (
                  <InlineCitationQuote>
                    {source.quote}
                  </InlineCitationQuote>
                )}
              </InlineCitationCarouselItem>
            ))}
          </InlineCitationCarouselContent>
        </InlineCitationCarousel>
      </InlineCitationCardBody>
    </InlineCitationCard>
  );
};

export default InlineCitationWrapper;

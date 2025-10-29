/**
 * AI Completeness Reviewer
 * 
 * Uses Claude (same API as production) to evaluate if responses are complete
 * Much more reliable than heuristics like punctuation or length
 */

import Anthropic from '@anthropic-ai/sdk';

// Get API key from environment (same as production backend)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.GRID_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.warn('⚠️  ANTHROPIC_API_KEY not set - completeness review will be skipped');
}

const anthropic = ANTHROPIC_API_KEY ? new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
}) : null;

export interface CompletenessReview {
  isComplete: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  missingElements?: string[];
}

/**
 * Ask Claude to review if a response is complete
 * 
 * @param userQuestion - The original question asked
 * @param aiResponse - The AI's response to review
 * @param modelName - Claude model to use (default: same as production)
 * @returns Completeness review from Claude
 */
export async function reviewResponseCompleteness(
  userQuestion: string,
  aiResponse: string,
  modelName: string = 'claude-sonnet-4-20250514' // Same as production (Sonnet 4.5)
): Promise<CompletenessReview> {
  
  if (!anthropic) {
    console.warn('⚠️  Skipping AI completeness review (no API key)');
    return {
      isComplete: true, // Assume complete if we can't verify
      confidence: 'low',
      reasoning: 'Could not perform AI review - no API key',
    };
  }

  try {
    const reviewPrompt = `You are reviewing whether an AI assistant's response is complete.

USER QUESTION:
${userQuestion}

AI RESPONSE:
${aiResponse}

TASK: Determine if this response is complete or if it appears to be cut off mid-thought.

Consider:
- Does the response fully address the question?
- Does it end naturally, or does it seem interrupted?
- Are there incomplete sentences, thoughts, or lists?
- If listing items (e.g., "5 steps"), are all items present?

Respond ONLY with valid JSON in this exact format:
{
  "isComplete": true or false,
  "confidence": "high" or "medium" or "low",
  "reasoning": "Brief explanation of your assessment",
  "missingElements": ["optional array of what's missing if incomplete"]
}`;

    const message = await anthropic.messages.create({
      model: modelName,
      max_tokens: 500, // Short response needed
      temperature: 0.3, // Low temperature for consistent evaluation
      messages: [{
        role: 'user',
        content: reviewPrompt,
      }],
    });

    // Extract text content
    const textContent = message.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in Claude response');
    }

    // Parse JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not find JSON in Claude response');
    }

    const review = JSON.parse(jsonMatch[0]) as CompletenessReview;
    
    console.log('🤖 AI Completeness Review:');
    console.log('   Complete:', review.isComplete ? '✅' : '❌');
    console.log('   Confidence:', review.confidence);
    console.log('   Reasoning:', review.reasoning);
    if (review.missingElements && review.missingElements.length > 0) {
      console.log('   Missing:', review.missingElements.join(', '));
    }

    return review;

  } catch (error) {
    console.error('❌ Error during AI completeness review:', error);
    
    // If review fails, we can't be sure - return low confidence
    return {
      isComplete: false,
      confidence: 'low',
      reasoning: `Review failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Convenience wrapper that throws if response is incomplete with high confidence
 * Use this in tests for strict validation
 */
export async function assertResponseComplete(
  userQuestion: string,
  aiResponse: string,
  modelName?: string
): Promise<void> {
  const review = await reviewResponseCompleteness(userQuestion, aiResponse, modelName);
  
  // Only fail test if Claude is confident the response is incomplete
  if (!review.isComplete && review.confidence === 'high') {
    throw new Error(
      `AI Review: Response appears INCOMPLETE\n` +
      `Reasoning: ${review.reasoning}\n` +
      `Missing: ${review.missingElements?.join(', ') || 'N/A'}\n` +
      `\nUser Question: ${userQuestion}\n` +
      `Response (first 200 chars): ${aiResponse.substring(0, 200)}...\n` +
      `Response (last 200 chars): ...${aiResponse.substring(aiResponse.length - 200)}`
    );
  }
  
  if (!review.isComplete && review.confidence === 'medium') {
    console.warn('⚠️  AI Review: Response MAY be incomplete (medium confidence)');
    console.warn('   Reasoning:', review.reasoning);
    // Don't throw - just warn
  }
}

/**
 * Get the Claude model name used in production
 * Read from server config if possible, otherwise use default
 */
export function getProductionModelName(): string {
  // This matches the model in apps/server/src/routes/chat/index.ts
  return process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
}


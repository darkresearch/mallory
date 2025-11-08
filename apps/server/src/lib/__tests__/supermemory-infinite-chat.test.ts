import { describe, test, expect } from 'bun:test';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, streamText } from 'ai';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Integration test to verify Supermemory Infinite Chat actually works
 * 
 * This test verifies that Supermemory can handle contexts that EXCEED
 * Claude's native 200k token limit by using intelligent compression.
 * 
 * We send 400k+ tokens and expect Supermemory to:
 * 1. Compress/optimize the context automatically
 * 2. Successfully call Claude without "max input tokens exceeded"
 * 3. Return a coherent response
 */

describe('Supermemory Infinite Chat Integration', () => {
  const supermemoryApiKey = process.env.SUPERMEMORY_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  
  // Skip if API keys not configured
  const shouldRun = supermemoryApiKey && anthropicApiKey;
  
  test.skipIf(!shouldRun)('handles 400k+ tokens (exceeding Claude 200k limit)', async () => {
    if (!supermemoryApiKey || !anthropicApiKey) {
      throw new Error('Test requires SUPERMEMORY_API_KEY and ANTHROPIC_API_KEY');
    }
    
    console.log('🧪 Testing Supermemory Infinite Chat with 400k+ token conversation...');
    
    // Create a massive conversation that exceeds Claude's 200k token limit
    // Each message is ~5k tokens, so 40 pairs (80 messages) = 400k tokens
    const largeText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(1000); // ~5k tokens per message
    
    const messages: any[] = [];
    for (let i = 0; i < 40; i++) {
      messages.push(
        { role: 'user', content: `Message ${i}: ${largeText}` },
        { role: 'assistant', content: `Response ${i}: I understand. ${largeText}` }
      );
    }
    
    // Add final user message
    messages.push({
      role: 'user',
      content: 'Based on all the context above, what is the sum of 2+2?'
    });
    
    // Count tokens using official Anthropic SDK
    const anthropicClient = new Anthropic({ apiKey: anthropicApiKey });
    const tokenCount = await anthropicClient.beta.messages.countTokens({
      model: 'claude-sonnet-4-20250514',
      messages: messages as any,
    });
    
    console.log(`📊 Generated conversation with ${tokenCount.input_tokens} tokens`);
    console.log(`📊 Total messages: ${messages.length}`);
    console.log(`✅ Exceeds Claude's 200k limit: ${tokenCount.input_tokens > 200000}`);
    
    // Verify we actually exceed the limit
    expect(tokenCount.input_tokens).toBeGreaterThan(200000);
    console.log('✅ Test conversation is definitely over 200k tokens');
    
    // Now send through Supermemory - it should handle this gracefully
    console.log('🧠 Sending 400k+ tokens through Supermemory Infinite Chat...');
    
    // Custom fetch to log Supermemory headers
    const fetchWithLogging: typeof fetch = async (input, init) => {
      const response = await fetch(input, init);
      const contextModified = response.headers.get('x-supermemory-context-modified');
      const originalTokens = response.headers.get('x-supermemory-original-tokens');
      const finalTokens = response.headers.get('x-supermemory-final-tokens');
      const tokensSaved = response.headers.get('x-supermemory-tokens-saved');
      const costSaved = response.headers.get('x-supermemory-cost-saved-usd');
      
      console.log('📊 [Supermemory Headers]:', {
        contextModified,
        originalTokens,
        finalTokens,
        tokensSaved,
        costSavedUSD: costSaved
      });
      
      return response;
    };
    
    const infiniteChatProvider = createAnthropic({
      baseURL: 'https://api.supermemory.ai/v3/https://api.anthropic.com/v1',
      apiKey: anthropicApiKey,
      headers: {
        'x-supermemory-api-key': supermemoryApiKey,
        'x-sm-conversation-id': 'test-infinite-chat',
        'x-sm-user-id': 'test-user',
      },
      fetch: fetchWithLogging,
    });
    
    const model = infiniteChatProvider('claude-sonnet-4-20250514');
    
    // This should NOT throw "max input tokens exceeded"
    // Supermemory should compress/optimize automatically
    const result = await generateText({
      model,
      messages: messages.map(m => ({
        role: m.role as any,
        content: m.content
      })),
      maxTokens: 100,
    });
    
    console.log('✅ Supermemory successfully handled 400k+ tokens!');
    console.log(`📝 Response: ${result.text.substring(0, 100)}...`);
    
    // Verify we got a response
    expect(result.text).toBeTruthy();
    expect(result.text.length).toBeGreaterThan(0);
    
    // The response should be coherent (contain "4" since we asked for 2+2)
    expect(result.text.toLowerCase()).toContain('4');
    
    console.log('✅ Response is coherent and answers the question!');
    console.log('🎉 Supermemory Infinite Chat WORKS - it handled 2x the Claude limit!');
  }, 60000); // 60 second timeout for API call

  test.skipIf(!shouldRun)('handles 400k+ tokens with STREAMING (exceeding Claude 200k limit)', async () => {
    if (!supermemoryApiKey || !anthropicApiKey) {
      throw new Error('Test requires SUPERMEMORY_API_KEY and ANTHROPIC_API_KEY');
    }
    
    console.log('🧪 Testing Supermemory Infinite Chat with STREAMING and 400k+ token conversation...');
    
    // Create a massive conversation that exceeds Claude's 200k token limit
    // Each message is ~5k tokens, so 40 pairs (80 messages) = 400k tokens
    const largeText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(1000); // ~5k tokens per message
    
    const messages: any[] = [];
    for (let i = 0; i < 40; i++) {
      messages.push(
        { role: 'user', content: `Message ${i}: ${largeText}` },
        { role: 'assistant', content: `Response ${i}: I understand. ${largeText}` }
      );
    }
    
    // Add final user message
    messages.push({
      role: 'user',
      content: 'Based on all the context above, what is the sum of 2+2?'
    });
    
    // Count tokens using official Anthropic SDK
    const anthropicClient = new Anthropic({ apiKey: anthropicApiKey });
    const tokenCount = await anthropicClient.beta.messages.countTokens({
      model: 'claude-sonnet-4-20250514',
      messages: messages as any,
    });
    
    console.log(`📊 Generated conversation with ${tokenCount.input_tokens} tokens`);
    console.log(`📊 Total messages: ${messages.length}`);
    console.log(`✅ Exceeds Claude's 200k limit: ${tokenCount.input_tokens > 200000}`);
    
    // Verify we actually exceed the limit
    expect(tokenCount.input_tokens).toBeGreaterThan(200000);
    console.log('✅ Test conversation is definitely over 200k tokens');
    
    // Now send through Supermemory using STREAMING - it should handle this gracefully
    console.log('🧠 Sending 400k+ tokens through Supermemory Infinite Chat with STREAMING...');
    
    // Custom fetch to log Supermemory headers
    const fetchWithLogging: typeof fetch = async (input, init) => {
      const response = await fetch(input, init);
      const contextModified = response.headers.get('x-supermemory-context-modified');
      const originalTokens = response.headers.get('x-supermemory-original-tokens');
      const finalTokens = response.headers.get('x-supermemory-final-tokens');
      const tokensSaved = response.headers.get('x-supermemory-tokens-saved');
      const costSaved = response.headers.get('x-supermemory-cost-saved-usd');
      
      console.log('📊 [Supermemory Headers]:', {
        contextModified,
        originalTokens,
        finalTokens,
        tokensSaved,
        costSavedUSD: costSaved
      });
      
      return response;
    };
    
    const infiniteChatProvider = createAnthropic({
      baseURL: 'https://api.supermemory.ai/v3/https://api.anthropic.com/v1',
      apiKey: anthropicApiKey,
      headers: {
        'x-supermemory-api-key': supermemoryApiKey,
        'x-sm-conversation-id': 'test-infinite-chat-streaming',
        'x-sm-user-id': 'test-user',
      },
      fetch: fetchWithLogging,
    });
    
    const model = infiniteChatProvider('claude-sonnet-4-20250514');
    
    // This should NOT throw "max input tokens exceeded"
    // Supermemory should compress/optimize automatically
    const result = streamText({
      model,
      messages: messages.map(m => ({
        role: m.role as any,
        content: m.content
      })),
      maxTokens: 100,
    });
    
    // Consume the stream and collect the text
    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
    }
    
    console.log('✅ Supermemory successfully handled 400k+ tokens with STREAMING!');
    console.log(`📝 Response: ${fullText.substring(0, 100)}...`);
    
    // Verify we got a response
    expect(fullText).toBeTruthy();
    expect(fullText.length).toBeGreaterThan(0);
    
    // The response should be coherent (contain "4" since we asked for 2+2)
    expect(fullText.toLowerCase()).toContain('4');
    
    console.log('✅ Response is coherent and answers the question!');
    console.log('🎉 Supermemory Infinite Chat with STREAMING WORKS - it handled 2x the Claude limit!');
  }, 60000); // 60 second timeout for API call
});

/**
 * InlineCitation Examples
 * 
 * This file demonstrates how the InlineCitation component is used.
 * These examples mirror how the AI will render citations in its responses.
 */

import React from 'react';
import { View, ScrollView, StyleSheet, Text } from 'react-native';
import { InlineCitationWrapper } from './InlineCitationWrapper';

export function InlineCitationExamples() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      <Text style={styles.sectionTitle}>Example 1: Single Source Citation</Text>
      <View style={styles.exampleContainer}>
        <InlineCitationWrapper
          text="According to recent studies, artificial intelligence has shown remarkable progress in natural language processing."
          sources={[
            {
              title: 'AI Advances 2024',
              url: 'https://example.com/ai-advances',
              description: 'A comprehensive study on recent AI breakthroughs',
              quote: 'Machine learning models have achieved unprecedented accuracy in natural language processing tasks.'
            }
          ]}
        />
      </View>

      <Text style={styles.sectionTitle}>Example 2: Multiple Sources</Text>
      <View style={styles.exampleContainer}>
        <InlineCitationWrapper
          text="The technology continues to evolve rapidly, with new breakthroughs announced regularly."
          sources={[
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
            },
            {
              title: 'AI Research Digest',
              url: 'https://research.ai/digest-2024'
            }
          ]}
        />
      </View>

      <Text style={styles.sectionTitle}>Example 3: Citation Without Quote</Text>
      <View style={styles.exampleContainer}>
        <InlineCitationWrapper
          text="Recent findings suggest a 45% increase in AI adoption across enterprises."
          sources={[
            {
              title: 'Enterprise AI Survey 2024',
              url: 'https://example.com/enterprise-ai-survey',
              description: 'Annual survey of AI adoption in Fortune 500 companies'
            }
          ]}
        />
      </View>

      <Text style={styles.sectionTitle}>Example 4: Minimal Citation (URL only)</Text>
      <View style={styles.exampleContainer}>
        <InlineCitationWrapper
          text="Studies show significant improvements in model efficiency."
          sources={[
            {
              url: 'https://arxiv.org/abs/example-paper-2024'
            }
          ]}
        />
      </View>

      <Text style={styles.sectionTitle}>Example 5: In-Context Usage</Text>
      <View style={styles.exampleContainer}>
        <Text style={styles.contextText}>
          Here's how citations appear in flowing text:
          {'\n\n'}
          Artificial intelligence research has made significant strides in recent years.{' '}
        </Text>
        <InlineCitationWrapper
          text="Deep learning models now achieve near-human performance on many tasks"
          sources={[
            {
              title: 'Deep Learning Benchmarks 2024',
              url: 'https://benchmarks.ai/2024-results',
              description: 'Comprehensive evaluation of state-of-the-art models'
            }
          ]}
        />
        <Text style={styles.contextText}>
          {' '}and the pace of innovation continues to accelerate.
        </Text>
      </View>

      <Text style={styles.note}>
        💡 Tap any citation badge to view full source details with carousel navigation.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05080C',
  },
  content: {
    padding: 16,
    gap: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#DCE9FF',
    marginBottom: 8,
  },
  exampleContainer: {
    backgroundColor: '#151820',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  contextText: {
    color: '#DCE9FF',
    fontSize: 16,
    lineHeight: 24,
  },
  note: {
    color: '#8E8E93',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 16,
  },
});

export default InlineCitationExamples;

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ChainOfThoughtHeader } from './ChainOfThoughtHeader';
import { ChainOfThoughtContent } from './ChainOfThoughtContent';
import { ChainOfThoughtStep } from './ChainOfThoughtStep';
import { ChainOfThoughtProps } from './types';

/**
 * ChainOfThought - Main container component
 * Shows AI reasoning process with collapsible interface
 * Mirrors Vercel's AI SDK ChainOfThought for React Native
 */
export const ChainOfThought: React.FC<ChainOfThoughtProps> = ({
  data,
  isStreaming = false,
  defaultOpen = false,
  onOpenChange,
  style,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = () => {
    const newOpen = !isOpen;
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  // Don't render if no steps and not streaming
  // Allow rendering when streaming to show immediate "Thinking" feedback
  if ((!data.steps || data.steps.length === 0) && !isStreaming) {
    return null;
  }

  // Calculate total duration from steps if not provided
  const totalDuration = data.totalDuration || 
    (data.steps?.reduce((sum, step) => sum + (step.duration || 0), 0) || 0);

  return (
    <View style={[styles.container, style]}>
      <ChainOfThoughtHeader
        isOpen={isOpen}
        onPress={handleToggle}
        isStreaming={isStreaming}
        totalDuration={totalDuration}
      />
      
      <ChainOfThoughtContent isOpen={isOpen}>
        {data.steps?.map((step, index) => (
          <ChainOfThoughtStep
            key={step.id}
            step={step}
            isLast={index === data.steps.length - 1}
            showConnector={true}
          />
        ))}
        
        {/* Streaming indicator removed - SimpleMessageRenderer handles this with pulsing star */}
      </ChainOfThoughtContent>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 8,
  },
});

export default ChainOfThought;

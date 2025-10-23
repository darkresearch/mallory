import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChainOfThoughtStepProps, STEP_ICONS, STEP_COLORS } from './types';
import { getToolDisplayName } from '../../../lib/toolDisplayNames';

/**
 * ChainOfThoughtStep - Individual step in the reasoning process
 * Shows icon, label, description, and optional connector line
 */
export const ChainOfThoughtStep: React.FC<ChainOfThoughtStepProps> = ({
  step,
  isLast = false,
  showConnector = true,
  style,
}) => {
  const iconName = STEP_ICONS[step.type] || 'ellipse'; // Fallback to a simple dot icon
  const color = STEP_COLORS[step.status];
  
  // Debug: Log icon selection
  console.log('🎨 ChainOfThoughtStep icon:', { 
    stepType: step.type, 
    iconName, 
    color, 
    status: step.status,
    availableIcons: Object.keys(STEP_ICONS) 
  });
  
  // Apply opacity based on status
  const opacity = step.status === 'pending' ? 0.4 : step.status === 'complete' ? 0.8 : 1.0;

  return (
    <View style={[styles.stepContainer, style]}>
      {/* Icon and connector line */}
      <View style={styles.iconContainer}>
        <Ionicons
          name={iconName}
          size={16}
          color={color}
          style={{ opacity }}
        />
        {showConnector && !isLast && (
          <View style={[styles.connector, { opacity: 0.3 }]} />
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.label, { color, opacity }]}>
          {step.label}
        </Text>
        
        {step.description && (
          <Text style={[styles.description, { opacity: opacity * 0.8 }]}>
            {step.description}
          </Text>
        )}

        {/* Tool call details */}
        {step.type === 'tool_call' && step.data?.toolName && (
          <View style={styles.toolDetails}>
            <Text style={[styles.toolName, { opacity: opacity * 0.7 }]}>
              Tool: {getToolDisplayName(step.data.toolName)}
            </Text>
          </View>
        )}

        {/* Error details */}
        {step.status === 'error' && step.data?.error && (
          <Text style={[styles.error, { opacity: opacity * 0.9 }]}>
            {step.data.error}
          </Text>
        )}

        {/* Duration if available */}
        {step.duration && (
          <Text style={[styles.duration, { opacity: opacity * 0.6 }]}>
            {step.duration}ms
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  stepContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    paddingTop: 2, // Align with text baseline
  },
  connector: {
    position: 'absolute',
    top: 20,
    bottom: -12,
    left: '50%',
    width: 1,
    backgroundColor: '#DCE9FF',
    marginLeft: -0.5, // Center the line
  },
  content: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  description: {
    fontSize: 12,
    color: '#DCE9FF',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  toolDetails: {
    marginTop: 2,
  },
  toolName: {
    fontSize: 11,
    color: '#DCE9FF',
    fontStyle: 'italic',
  },
  error: {
    fontSize: 12,
    color: '#ef4444',
    lineHeight: 16,
  },
  duration: {
    fontSize: 10,
    color: '#DCE9FF',
    marginTop: 2,
  },
});

export default ChainOfThoughtStep;

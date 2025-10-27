import React from 'react';
import { View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

interface ModernMenuIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * Modern two-line hamburger menu icon (ChatGPT-style)
 * Top line is longer, left-aligned, with close spacing
 */
export const ModernMenuIcon: React.FC<ModernMenuIconProps> = ({ 
  size = 24, 
  color = '#000',
  strokeWidth = 2 
}) => {
  const shortLineWidth = size * 0.5; // Bottom line is 50% of icon width
  const longLineWidth = size * 0.75;  // Top line is 75% of icon width
  const spacing = size * 0.300;       // Tighter vertical spacing between lines
  const startX = size * 0.125;        // Left-aligned starting position
  const topY = size * 0.3;            // Top-aligned vertical position
  
  return (
    <View style={{ width: size, height: size, justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Top line (longer) */}
        <Line
          x1={startX}
          y1={topY}
          x2={startX + longLineWidth}
          y2={topY}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        
        {/* Bottom line (shorter) */}
        <Line
          x1={startX}
          y1={topY + spacing}
          x2={startX + shortLineWidth}
          y2={topY + spacing}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};


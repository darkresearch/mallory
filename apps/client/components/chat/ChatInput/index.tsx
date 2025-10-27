import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPlaceholder } from './AnimatedPlaceholder';

interface ChatInputProps {
  onSend?: (message: string) => void;
  onStop?: () => void;
  onVoiceStart?: () => void;
  onAttachmentPress?: () => void;
  placeholder?: string;
  disabled?: boolean;
  hasMessages?: boolean;
  isStreaming?: boolean;
}

export function ChatInput({
  onSend,
  onStop,
  onVoiceStart,
  onAttachmentPress,
  placeholder = "Ask me anything",
  disabled = false,
  hasMessages = false,
  isStreaming = false
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [height, setHeight] = useState(44); // Starting height as specified
  const textInputRef = useRef<TextInput>(null);

  const handleSend = () => {
    const messageText = text.trim();
    if (!messageText) return;

    // Clear input immediately for better UX
    setText('');
    setHeight(44); // Reset to starting height

    // Send to parent - server handles all storage
    onSend?.(messageText);
  };

  const handleStop = () => {
    onStop?.();
  };

  const handleContentSizeChange = (event: any) => {
    // Auto-resize based on native text measurement - works reliably across all devices
    const contentHeight = event.nativeEvent.contentSize.height;
    const newHeight = Math.max(44, Math.min(contentHeight + 16, 132)); // Max ~5 lines
    
    // Native measurement knows the exact text wrapping and font metrics
    setHeight(newHeight);
  };


  const handleTextChange = (newText: string) => {
    setText(newText);
    
    // If text is empty, reset height to minimum immediately
    if (newText.trim() === '') {
      setHeight(44);
      return;
    }

    // Let onContentSizeChange handle all height adjustments based on native measurement
    // This provides accurate sizing for any device width, zoom level, and text content
  };

  const handleKeyPress = (event: any) => {
    if (event.nativeEvent.key === 'Enter') {
      // Check if Shift is pressed for new line
      const isShiftPressed = event.nativeEvent.shiftKey;
      
      if (isShiftPressed) {
        // Shift+Enter: Add new line (let default behavior happen)
        // Don't prevent default - allow the newline to be inserted
        return;
      } else {
        // Just Enter: Send message (only on web, mobile handles this differently)
        if (Platform.OS === 'web') {
          event.preventDefault();
          handleSend();
        }
        // On mobile, Enter naturally creates new lines, send button is used to send
      }
    }
  };

  const canSend = text.trim().length > 0;

  return (
    <View 
      style={styles.container}
      // @ts-ignore - className works on web for React Native Web
      {...(Platform.OS === 'web' && { className: 'chat-input-fixed' })}
    >
      <View style={[styles.inputBar, { height }]}>
        {/* Plus button for attachments - COMMENTED OUT */}
        {/* <TouchableOpacity 
          style={styles.actionButton}
          onPress={onAttachmentPress}
          disabled={disabled}
        >
          <Ionicons 
            name="add" 
            size={20} 
            color="rgba(255, 255, 255, 0.6)" 
          />
        </TouchableOpacity> */}

        {/* Animated multilingual placeholder */}
        <AnimatedPlaceholder isVisible={text.length === 0} hasMessages={hasMessages} />

        {/* Text input */}
        <TextInput
          ref={textInputRef}
          style={[
            styles.textInput,
            { 
              height: Math.max(28, height - 16), // Account for container padding
              color: text ? '#FFF2E8' : '#E0CBB9'
            }
          ]}
          value={text}
          onChangeText={handleTextChange}
          onKeyPress={handleKeyPress}
          placeholderTextColor="#E0CBB9"
          multiline={true}
          onContentSizeChange={handleContentSizeChange}
          editable={!disabled}
          textAlignVertical="top"
          scrollEnabled={false}
          selectionColor="rgba(0, 0, 0, 0.3)"
          underlineColorAndroid="transparent"
          blurOnSubmit={false}
          returnKeyType="default"
          autoCorrect={false}
          spellCheck={false}
        />

        {/* Action buttons - Microphone and Send */}
        <View style={styles.rightActions}>
          {/* Microphone button - COMMENTED OUT */}
          {/* <TouchableOpacity 
            style={styles.actionButton}
            onPress={onVoiceStart}
            disabled={disabled}
          >
            <Ionicons 
              name="mic-outline" 
              size={20} 
              color="rgba(255, 255, 255, 0.6)" 
            />
          </TouchableOpacity> */}

          {/* Send/Stop button */}
          {isStreaming ? (
            <TouchableOpacity 
              style={styles.stopButton}
              onPress={handleStop}
              disabled={disabled}
            >
              <Ionicons 
                name="square" 
                size={14} 
                color="#D6D6D6" 
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[
                styles.sendButton,
                { opacity: canSend ? 1 : 0.5 }
              ]}
              onPress={handleSend}
              disabled={disabled || !canSend}
            >
              <Ionicons 
                name="arrow-forward" 
                size={16} 
                color="#D6D6D6" 
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    // On web, .chat-input-fixed CSS handles positioning and safe areas
    // Horizontal padding removed to match original layout
  },
  inputBar: {
    backgroundColor: '#984400',
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
  },
  actionButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    fontFamily: 'Satoshi',
    fontSize: 16,
    lineHeight: 20,
    paddingVertical: 4,
    paddingHorizontal: 8,
    textAlignVertical: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    // Web-specific focus removal (TypeScript will ignore these on native)
    ...(Platform.OS === 'web' && {
      outline: 'none',
      outlineWidth: 0,
      outlineStyle: 'none',
    }),
  } as any,
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sendButton: {
    backgroundColor: '#FBAA69',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  stopButton: {
    backgroundColor: '#FBAA69',
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

export default ChatInput;

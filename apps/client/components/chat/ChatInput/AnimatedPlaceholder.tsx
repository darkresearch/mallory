import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

interface AnimatedPlaceholderProps {
  isVisible: boolean;
  hasMessages?: boolean;
}

// Translations for "Ask anything" in 20 languages
const translations = [
  { lang: 'English', text: 'Ask anything' },
  { lang: 'Turkish', text: 'Her şeyi sorun' },
  { lang: 'Chinese', text: '询问任何问题' },
  { lang: 'Spanish', text: 'Pregunta cualquier cosa' },
  { lang: 'French', text: 'Posez toute question' },
  { lang: 'German', text: 'Fragen Sie alles' },
  { lang: 'Japanese', text: '何でも聞いてください' },
  { lang: 'Korean', text: '무엇이든 물어보세요' },
  { lang: 'Arabic', text: 'اسأل أي شيء' },
  { lang: 'Portuguese', text: 'Pergunte qualquer coisa' },
  { lang: 'Russian', text: 'Спросите что угодно' },
  { lang: 'Italian', text: 'Chiedi qualsiasi cosa' },
  { lang: 'Dutch', text: 'Vraag alles' },
  { lang: 'Hindi', text: 'कुछ भी पूछें' },
  { lang: 'Indonesian', text: 'Tanyakan apa saja' },
  { lang: 'Thai', text: 'ถามอะไรก็ได้' },
  { lang: 'Vietnamese', text: 'Hỏi bất cứ điều gì' },
  { lang: 'Polish', text: 'Zapytaj o cokolwiek' },
  { lang: 'Swedish', text: 'Fråga vad som helst' },
  { lang: 'Greek', text: 'Ρωτήστε οτιδήποτε' },
];

// Create pattern: English every 5 rotations
// Pattern: English → Lang1 → Lang2 → Lang3 → Lang4 → English → Lang5...
const createLanguagePattern = () => {
  const pattern: typeof translations = [];
  const englishTranslation = translations[0];
  const otherLanguages = translations.slice(1); // 19 other languages

  let langIndex = 0;
  
  // Build pattern with English appearing every 5 items
  while (langIndex < otherLanguages.length) {
    pattern.push(englishTranslation); // Add English
    
    // Add next 4 languages (or remaining if less than 4)
    for (let i = 0; i < 4 && langIndex < otherLanguages.length; i++) {
      pattern.push(otherLanguages[langIndex]);
      langIndex++;
    }
  }
  
  // Add English at the end if not already there
  if (pattern[pattern.length - 1].lang !== 'English') {
    pattern.push(englishTranslation);
  }
  
  return pattern;
};

const languagePattern = createLanguagePattern();

export function AnimatedPlaceholder({ isVisible, hasMessages = false }: AnimatedPlaceholderProps) {
  const opacity = useSharedValue(1);
  const currentIndex = useSharedValue(0);
  const [displayText, setDisplayText] = React.useState(hasMessages ? 'Reply...' : languagePattern[0].text);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  useEffect(() => {
    if (!isVisible) {
      // Reset to first item when hidden
      currentIndex.value = 0;
      setDisplayText(hasMessages ? 'Reply...' : languagePattern[0].text);
      opacity.value = 1;
      return;
    }

    // If there are messages, show static "Reply..." instead of animating
    if (hasMessages) {
      setDisplayText('Reply...');
      opacity.value = 1;
      return;
    }

    // Timing (30% faster than original):
    const DISPLAY_TIME = 2380;  // Display time (3400ms × 0.7)
    const FADE_DURATION = 630;  // Fade duration (900ms × 0.7)

    // Function to update text (called when opacity = 0)
    const updateText = () => {
      currentIndex.value = (currentIndex.value + 1) % languagePattern.length;
      setDisplayText(languagePattern[currentIndex.value].text);
    };

    // Function to continue animation loop (called after fade-in completes)
    const continueLoop = () => {
      animateNext();
    };

    // Animation loop function
    const animateNext = () => {
      opacity.value = withSequence(
        withDelay(DISPLAY_TIME, withTiming(1, { duration: 0 })), // Display
        withTiming(0, { 
          duration: FADE_DURATION, 
          easing: Easing.ease 
        }, (finished) => {
          // When fade-out completes (opacity = 0), update text
          if (finished) {
            runOnJS(updateText)();
          }
        }),
        withTiming(1, { 
          duration: FADE_DURATION, 
          easing: Easing.ease 
        }, (finished) => {
          // When fade-in completes, continue the loop
          if (finished) {
            runOnJS(continueLoop)();
          }
        })
      );
    };

    // Start the animation loop
    animateNext();

    return () => {
      // Cleanup: reset animation
      opacity.value = 1;
    };
  }, [isVisible, hasMessages]);

  if (!isVisible) {
    return null;
  }

  return (
    <Animated.Text style={[styles.placeholder, animatedStyle]} numberOfLines={1}>
      {displayText}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    position: 'absolute',
    left: 20, // Account for padding (12) + text input padding (8) - plus button now hidden
    right: 60, // Account for right actions (send button only - mic hidden)
    color: '#E0CBB9',
    fontFamily: 'Satoshi',
    fontSize: 16,
    lineHeight: 20,
    pointerEvents: 'none', // Allow touches to pass through to TextInput
  },
});


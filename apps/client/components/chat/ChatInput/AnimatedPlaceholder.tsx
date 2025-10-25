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
}

// Translations for "Ask anything about your money" in 20 languages
const translations = [
  { lang: 'English', text: 'Ask anything about your money' },
  { lang: 'Turkish', text: 'Paranız hakkında her şeyi sorun' },
  { lang: 'Chinese', text: '询问关于您的资金的任何问题' },
  { lang: 'Spanish', text: 'Pregunta cualquier cosa sobre tu dinero' },
  { lang: 'French', text: 'Posez toute question sur votre argent' },
  { lang: 'German', text: 'Fragen Sie alles über Ihr Geld' },
  { lang: 'Japanese', text: 'お金について何でも聞いてください' },
  { lang: 'Korean', text: '돈에 대해 무엇이든 물어보세요' },
  { lang: 'Arabic', text: 'اسأل أي شيء عن أموالك' },
  { lang: 'Portuguese', text: 'Pergunte qualquer coisa sobre seu dinheiro' },
  { lang: 'Russian', text: 'Спросите что угодно о ваших деньгах' },
  { lang: 'Italian', text: 'Chiedi qualsiasi cosa sui tuoi soldi' },
  { lang: 'Dutch', text: 'Vraag alles over je geld' },
  { lang: 'Hindi', text: 'अपने पैसे के बारे में कुछ भी पूछें' },
  { lang: 'Indonesian', text: 'Tanyakan apa saja tentang uang Anda' },
  { lang: 'Thai', text: 'ถามอะไรก็ได้เกี่ยวกับเงินของคุณ' },
  { lang: 'Vietnamese', text: 'Hỏi bất cứ điều gì về tiền của bạn' },
  { lang: 'Polish', text: 'Zapytaj o cokolwiek dotyczącego twoich pieniędzy' },
  { lang: 'Swedish', text: 'Fråga vad som helst om dina pengar' },
  { lang: 'Greek', text: 'Ρωτήστε οτιδήποτε για τα χρήματά σας' },
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

export function AnimatedPlaceholder({ isVisible }: AnimatedPlaceholderProps) {
  const opacity = useSharedValue(1);
  const currentIndex = useSharedValue(0);
  const [displayText, setDisplayText] = React.useState(languagePattern[0].text);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  useEffect(() => {
    if (!isVisible) {
      // Reset to first item when hidden
      currentIndex.value = 0;
      setDisplayText(languagePattern[0].text);
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
  }, [isVisible]);

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
    left: 52, // Account for plus button (32) + padding (12) + text input padding (8)
    right: 100, // Account for right actions (mic + send buttons)
    color: 'rgba(167, 190, 230, 0.8)',
    fontFamily: 'Satoshi',
    fontSize: 16,
    lineHeight: 20,
    pointerEvents: 'none', // Allow touches to pass through to TextInput
  },
});


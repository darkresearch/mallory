import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as RNLocalize from 'react-native-localize';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FALLBACK_LANG = 'en';
const LANGUAGE_STORAGE_KEY = '@scout_language';

// Supported languages
const SUPPORTED_LANGUAGES = ['en', 'es', 'tr', 'zh', 'fr'];

/**
 * Normalize device language tag to our supported locale
 * e.g., "es-MX" -> "es", "zh-Hans-CN" -> "zh"
 */
function normalizeLanguageTag(tag: string): string {
  const [lang] = tag.toLowerCase().split('-');
  return SUPPORTED_LANGUAGES.includes(lang) ? lang : FALLBACK_LANG;
}

/**
 * Detect user's preferred language
 * Priority: Dev override > Saved preference > Device language > Fallback
 */
async function detectLanguage(): Promise<string> {
  // Check if we have a saved language preference (for dev picker)
  try {
    const savedLang = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLang && SUPPORTED_LANGUAGES.includes(savedLang)) {
      console.log('📱 Using saved language:', savedLang);
      return savedLang;
    }
  } catch (error) {
    console.warn('Failed to read saved language:', error);
  }

  // Detect from device settings
  const locales = RNLocalize.getLocales();
  if (locales && locales.length > 0) {
    const deviceLang = normalizeLanguageTag(locales[0].languageTag);
    console.log('📱 Detected device language:', deviceLang, 'from', locales[0].languageTag);
    return deviceLang;
  }

  // Fallback to English
  console.log('📱 Using fallback language:', FALLBACK_LANG);
  return FALLBACK_LANG;
}

/**
 * Dynamically import locale file
 */
async function loadLocale(lang: string): Promise<any> {
  try {
    switch (lang) {
      case 'en':
        return await import('../locales/en/login.json');
      case 'es':
        return await import('../locales/es/login.json');
      case 'tr':
        return await import('../locales/tr/login.json');
      case 'zh':
        return await import('../locales/zh/login.json');
      case 'fr':
        return await import('../locales/fr/login.json');
      default:
        return await import('../locales/en/login.json');
    }
  } catch (error) {
    console.error(`Failed to load locale ${lang}, falling back to English:`, error);
    return await import('../locales/en/login.json');
  }
}

/**
 * Initialize i18n
 * Call this once at app startup
 */
export async function initI18n() {
  const detectedLang = await detectLanguage();
  
  // Load the initial locale
  const loginLocale = await loadLocale(detectedLang);

  await i18n
    .use(initReactI18next)
    .init({
      lng: detectedLang,
      fallbackLng: FALLBACK_LANG,
      defaultNS: 'login',
      resources: {
        [detectedLang]: {
          login: loginLocale.default || loginLocale,
        },
      },
      interpolation: {
        escapeValue: false, // React already escapes
      },
      compatibilityJSON: 'v3',
      react: {
        useSuspense: false, // Important for React Native
      },
    });

  // Handle language changes at runtime (for dev picker)
  i18n.on('languageChanged', async (lng: string) => {
    if (!SUPPORTED_LANGUAGES.includes(lng)) return;
    
    console.log('🌍 Language changed to:', lng);
    
    // Load the new locale if not already loaded
    if (!i18n.hasResourceBundle(lng, 'login')) {
      const loginLocale = await loadLocale(lng);
      i18n.addResourceBundle(lng, 'login', loginLocale.default || loginLocale, true, true);
    }
  });

  console.log('✅ i18n initialized with language:', detectedLang);
  return i18n;
}

/**
 * Change language at runtime (for dev picker)
 */
export async function changeLanguage(lang: string) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    console.warn('Unsupported language:', lang);
    return;
  }

  // Save to AsyncStorage for persistence
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch (error) {
    console.warn('Failed to save language preference:', error);
  }

  // Change language
  await i18n.changeLanguage(lang);
}

/**
 * Get current language
 */
export function getCurrentLanguage(): string {
  return i18n.language || FALLBACK_LANG;
}

/**
 * Get list of supported languages
 */
export function getSupportedLanguages() {
  return SUPPORTED_LANGUAGES;
}

export default i18n;


import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Target languages
const TARGET_LANGUAGES = {
  es: 'Spanish (neutral for Spain and Latin America)',
  tr: 'Turkish',
  zh: 'Chinese Simplified',
  fr: 'French (neutral for France)',
};

// Source locale
const SOURCE_LOCALE = 'en';
const SOURCE_FILE = 'login.json';

async function translateToLanguage(
  sourceText: Record<string, string>,
  targetLang: string,
  languageDescription: string
): Promise<Record<string, string>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const anthropic = new Anthropic({ apiKey });

  const prompt = `Translate these login page hero texts to ${languageDescription}.

Context: These appear on the login screen of Scout, an AI-powered neobank app that helps users understand and manage their finances with AI.

Tone: Professional, aspirational, slightly playful. This is the user's first impression of the app.

Guidelines:
- Keep proper nouns unchanged (e.g., "Scout") unless they have natural translations
- Adapt culturally where appropriate (not literal word-for-word translation)
- Preserve the emotional impact and aspirational tone
- Keep similar length to avoid UI layout issues
- Maintain punctuation style appropriate for the target language

Source (English):
${JSON.stringify(sourceText, null, 2)}

Return ONLY valid JSON with the same keys and translated values. No explanation, no markdown, just the JSON object.`;

  console.log(`🌍 Translating to ${languageDescription}...`);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  
  // Extract JSON from response (in case Claude adds any explanation)
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Failed to extract JSON from response for ${targetLang}`);
  }

  const translated = JSON.parse(jsonMatch[0]);

  // Validate that all keys from source are present
  const sourceKeys = Object.keys(sourceText);
  const translatedKeys = Object.keys(translated);
  
  const missingKeys = sourceKeys.filter(key => !translatedKeys.includes(key));
  if (missingKeys.length > 0) {
    throw new Error(`Missing keys in ${targetLang} translation: ${missingKeys.join(', ')}`);
  }

  console.log(`✅ Translated to ${languageDescription}`);
  return translated;
}

async function main() {
  const localesDir = path.join(__dirname, '..', 'locales');
  const sourceFilePath = path.join(localesDir, SOURCE_LOCALE, SOURCE_FILE);

  // Read source file
  if (!fs.existsSync(sourceFilePath)) {
    throw new Error(`Source file not found: ${sourceFilePath}`);
  }

  const sourceText = JSON.parse(fs.readFileSync(sourceFilePath, 'utf-8'));
  console.log('📖 Source text loaded:', sourceText);
  console.log('');

  // Translate to each target language
  for (const [langCode, langDescription] of Object.entries(TARGET_LANGUAGES)) {
    try {
      const translated = await translateToLanguage(sourceText, langCode, langDescription);
      
      // Write to target file
      const targetDir = path.join(localesDir, langCode);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      const targetFilePath = path.join(targetDir, SOURCE_FILE);
      fs.writeFileSync(targetFilePath, JSON.stringify(translated, null, 2) + '\n', 'utf-8');
      
      console.log(`💾 Saved: ${targetFilePath}`);
      console.log('');
    } catch (error) {
      console.error(`❌ Failed to translate to ${langCode}:`, error);
      process.exit(1);
    }
  }

  console.log('🎉 All translations completed successfully!');
}

main().catch(error => {
  console.error('❌ Translation script failed:', error);
  process.exit(1);
});


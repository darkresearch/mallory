import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage, getSupportedLanguages } from '@/lib/i18n';

// Language display names and flags
const LANGUAGE_INFO: Record<string, { name: string; flag: string }> = {
  en: { name: 'English', flag: '🇺🇸' },
  es: { name: 'Español', flag: '🇪🇸' },
  tr: { name: 'Türkçe', flag: '🇹🇷' },
  zh: { name: '中文', flag: '🇨🇳' },
  fr: { name: 'Français', flag: '🇫🇷' },
};

export function LanguagePicker() {
  const { i18n } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const currentLang = getCurrentLanguage();

  const handleLanguageSelect = async (lang: string) => {
    await changeLanguage(lang);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      {/* Trigger button */}
      <TouchableOpacity
        style={styles.triggerButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.triggerText}>{LANGUAGE_INFO[currentLang]?.flag || '🌐'}</Text>
        <Ionicons name="chevron-down" size={12} color="#8E8E93" />
      </TouchableOpacity>

      {/* Language selection modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Language</Text>
              <Text style={styles.modalSubtitle}>(Dev Mode)</Text>
            </View>

            {getSupportedLanguages().map((lang) => {
              const info = LANGUAGE_INFO[lang];
              const isSelected = lang === currentLang;

              return (
                <TouchableOpacity
                  key={lang}
                  style={[styles.languageOption, isSelected && styles.languageOptionSelected]}
                  onPress={() => handleLanguageSelect(lang)}
                >
                  <Text style={styles.languageFlag}>{info.flag}</Text>
                  <Text style={[styles.languageName, isSelected && styles.languageNameSelected]}>
                    {info.name}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color="#4E81D9" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1000,
  },
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  triggerText: {
    fontSize: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    width: 280,
    maxWidth: '90%',
  },
  modalHeader: {
    marginBottom: 16,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Satoshi',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    fontFamily: 'Satoshi',
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  languageOptionSelected: {
    backgroundColor: 'rgba(78, 129, 217, 0.15)',
  },
  languageFlag: {
    fontSize: 24,
  },
  languageName: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Satoshi',
  },
  languageNameSelected: {
    color: '#4E81D9',
    fontWeight: '600',
  },
});


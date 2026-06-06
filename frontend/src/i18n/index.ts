import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import SecureStore from '../utils/secureStore';

import en from './locales/en';
import hi from './locales/hi';
import mr from './locales/mr';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिंदी' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const LANG_STORE_KEY = 'appLanguage';

function detectInitialLanguage(): LanguageCode {
  try {
    const locales = Localization.getLocales();
    const code = locales?.[0]?.languageCode;
    if (code === 'hi' || code === 'mr') return code;
  } catch {
    // ignore
  }
  return 'en';
}

export async function initI18n(): Promise<void> {
  let lang: LanguageCode = detectInitialLanguage();
  try {
    const stored = await SecureStore.getItemAsync(LANG_STORE_KEY);
    if (stored === 'en' || stored === 'hi' || stored === 'mr') {
      lang = stored;
    }
  } catch {
    // ignore
  }

  if (!i18n.isInitialized) {
    await i18n
      .use(initReactI18next)
      .init({
        resources: {
          en: { translation: en },
          hi: { translation: hi },
          mr: { translation: mr },
        },
        lng: lang,
        fallbackLng: 'en',
        interpolation: { escapeValue: false },
        returnNull: false,
        compatibilityJSON: 'v4',
      });
  } else {
    await i18n.changeLanguage(lang);
  }
}

export async function setAppLanguage(lang: LanguageCode): Promise<void> {
  await i18n.changeLanguage(lang);
  try {
    await SecureStore.setItemAsync(LANG_STORE_KEY, lang);
  } catch {
    // ignore
  }
}

export function getCurrentLanguage(): LanguageCode {
  return (i18n.language as LanguageCode) || 'en';
}

export default i18n;

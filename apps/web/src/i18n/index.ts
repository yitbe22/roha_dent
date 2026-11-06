import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import am from './am.json';

// English is complete. Amharic falls back to English key-by-key until translated.
// Page copy lives in src/content/* (add locale variants there when Amharic is added).
export const SUPPORTED_LOCALES = ['en', 'am'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function createI18n(lng: Locale = 'en') {
  const instance = i18next.createInstance();
  void instance.use(initReactI18next).init({
    lng,
    fallbackLng: 'en',
    resources: { en: { translation: en }, am: { translation: am } },
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  return instance;
}

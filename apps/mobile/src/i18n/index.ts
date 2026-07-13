/**
 * i18n — app UI localisation (navigation/chrome only).
 *
 * Scope: the app's navigation and UI chrome. The EHCP/SEND report CONTENT
 * (src/lib/*-report.ts) intentionally stays English — parents translate those
 * documents themselves if they wish (statutory/medical copy is unsafe to
 * machine-translate).
 *
 * Language resolution order: saved preference (language.store) → device
 * language (expo-localization) → English. RTL (Urdu/Arabic) is applied via
 * I18nManager; a full RTL flip needs an app reload, so the switcher prompts
 * for it.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { I18nManager } from 'react-native';

import en from './locales/en.json';

/** Supported UI languages → their endonym (name in that language). */
export const SUPPORTED_LANGUAGES: Record<string, string> = {
  en: 'English',
  so: 'Soomaali',
  pl: 'Polski',
  ur: 'اردو',
  cy: 'Cymraeg',
  ar: 'العربية',
  pa: 'ਪੰਜਾਬੀ',
  bn: 'বাংলা',
};

/** Right-to-left languages. */
export const RTL_LANGUAGES = new Set(['ur', 'ar']);

// Locale resources. Non-English files are added by the translation pipeline
// (I18N-4); until a language ships, i18next falls back to English per-key, so
// a partially-translated locale never shows blank strings.
const resources: Record<string, { translation: Record<string, unknown> }> = {
  en: { translation: en },
};

function resolveLanguage(preferred: string | null): string {
  if (preferred && SUPPORTED_LANGUAGES[preferred]) return preferred;
  const device = Localization.getLocales()[0]?.languageCode ?? 'en';
  return SUPPORTED_LANGUAGES[device] ? device : 'en';
}

/** True if the app's RTL direction had to change (caller should reload). */
export function applyDirection(lang: string): boolean {
  const shouldRTL = RTL_LANGUAGES.has(lang);
  if (I18nManager.isRTL !== shouldRTL) {
    I18nManager.allowRTL(shouldRTL);
    I18nManager.forceRTL(shouldRTL);
    return true; // direction changed — a reload is needed to fully apply
  }
  return false;
}

let initialised = false;

export function initI18n(preferred: string | null): typeof i18n {
  const lng = resolveLanguage(preferred);
  if (!initialised) {
    void i18n.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      returnNull: false,
    });
    initialised = true;
  } else {
    void i18n.changeLanguage(lng);
  }
  applyDirection(lng);
  return i18n;
}

/** Switch language at runtime. Returns true if an app reload is needed (RTL flip). */
export async function changeLanguage(lang: string): Promise<boolean> {
  await i18n.changeLanguage(lang);
  return applyDirection(lang);
}

export default i18n;

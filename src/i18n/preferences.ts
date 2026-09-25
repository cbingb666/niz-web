import { defaultLocale, isLocale, translate, type Locale } from './core';

export const localeStorageKey = 'atom66.locale';
interface LocaleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().replaceAll('_', '-').split('-')[0];
    if (base === 'zh') return 'zh-CN';
    if (base === 'en') return 'en';
  }
  return defaultLocale;
}
export function preferredLocale(
  languages: readonly string[],
  storage?: Pick<LocaleStorage, 'getItem'>,
): Locale {
  try {
    const saved = storage?.getItem(localeStorageKey);
    if (isLocale(saved)) return saved;
  } catch {
    /* Private/file contexts may block storage. */
  }
  return detectLocale(languages);
}
export function persistLocale(locale: Locale, storage?: Pick<LocaleStorage, 'setItem'>): void {
  try {
    storage?.setItem(localeStorageKey, locale);
  } catch {
    /* Language changes still work in memory. */
  }
}
export function browserLocale(): Locale {
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  try {
    return preferredLocale(languages, window.localStorage);
  } catch {
    return detectLocale(languages);
  }
}
export function applyDocumentLocale(locale: Locale, document: Document): void {
  document.documentElement.lang = locale;
  document.title = translate(locale, 'app.title');
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', translate(locale, 'app.description'));
}
export function saveBrowserLocale(locale: Locale): void {
  try {
    persistLocale(locale, window.localStorage);
  } catch {
    /* Accessing localStorage itself can fail. */
  }
}

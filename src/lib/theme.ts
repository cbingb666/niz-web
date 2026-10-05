export const themes = ['system', 'light', 'dark'] as const;
export type Theme = typeof themes[number];
export const themeStorageKey = 'niz.theme';

export function isTheme(value: unknown): value is Theme {
  return themes.some(theme => theme === value);
}

export function browserTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(themeStorageKey);
    if (isTheme(saved)) return saved;
  } catch {
    // Storage may be unavailable for private browsing or standalone files.
  }
  return 'system';
}

export function saveTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {
    // Switching still works for the current page.
  }
}

export function applyTheme(theme: Theme): void {
  const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  document.documentElement.dataset.theme = theme === 'system' ? (dark ? 'dark' : 'light') : theme;
}

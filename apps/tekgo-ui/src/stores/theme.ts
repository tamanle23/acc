import { atom } from 'nanostores';

export type Theme = 'light' | 'dark' | 'system';

export const themeStore = atom<Theme>('system');

export function initTheme() {
  if (typeof window === 'undefined') return;
  const stored = localStorage.getItem('theme') as Theme | null;
  const initialTheme: Theme = stored || 'system';
  themeStore.set(initialTheme);
  applyTheme(initialTheme);
}

export function setTheme(theme: Theme) {
  themeStore.set(theme);
  if (typeof window !== 'undefined') {
    localStorage.setItem('theme', theme);
    applyTheme(theme);
  }
}

function applyTheme(theme: Theme) {
  if (typeof window === 'undefined') return;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}


import type { StudioThemeTokens, StudioThemePreset, ThemeMode } from '@/types/theme';
import { STUDIO_THEME_PRESETS } from '@/constants/theme-presets';

export const THEME_STORAGE_KEY = 'kinetix_studio_ui_theme';
export const THEME_MODE_KEY = 'kinetix_studio_ui_mode';
export const THEME_MODE_STORAGE_KEY = 'kinetix_studio_ui_mode';
export const CUSTOM_THEMES_STORAGE_KEY = 'kinetix_studio_custom_themes';
export const DEFAULT_THEME_ID = 'carbon-noir';

/**
 * Converts a hex color (#ffffff, #fff, or without #) to space-separated RGB channel string: "255 255 255"
 */
export function hexToRgbChannels(hex?: string): string {
  if (!hex || typeof hex !== 'string') return '0 0 0';
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{3,6}$/.test(clean)) {
    return '0 0 0';
  }
  let r = 0;
  let g = 0;
  let b = 0;

  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16) || 0;
    g = parseInt(clean[1] + clean[1], 16) || 0;
    b = parseInt(clean[2] + clean[2], 16) || 0;
  } else if (clean.length >= 6) {
    r = parseInt(clean.slice(0, 2), 16) || 0;
    g = parseInt(clean.slice(2, 4), 16) || 0;
    b = parseInt(clean.slice(4, 6), 16) || 0;
  }

  return `${r} ${g} ${b}`;
}

/**
 * Converts space-separated RGB channels ("255 255 255") back to 6-digit hex string ("#ffffff")
 */
export function rgbChannelsToHex(channels: string): string {
  const parts = channels.trim().split(/\s+/).map((n) => parseInt(n, 10));
  if (parts.length < 3 || parts.some((p) => isNaN(p))) return '#000000';
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(parts[0])}${toHex(parts[1])}${toHex(parts[2])}`;
}

/**
 * Injects the studio theme tokens as CSS variables onto document.documentElement
 */
export function applyThemeToDom(
  themeOrTokens: StudioThemeTokens | StudioThemePreset,
  resolvedMode: 'dark' | 'light'
): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const tokens = (themeOrTokens as StudioThemePreset).tokens || (themeOrTokens as StudioThemeTokens);

  // 1. Toggle Tailwind dark mode class
  if (resolvedMode === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
  }

  // 2. Enable transition class on root
  if (!root.classList.contains('studio-theme-transition')) {
    root.classList.add('studio-theme-transition');
  }

  // 3. Inject CSS custom properties as space-separated RGB channels
  root.style.setProperty('--background', hexToRgbChannels(tokens.background));
  root.style.setProperty('--foreground', hexToRgbChannels(tokens.foreground));
  root.style.setProperty('--card', hexToRgbChannels(tokens.card));
  root.style.setProperty('--card-foreground', hexToRgbChannels(tokens.cardForeground));
  root.style.setProperty('--popover', hexToRgbChannels(tokens.popover));
  root.style.setProperty('--popover-foreground', hexToRgbChannels(tokens.popoverForeground));
  root.style.setProperty('--primary', hexToRgbChannels(tokens.primary));
  root.style.setProperty('--primary-foreground', hexToRgbChannels(tokens.primaryForeground));
  root.style.setProperty('--secondary', hexToRgbChannels(tokens.secondary));
  root.style.setProperty('--secondary-foreground', hexToRgbChannels(tokens.secondaryForeground));
  root.style.setProperty('--muted', hexToRgbChannels(tokens.muted));
  root.style.setProperty('--muted-foreground', hexToRgbChannels(tokens.mutedForeground));
  root.style.setProperty('--accent', hexToRgbChannels(tokens.accent));
  root.style.setProperty('--accent-foreground', hexToRgbChannels(tokens.accentForeground));
  root.style.setProperty('--destructive', hexToRgbChannels(tokens.destructive));
  root.style.setProperty('--destructive-foreground', hexToRgbChannels(tokens.destructiveForeground));
  root.style.setProperty('--border', hexToRgbChannels(tokens.border));
  root.style.setProperty('--input', hexToRgbChannels(tokens.input));
  root.style.setProperty('--ring', hexToRgbChannels(tokens.ring));
}

/**
 * Detects current system dark mode preference
 */
export function getSystemModePreference(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * Load saved custom themes from localStorage
 */
export function loadCustomThemesFromStorage(): StudioThemePreset[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save custom themes array to localStorage
 */
export function saveCustomThemesToStorage(themes: StudioThemePreset[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(themes));
  } catch (err) {
    console.error('Failed to save custom themes to localStorage:', err);
  }
}

/**
 * Finds a theme preset by ID from both curated and custom themes
 */
export function findThemePresetById(
  id: string,
  customThemes: StudioThemePreset[] = []
): StudioThemePreset | undefined {
  return (
    STUDIO_THEME_PRESETS.find((p) => p.id === id) ||
    customThemes.find((p) => p.id === id)
  );
}

/**
 * Resolves initial theme and mode from localStorage or system
 */
export function getInitialThemeState(): {
  themeId: string;
  currentThemeId: string;
  mode: ThemeMode;
  themeMode: string;
  activeTheme: StudioThemePreset;
} {
  const getStorage = () => {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    } catch {}
    return null;
  };

  const storage = getStorage();
  const rawMode = storage?.getItem(THEME_MODE_KEY) || storage?.getItem(THEME_MODE_STORAGE_KEY);
  const savedMode = (rawMode as ThemeMode) || 'auto';
  const savedThemeId = storage?.getItem(THEME_STORAGE_KEY);

  if (savedThemeId) {
    const active = findThemePresetById(savedThemeId) || STUDIO_THEME_PRESETS[0]!;
    return {
      themeId: savedThemeId,
      currentThemeId: savedThemeId,
      mode: savedMode,
      themeMode: savedMode,
      activeTheme: active,
    };
  }

  // Fallback to default by mode
  const resolvedMode = savedMode === 'system' || savedMode === 'auto' ? getSystemModePreference() : savedMode;
  const fallbackId = resolvedMode === 'dark' ? DEFAULT_THEME_ID : 'zinc-clean';
  const active = findThemePresetById(fallbackId) || STUDIO_THEME_PRESETS[0]!;
  return {
    themeId: fallbackId,
    currentThemeId: fallbackId,
    mode: savedMode,
    themeMode: rawMode ? savedMode : 'auto',
    activeTheme: active,
  };
}

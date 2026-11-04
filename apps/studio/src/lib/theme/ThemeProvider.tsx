import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  STUDIO_THEME_PRESETS,
  getThemePreset,
  type StudioThemePreset,
} from './themePresets';

export type ThemeMode = 'dark' | 'light';
export type GlassStyle = 'specular' | 'frosted' | 'cyber';
export type BlurIntensity = 'low' | 'medium' | 'high';
/** @deprecated Dynamic accent override removed in favor of pure theme palette control */
export type AccentColor = 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose';

export interface ThemePreferences {
  presetId?: string;
  mode: ThemeMode;
  glassStyle: GlassStyle;
  blurIntensity: BlurIntensity;
  /** @deprecated Dynamic accent override removed in favor of pure theme palette control */
  accentColor?: string;
}

export interface ThemeContextValue {
  preferences: ThemePreferences;
  activePreset: StudioThemePreset;
  setTheme: (updates: Partial<ThemePreferences>) => void;
  selectPreset: (presetId: string) => void;
  toggleMode: () => void;
  resetTheme: () => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
}

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  mode: 'dark',
  glassStyle: 'specular',
  blurIntensity: 'medium',
};

// Alias for test compatibility
export const DEFAULT_PREFERENCES = DEFAULT_THEME_PREFERENCES;

export const THEME_STORAGE_KEY = 'acc_studio_theme_prefs';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    return null;
  }
  return null;
}

function loadSavedPreferences(): ThemePreferences {
  const storage = getStorage();
  if (!storage) {
    return { ...DEFAULT_THEME_PREFERENCES, presetId: 'obsidian' };
  }
  try {
    const raw = storage.getItem(THEME_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THEME_PREFERENCES, presetId: 'obsidian' };
    const parsed = JSON.parse(raw);
    const validPreset = STUDIO_THEME_PRESETS.some((p) => p.id === parsed.presetId)
      ? parsed.presetId
      : 'obsidian';

    return {
      presetId: validPreset,
      mode: parsed.mode === 'light' ? 'light' : 'dark',
      glassStyle: ['specular', 'frosted', 'cyber'].includes(parsed.glassStyle)
        ? parsed.glassStyle
        : DEFAULT_THEME_PREFERENCES.glassStyle,
      blurIntensity: ['low', 'medium', 'high'].includes(parsed.blurIntensity)
        ? parsed.blurIntensity
        : DEFAULT_THEME_PREFERENCES.blurIntensity,
    };
  } catch {
    return { ...DEFAULT_THEME_PREFERENCES, presetId: 'obsidian' };
  }
}

export function applyThemeToDocument(preferences: ThemePreferences): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const isDark = preferences.mode === 'dark';

  root.classList.toggle('dark', isDark);
  root.classList.toggle('light', !isDark);
  root.style.colorScheme = preferences.mode;

  const presetId = preferences.presetId || 'obsidian';
  const preset = getThemePreset(presetId);

  root.setAttribute('data-theme-mode', preferences.mode);
  root.setAttribute('data-theme-preset', preset.id);
  root.setAttribute('data-glass-style', preferences.glassStyle);
  root.setAttribute('data-blur-intensity', preferences.blurIntensity);

  // 1. Theme Palette Exclusively Controls Color Theme
  const t = preset.tokens;
  root.style.setProperty('--background', t.background);
  root.style.setProperty('--foreground', t.foreground);
  root.style.setProperty('--card', t.card);
  root.style.setProperty('--card-foreground', t.cardForeground);
  root.style.setProperty('--popover', t.popover);
  root.style.setProperty('--popover-foreground', t.popoverForeground);
  root.style.setProperty('--secondary', t.secondary);
  root.style.setProperty('--secondary-foreground', t.secondaryForeground);
  root.style.setProperty('--muted', t.muted);
  root.style.setProperty('--muted-foreground', t.mutedForeground);
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--accent-foreground', t.accentForeground);
  root.style.setProperty('--destructive', t.destructive);
  root.style.setProperty('--destructive-foreground', t.destructiveForeground);
  root.style.setProperty('--border', t.border);
  root.style.setProperty('--input', t.input);
  root.style.setProperty('--primary', t.primary);
  root.style.setProperty('--ring', t.ring);
  root.style.setProperty('--accent-primary', t.accentPrimary);
  root.style.setProperty('--color-brand-accent', t.colorBrandAccent);
  root.style.setProperty('--accent-glow', t.accentGlow);

  // 2. Glass Refraction Profiles ONLY Dictate Liquid Glass Effect
  root.style.setProperty('--glass-bg', t.glassBg);

  if (preferences.glassStyle === 'frosted') {
    root.style.setProperty('--glass-specular', 'none');
    root.style.setProperty('--glass-border', t.glassBorder);
    root.style.setProperty('--glass-border-highlight', t.glassBorder);
    root.style.setProperty(
      '--glass-shadow',
      isDark ? '0 6px 20px 0 rgba(0, 0, 0, 0.4)' : '0 4px 16px 0 rgba(0, 0, 0, 0.05)'
    );
  } else if (preferences.glassStyle === 'cyber') {
    root.style.setProperty(
      '--glass-specular',
      `inset 0 1px 0 0 color-mix(in srgb, ${t.accentPrimary} 30%, transparent)`
    );
    root.style.setProperty('--glass-border-highlight', t.accentPrimary);
    root.style.setProperty(
      '--glass-border',
      `color-mix(in srgb, ${t.accentPrimary} 45%, transparent)`
    );
    root.style.setProperty(
      '--glass-shadow',
      `0 0 24px -4px color-mix(in srgb, ${t.accentPrimary} 30%, transparent)`
    );
  } else {
    // 'specular' (Default native specular sheen with sharpened rim)
    root.style.setProperty('--glass-specular', t.glassSpecular);
    root.style.setProperty('--glass-border', t.glassBorder);
    root.style.setProperty('--glass-border-highlight', t.glassBorderHighlight);
    root.style.setProperty('--glass-shadow', t.glassShadow);
  }

  // Decoupled Acrylic Blur Intensity
  if (preferences.blurIntensity === 'low') {
    root.style.setProperty('--glass-blur', 'blur(6px)');
  } else if (preferences.blurIntensity === 'high') {
    root.style.setProperty('--glass-blur', 'blur(40px)');
  } else {
    root.style.setProperty('--glass-blur', 'blur(18px)');
  }

  if (t.ambientMesh) {
    root.style.setProperty('--ambient-mesh', t.ambientMesh);
  }

  // 3. Studio Splash Modal System Theme Synchronization
  root.style.setProperty(
    '--splash-backdrop-bg',
    isDark ? '#020617cc' : 'rgba(241, 245, 249, 0.88)'
  );
  root.style.setProperty(
    '--splash-ambient-mesh',
    t.ambientMesh ||
      `radial-gradient(circle at 50% 42%, color-mix(in srgb, ${t.accentPrimary} 14%, transparent) 0%, transparent 60%)`
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<ThemePreferences>(() => {
    const initial = loadSavedPreferences();
    applyThemeToDocument(initial);
    return initial;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Sync state to DOM, html attributes, colorScheme, CSS variables, and localStorage
  useEffect(() => {
    applyThemeToDocument(preferences);

    try {
      const storage = getStorage();
      if (storage) {
        storage.setItem(THEME_STORAGE_KEY, JSON.stringify(preferences));
      }
    } catch (e) {
      console.warn('Failed to save theme preferences to localStorage:', e);
    }
  }, [preferences]);

  const activePreset = useMemo(
    () => getThemePreset(preferences.presetId || 'obsidian'),
    [preferences.presetId]
  );

  const setTheme = useCallback((updates: Partial<ThemePreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...updates };
      applyThemeToDocument(next);
      return next;
    });
  }, []);

  // Preset-Governed Mode Selection
  const selectPreset = useCallback((presetId: string) => {
    const targetPreset = getThemePreset(presetId);
    setPreferences((prev) => {
      const next = {
        ...prev,
        presetId,
        // Preset-Governed Mode: automatically sync dark/light mode to preset's native mode
        mode: targetPreset.mode,
      };
      applyThemeToDocument(next);
      return next;
    });
  }, []);

  const toggleMode = useCallback(() => {
    setPreferences((prev) => {
      const nextMode: ThemeMode = prev.mode === 'dark' ? 'light' : 'dark';
      // If toggling to light mode and current preset is dark, switch to a friendly light preset (e.g. catppuccin-latte or github-light)
      let nextPresetId = prev.presetId;
      if (nextMode === 'light' && prev.mode === 'dark') {
        const curPreset = getThemePreset(prev.presetId || 'obsidian');
        if (curPreset.mode === 'dark') {
          nextPresetId = 'catppuccin-latte';
        }
      } else if (nextMode === 'dark' && prev.mode === 'light') {
        const curPreset = getThemePreset(prev.presetId || 'catppuccin-latte');
        if (curPreset.mode === 'light') {
          nextPresetId = 'obsidian';
        }
      }
      const next: ThemePreferences = {
        ...prev,
        mode: nextMode,
        presetId: nextPresetId,
      };
      applyThemeToDocument(next);
      return next;
    });
  }, []);

  const resetTheme = useCallback(() => {
    const next: ThemePreferences = { ...DEFAULT_THEME_PREFERENCES, presetId: 'obsidian' };
    applyThemeToDocument(next);
    setPreferences(next);
  }, []);

  const value = useMemo(
    () => ({
      preferences,
      activePreset,
      setTheme,
      selectPreset,
      toggleMode,
      resetTheme,
      isSettingsOpen,
      setIsSettingsOpen,
    }),
    [preferences, activePreset, setTheme, selectPreset, toggleMode, resetTheme, isSettingsOpen]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}

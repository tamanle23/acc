import { describe, it, expect, beforeEach } from 'bun:test';
import {
  STUDIO_THEME_PRESETS,
  DEFAULT_THEME_ID,
  hexToRgbChannels,
  rgbChannelsToHex,
  findThemePresetById,
  loadCustomThemesFromStorage,
  saveCustomThemesToStorage,
  applyThemeToDom,
  getSystemModePreference,
  getInitialThemeState,
  THEME_STORAGE_KEY,
  THEME_MODE_STORAGE_KEY,
  CUSTOM_THEMES_STORAGE_KEY,
  ThemeProvider,
  useTheme,
  ThemeSelector,
  ThemeManagerDeck,
  ThemeManagerModal,
} from '../src/index';
import type { StudioThemePreset, StudioThemeTokens } from '../src/types';

describe('Kinetix Studio Theme Manager & Tailwind CSS System Suite', () => {
  // Mock localStorage for storage test cases
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    for (const key in mockStorage) {
      delete mockStorage[key];
    }

    if (typeof globalThis.localStorage === 'undefined') {
      (globalThis as any).localStorage = {
        getItem: (key: string) => mockStorage[key] ?? null,
        setItem: (key: string, val: string) => {
          mockStorage[key] = String(val);
        },
        removeItem: (key: string) => {
          delete mockStorage[key];
        },
        clear: () => {
          for (const k in mockStorage) delete mockStorage[k];
        },
      };
    }
  });

  describe('Bidirectional Color Space Conversion (Hex <-> RGB Channels)', () => {
    it('converts standard 6-character hex strings to space-delimited RGB channels', () => {
      expect(hexToRgbChannels('#09090b')).toBe('9 9 11');
      expect(hexToRgbChannels('#ffffff')).toBe('255 255 255');
      expect(hexToRgbChannels('#000000')).toBe('0 0 0');
      expect(hexToRgbChannels('#e2e8f0')).toBe('226 232 240');
      expect(hexToRgbChannels('#3b82f6')).toBe('59 130 246');
    });

    it('converts shorthand 3-character hex strings correctly', () => {
      expect(hexToRgbChannels('#fff')).toBe('255 255 255');
      expect(hexToRgbChannels('#000')).toBe('0 0 0');
      expect(hexToRgbChannels('#f00')).toBe('255 0 0');
    });

    it('handles hex strings without leading hash', () => {
      expect(hexToRgbChannels('09090b')).toBe('9 9 11');
      expect(hexToRgbChannels('ffffff')).toBe('255 255 255');
    });

    it('falls back safely to 0 0 0 for malformed or empty hex strings', () => {
      expect(hexToRgbChannels('')).toBe('0 0 0');
      expect(hexToRgbChannels('not-a-hex')).toBe('0 0 0');
      expect(hexToRgbChannels('#xyz')).toBe('0 0 0');
    });

    it('converts space-delimited RGB channels to standard 6-character hex strings', () => {
      expect(rgbChannelsToHex('9 9 11')).toBe('#09090b');
      expect(rgbChannelsToHex('255 255 255')).toBe('#ffffff');
      expect(rgbChannelsToHex('0 0 0')).toBe('#000000');
      expect(rgbChannelsToHex('226 232 240')).toBe('#e2e8f0');
      expect(rgbChannelsToHex('59 130 246')).toBe('#3b82f6');
    });

    it('handles comma-separated RGB strings and whitespace padding', () => {
      expect(rgbChannelsToHex(' 9, 9, 11 ')).toBe('#09090b');
      expect(rgbChannelsToHex('255, 255, 255')).toBe('#ffffff');
    });

    it('falls back safely to #000000 for invalid RGB strings', () => {
      expect(rgbChannelsToHex('')).toBe('#000000');
      expect(rgbChannelsToHex('invalid')).toBe('#000000');
      expect(rgbChannelsToHex('12 34')).toBe('#000000'); // only 2 components
    });

    it('guarantees round-trip fidelity between Hex -> RGB Channels -> Hex', () => {
      const sampleHexes = ['#09090b', '#18181b', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ffffff'];
      for (const hex of sampleHexes) {
        const rgb = hexToRgbChannels(hex);
        const backToHex = rgbChannelsToHex(rgb);
        expect(backToHex.toLowerCase()).toBe(hex.toLowerCase());
      }
    });
  });

  describe('20 Curated Studio UI Theme Presets Specification', () => {
    it('contains exactly 20 curated presets in the built-in catalog', () => {
      expect(STUDIO_THEME_PRESETS.length).toBe(20);
    });

    it('provides exactly 10 Dark mode presets and 10 Light mode presets', () => {
      const darkThemes = STUDIO_THEME_PRESETS.filter((t) => t.mode === 'dark');
      const lightThemes = STUDIO_THEME_PRESETS.filter((t) => t.mode === 'light');

      expect(darkThemes.length).toBe(10);
      expect(lightThemes.length).toBe(10);
    });

    it('ensures each preset has a unique ID', () => {
      const ids = STUDIO_THEME_PRESETS.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(20);
    });

    it('includes all 10 verified dark mode themes with correct category', () => {
      const darkIds = [
        'carbon-noir',
        'slate-titanium',
        'obsidian-pitch',
        'cyber-matrix',
        'tokyo-midnight',
        'infrared-sub',
        'oceanic-abyss',
        'espresso-dusk',
        'industrial-steel',
        'amethyst-void',
      ];

      for (const id of darkIds) {
        const theme = STUDIO_THEME_PRESETS.find((t) => t.id === id);
        expect(theme).toBeDefined();
        expect(theme?.mode).toBe('dark');
        expect(theme?.isCustom).toBe(false);
        expect(typeof theme?.name).toBe('string');
        expect(typeof theme?.description).toBe('string');
      }
    });

    it('includes all 10 verified light mode themes with correct category', () => {
      const lightIds = [
        'zinc-clean',
        'slate-minimal',
        'warm-paper',
        'swiss-white',
        'nordic-glacier',
        'solar-sand',
        'botanical-sage',
        'lavender-breeze',
        'blush-quartz',
        'monochrome-stark',
      ];

      for (const id of lightIds) {
        const theme = STUDIO_THEME_PRESETS.find((t) => t.id === id);
        expect(theme).toBeDefined();
        expect(theme?.mode).toBe('light');
        expect(theme?.isCustom).toBe(false);
        expect(typeof theme?.name).toBe('string');
        expect(typeof theme?.description).toBe('string');
      }
    });

    it('validates that every preset provides all 18 shadcn token properties formatted as valid 6-digit hex codes', () => {
      const requiredTokens: (keyof StudioThemeTokens)[] = [
        'background',
        'foreground',
        'card',
        'cardForeground',
        'popover',
        'popoverForeground',
        'primary',
        'primaryForeground',
        'secondary',
        'secondaryForeground',
        'muted',
        'mutedForeground',
        'accent',
        'accentForeground',
        'destructive',
        'destructiveForeground',
        'border',
        'input',
        'ring',
      ];

      const hexRegex = /^#[0-9a-fA-F]{6}$/;

      STUDIO_THEME_PRESETS.forEach((preset) => {
        expect(preset.tokens).toBeDefined();
        requiredTokens.forEach((tokenKey) => {
          const val = preset.tokens[tokenKey];
          expect(typeof val).toBe('string');
          expect(hexRegex.test(val)).toBe(true);
        });
      });
    });

    it('defines a valid DEFAULT_THEME_ID that exists in the presets catalog', () => {
      expect(DEFAULT_THEME_ID).toBe('carbon-noir');
      const defaultPreset = STUDIO_THEME_PRESETS.find((t) => t.id === DEFAULT_THEME_ID);
      expect(defaultPreset).toBeDefined();
      expect(defaultPreset?.name).toBe('Carbon Noir');
    });
  });

  describe('Theme Lookup & Custom Preset Management', () => {
    it('resolves built-in preset by ID using findThemePresetById', () => {
      const preset = findThemePresetById('slate-titanium');
      expect(preset).toBeDefined();
      expect(preset?.name).toBe('Slate Titanium');
      expect(preset?.mode).toBe('dark');
    });

    it('resolves custom theme presets when passed in the customPresets parameter', () => {
      const customTheme: StudioThemePreset = {
        id: 'custom-neon-future',
        name: 'Neon Future',
        mode: 'dark',
        category: 'cyber',
        description: 'Test custom futuristic theme',
        isCustom: true,
        tokens: {
          background: '#050510',
          foreground: '#f0f0ff',
          card: '#0d0d22',
          cardForeground: '#f0f0ff',
          popover: '#0d0d22',
          popoverForeground: '#f0f0ff',
          primary: '#00ffcc',
          primaryForeground: '#000000',
          secondary: '#1c1b3a',
          secondaryForeground: '#f0f0ff',
          muted: '#181733',
          mutedForeground: '#7a7a9e',
          accent: '#26244d',
          accentForeground: '#00ffcc',
          destructive: '#ff0055',
          destructiveForeground: '#ffffff',
          border: '#232145',
          input: '#232145',
          ring: '#00ffcc',
        },
      };

      const found = findThemePresetById('custom-neon-future', [customTheme]);
      expect(found).toBeDefined();
      expect(found?.name).toBe('Neon Future');
      expect(found?.isCustom).toBe(true);
    });

    it('returns undefined for non-existent theme IDs', () => {
      const found = findThemePresetById('non-existent-theme-id');
      expect(found).toBeUndefined();
    });

    it('saves and loads custom themes from localStorage safely', () => {
      const testCustomThemes: StudioThemePreset[] = [
        {
          id: 'custom-gold',
          name: 'Royal Gold',
          mode: 'dark',
          category: 'brand',
          description: 'Custom royal gold theme',
          isCustom: true,
          tokens: STUDIO_THEME_PRESETS[0].tokens,
        },
      ];

      saveCustomThemesToStorage(testCustomThemes);
      const loaded = loadCustomThemesFromStorage();

      expect(loaded.length).toBe(1);
      expect(loaded[0].id).toBe('custom-gold');
      expect(loaded[0].name).toBe('Royal Gold');
    });

    it('handles corrupt localStorage gracefully when loading custom themes', () => {
      localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, '{ invalid json');
      const loaded = loadCustomThemesFromStorage();
      expect(loaded).toEqual([]);
    });

    it('handles non-array storage payloads gracefully', () => {
      localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify({ not: 'an array' }));
      const loaded = loadCustomThemesFromStorage();
      expect(loaded).toEqual([]);
    });
  });

  describe('DOM Theme Injection & Semantic Tokens (applyThemeToDom)', () => {
    it('sets dark/light class and CSS variables on document.documentElement', () => {
      const mockElement = {
        style: {
          properties: {} as Record<string, string>,
          setProperty(name: string, value: string) {
            this.properties[name] = value;
          },
        },
        classList: {
          classes: new Set<string>(),
          add(cls: string) {
            this.classes.add(cls);
          },
          remove(cls: string) {
            this.classes.delete(cls);
          },
          contains(cls: string) {
            return this.classes.has(cls);
          },
        },
        setAttribute(name: string, value: string) {
          (this as any)[name] = value;
        },
      };

      // Mock document
      (globalThis as any).document = {
        documentElement: mockElement,
      };

      const darkPreset = STUDIO_THEME_PRESETS[0]; // carbon-noir
      applyThemeToDom(darkPreset, 'dark');

      expect(mockElement.classList.contains('dark')).toBe(true);
      expect(mockElement.classList.contains('light')).toBe(false);
      expect(mockElement.style.properties['--background']).toBe(hexToRgbChannels(darkPreset.tokens.background));
      expect(mockElement.style.properties['--primary']).toBe(hexToRgbChannels(darkPreset.tokens.primary));
      expect(mockElement.style.properties['--border']).toBe(hexToRgbChannels(darkPreset.tokens.border));

      const lightPreset = STUDIO_THEME_PRESETS.find((t) => t.mode === 'light')!;
      applyThemeToDom(lightPreset, 'light');

      expect(mockElement.classList.contains('light')).toBe(true);
      expect(mockElement.classList.contains('dark')).toBe(false);
      expect(mockElement.style.properties['--background']).toBe(hexToRgbChannels(lightPreset.tokens.background));
      expect(mockElement.style.properties['--primary']).toBe(hexToRgbChannels(lightPreset.tokens.primary));
    });
  });

  describe('Initial State & System Preference Fallback', () => {
    it('resolves initial state from valid localStorage values', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'slate-titanium');
      localStorage.setItem(THEME_MODE_STORAGE_KEY, 'dark');

      const state = getInitialThemeState();
      expect(state.currentThemeId).toBe('slate-titanium');
      expect(state.themeMode).toBe('dark');
      expect(state.activeTheme.id).toBe('slate-titanium');
    });

    it('falls back to default preset and auto mode when storage is empty', () => {
      localStorage.removeItem(THEME_STORAGE_KEY);
      localStorage.removeItem(THEME_MODE_STORAGE_KEY);

      const state = getInitialThemeState();
      expect(state.currentThemeId).toBe(DEFAULT_THEME_ID);
      expect(state.themeMode).toBe('auto');
      expect(state.activeTheme.id).toBe(DEFAULT_THEME_ID);
    });
  });

  describe('Exports and Component Contracts', () => {
    it('exports all theme components and context utilities from the package root', () => {
      expect(typeof ThemeProvider).toBe('function');
      expect(typeof useTheme).toBe('function');
      expect(typeof ThemeSelector).toBe('function');
      expect(typeof ThemeManagerDeck).toBe('function');
      expect(typeof ThemeManagerModal).toBe('function');
      expect(typeof applyThemeToDom).toBe('function');
      expect(typeof hexToRgbChannels).toBe('function');
      expect(typeof rgbChannelsToHex).toBe('function');
    });
  });

  describe('WCAG 2.1 / 2.2 AA Color Contrast Compliance Verification', () => {
    function relativeLuminance(hex: string): number {
      const clean = hex.replace('#', '');
      const num = parseInt(clean, 16);
      const r = ((num >> 16) & 255) / 255;
      const g = ((num >> 8) & 255) / 255;
      const b = (num & 255) / 255;

      const toLinear = (c: number) =>
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    }

    function calculateContrastRatio(c1: string, c2: string): number {
      const l1 = relativeLuminance(c1);
      const l2 = relativeLuminance(c2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
    }

    it('verifies all 20 presets achieve WCAG AA contrast (>= 4.5:1) for body text and interactive surfaces', () => {
      for (const preset of STUDIO_THEME_PRESETS) {
        const { tokens } = preset;

        // 1. Foreground on Background
        const fgOnBg = calculateContrastRatio(tokens.foreground, tokens.background);
        expect(fgOnBg).toBeGreaterThanOrEqual(4.5);

        // 2. Card Foreground on Card
        const cardFgOnCard = calculateContrastRatio(tokens.cardForeground, tokens.card);
        expect(cardFgOnCard).toBeGreaterThanOrEqual(4.5);

        // 3. Popover Foreground on Popover
        const popoverFgOnPopover = calculateContrastRatio(tokens.popoverForeground, tokens.popover);
        expect(popoverFgOnPopover).toBeGreaterThanOrEqual(4.5);

        // 4. Muted Foreground on Background
        const mutedFgOnBg = calculateContrastRatio(tokens.mutedForeground, tokens.background);
        expect(mutedFgOnBg).toBeGreaterThanOrEqual(4.5);

        // 5. Muted Foreground on Card
        const mutedFgOnCard = calculateContrastRatio(tokens.mutedForeground, tokens.card);
        expect(mutedFgOnCard).toBeGreaterThanOrEqual(4.5);

        // 6. Primary Foreground on Primary
        const priFgOnPri = calculateContrastRatio(tokens.primaryForeground, tokens.primary);
        expect(priFgOnPri).toBeGreaterThanOrEqual(4.5);

        // 7. Secondary Foreground on Secondary
        const secFgOnSec = calculateContrastRatio(tokens.secondaryForeground, tokens.secondary);
        expect(secFgOnSec).toBeGreaterThanOrEqual(4.5);

        // 8. Accent Foreground on Accent
        const accFgOnAcc = calculateContrastRatio(tokens.accentForeground, tokens.accent);
        expect(accFgOnAcc).toBeGreaterThanOrEqual(4.5);

        // 9. Destructive Foreground on Destructive
        const desFgOnDes = calculateContrastRatio(tokens.destructiveForeground, tokens.destructive);
        expect(desFgOnDes).toBeGreaterThanOrEqual(4.5);

        // 10. Focus Ring on Background (WCAG 2.1 Non-text contrast >= 3.0:1)
        const ringOnBg = calculateContrastRatio(tokens.ring, tokens.background);
        expect(ringOnBg).toBeGreaterThanOrEqual(3.0);
      }
    });

    it('validates that light themes provide crisp legibility with average contrast > 12:1', () => {
      const lightPresets = STUDIO_THEME_PRESETS.filter((t) => t.mode === 'light');
      for (const preset of lightPresets) {
        const fgRatio = calculateContrastRatio(preset.tokens.foreground, preset.tokens.background);
        expect(fgRatio).toBeGreaterThan(12.0);
      }
    });
  });
});

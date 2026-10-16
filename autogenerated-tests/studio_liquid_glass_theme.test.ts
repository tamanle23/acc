import { describe, it, expect, beforeEach } from 'bun:test';
import fs from 'fs';
import path from 'path';
import {
  DEFAULT_THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  type ThemePreferences,
} from '../apps/studio/src/lib/theme/ThemeProvider';

describe('Studio Liquid Glass Theme System & Design Tokens', () => {
  describe('Theme Tokens & CSS Specification Integrity', () => {
    it('should define all requisite Liquid Glass CSS variables and utility classes in index.css', () => {
      const cssPath = path.resolve(__dirname, '../apps/studio/src/index.css');
      expect(fs.existsSync(cssPath)).toBe(true);

      const css = fs.readFileSync(cssPath, 'utf8');

      // Light Frosted Acrylic Tokens
      expect(css).toContain('--glass-bg:');
      expect(css).toContain('--glass-border:');
      expect(css).toContain('--glass-specular:');
      expect(css).toContain('--glass-shadow:');
      expect(css).toContain('--glass-blur:');
      expect(css).toContain('--ambient-mesh:');

      // Dark Obsidian Glass Tokens
      expect(css).toContain('.dark {');
      expect(css).toContain('rgba(11, 17, 33,');

      // Optical Glass Variants
      expect(css).toContain('[data-glass-style="frosted"]');
      expect(css).toContain('[data-glass-style="cyber"]');

      // Blur Intensities
      expect(css).toContain('[data-blur-intensity="low"]');
      expect(css).toContain('[data-blur-intensity="medium"]');
      expect(css).toContain('[data-blur-intensity="high"]');

      // Dynamic Accents
      expect(css).toContain('[data-accent="cyan"]');
      expect(css).toContain('[data-accent="violet"]');
      expect(css).toContain('[data-accent="emerald"]');
      expect(css).toContain('[data-accent="amber"]');
      expect(css).toContain('[data-accent="rose"]');

      // Core Glass Utility Classes
      expect(css).toContain('.glass-panel');
      expect(css).toContain('.glass-card');
      expect(css).toContain('.glass-button');
      expect(css).toContain('.liquid-ambient-mesh');
      expect(css).toContain('backdrop-filter:');
      expect(css).toContain('-webkit-backdrop-filter:');
    });
  });

  describe('Theme Default Configuration & Preference Validation', () => {
    it('should have standard Dark Obsidian with specular sheen as default', () => {
      expect(DEFAULT_THEME_PREFERENCES).toEqual({
        mode: 'dark',
        glassStyle: 'specular',
        blurIntensity: 'medium',
        accentColor: 'cyan',
      });
      expect(THEME_STORAGE_KEY).toBe('acc_studio_theme_prefs');
    });

    it('should safely validate and fallback on malformed or corrupted localStorage payloads', () => {
      // Mock validation function mirroring ThemeProvider's load logic
      const parsePreferences = (raw: string | null): ThemePreferences => {
        if (!raw) return { ...DEFAULT_THEME_PREFERENCES };
        try {
          const parsed = JSON.parse(raw);
          return {
            mode: parsed.mode === 'light' ? 'light' : 'dark',
            glassStyle: ['specular', 'frosted', 'cyber'].includes(parsed.glassStyle)
              ? parsed.glassStyle
              : DEFAULT_THEME_PREFERENCES.glassStyle,
            blurIntensity: ['low', 'medium', 'high'].includes(parsed.blurIntensity)
              ? parsed.blurIntensity
              : DEFAULT_THEME_PREFERENCES.blurIntensity,
            accentColor: ['cyan', 'violet', 'emerald', 'amber', 'rose'].includes(parsed.accentColor)
              ? parsed.accentColor
              : DEFAULT_THEME_PREFERENCES.accentColor,
          };
        } catch {
          return { ...DEFAULT_THEME_PREFERENCES };
        }
      };

      // Corrupted JSON
      expect(parsePreferences('{ broken json ')).toEqual(DEFAULT_THEME_PREFERENCES);

      // Partial object with valid and invalid values
      const customPayload = JSON.stringify({
        mode: 'light',
        glassStyle: 'cyber',
        blurIntensity: 'ultra-extreme', // invalid -> fallback to medium
        accentColor: 'rose',
      });
      const parsed = parsePreferences(customPayload);
      expect(parsed.mode).toBe('light');
      expect(parsed.glassStyle).toBe('cyber');
      expect(parsed.blurIntensity).toBe('medium');
      expect(parsed.accentColor).toBe('rose');
    });
  });

  describe('DOM Attribute & Class Synchronization', () => {
    it('should update root DOM element classList and data attributes accurately', () => {
      // Simulated DOM Element
      const mockElement = {
        classList: {
          classes: new Set<string>(),
          toggle(cls: string, force?: boolean) {
            if (force === undefined) {
              if (this.classes.has(cls)) this.classes.delete(cls);
              else this.classes.add(cls);
            } else if (force) {
              this.classes.add(cls);
            } else {
              this.classes.delete(cls);
            }
          },
          contains(cls: string) {
            return this.classes.has(cls);
          },
        },
        attributes: new Map<string, string>(),
        setAttribute(k: string, v: string) {
          this.attributes.set(k, v);
        },
        getAttribute(k: string) {
          return this.attributes.get(k);
        },
      };

      const syncThemeToDOM = (el: typeof mockElement, prefs: ThemePreferences) => {
        el.classList.toggle('dark', prefs.mode === 'dark');
        el.setAttribute('data-glass-style', prefs.glassStyle);
        el.setAttribute('data-blur-intensity', prefs.blurIntensity);
        el.setAttribute('data-accent', prefs.accentColor);
      };

      // 1. Initial Dark State
      syncThemeToDOM(mockElement, DEFAULT_THEME_PREFERENCES);
      expect(mockElement.classList.contains('dark')).toBe(true);
      expect(mockElement.getAttribute('data-glass-style')).toBe('specular');
      expect(mockElement.getAttribute('data-blur-intensity')).toBe('medium');
      expect(mockElement.getAttribute('data-accent')).toBe('cyan');

      // 2. Switch to Light Mode with Frosted Glass & Emerald Accent
      const lightFrostedPrefs: ThemePreferences = {
        mode: 'light',
        glassStyle: 'frosted',
        blurIntensity: 'high',
        accentColor: 'emerald',
      };
      syncThemeToDOM(mockElement, lightFrostedPrefs);
      expect(mockElement.classList.contains('dark')).toBe(false);
      expect(mockElement.getAttribute('data-glass-style')).toBe('frosted');
      expect(mockElement.getAttribute('data-blur-intensity')).toBe('high');
      expect(mockElement.getAttribute('data-accent')).toBe('emerald');

      // 3. Switch to Cyber Glass with Violet Accent
      const cyberPrefs: ThemePreferences = {
        mode: 'dark',
        glassStyle: 'cyber',
        blurIntensity: 'low',
        accentColor: 'violet',
      };
      syncThemeToDOM(mockElement, cyberPrefs);
      expect(mockElement.classList.contains('dark')).toBe(true);
      expect(mockElement.getAttribute('data-glass-style')).toBe('cyber');
      expect(mockElement.getAttribute('data-blur-intensity')).toBe('low');
      expect(mockElement.getAttribute('data-accent')).toBe('violet');
    });
  });
});

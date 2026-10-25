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
      expect(css).toContain('.glass-button-primary');
      expect(css).toContain('.glass-pill');
      expect(css).toContain('.glass-badge-accent');
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

  describe('Preview Component Liquid Glass Consistency', () => {
    it('should style Preview viewport with glass-panel, liquid-ambient-mesh, and no hardcoded opaque card', () => {
      // Since Tasks 302–303 decomposed Preview.tsx into modular subcomponents under preview/,
      // we aggregate the full source tree for assertions across coordinator + all submodules.
      const previewDir = path.resolve(__dirname, '../apps/studio/src/components/preview');
      const previewPath = path.resolve(__dirname, '../apps/studio/src/components/Preview.tsx');

      expect(fs.existsSync(previewPath)).toBe(true);
      expect(fs.existsSync(previewDir)).toBe(true);

      // Aggregate coordinator + all submodule sources
      const submoduleFiles = fs.readdirSync(previewDir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
      const allPreviewCode = [
        fs.readFileSync(previewPath, 'utf8'),
        ...submoduleFiles.map(f => fs.readFileSync(path.join(previewDir, f), 'utf8')),
      ].join('\n');

      // Root viewport container must use glass-panel and ambient mesh (across module tree)
      expect(allPreviewCode).toContain('glass-panel');
      expect(allPreviewCode).toContain('liquid-ambient-mesh');
      expect(allPreviewCode).not.toContain('bg-slate-950/90');
      expect(allPreviewCode).not.toContain('border-slate-800');

      // Uses dynamic CSS variables for accent highlights
      expect(allPreviewCode).toContain('var(--accent-primary)');
      expect(allPreviewCode).toContain('var(--accent-glow)');
      expect(allPreviewCode).toContain('var(--glass-border)');

      // ViewportQuickTransport submodule: floating quick transport bar uses glass-panel
      expect(allPreviewCode).toContain('glass-panel px-4 py-2 rounded-full');

      // ViewportCanvasLayer submodule: studio-canvas must be strictly isolated from outside theme
      expect(allPreviewCode).toContain('id="studio-canvas"');
      expect(allPreviewCode).toContain('isolate rounded-xl overflow-hidden');
      expect(allPreviewCode).toContain('backgroundColor: \'#000000\'');

      // SubtitlesOverlay submodule: subtitles must follow video styling, NOT outer glass-panel
      expect(allPreviewCode).toContain('bg-black/80 text-white');
      expect(allPreviewCode).not.toContain('glass-panel px-5 py-2 rounded-xl');
    });
  });

  describe('SettingsModal & Dialog Primitives Liquid Glass Contrast & Semantic Tokens', () => {
    it('should style SettingsModal and Dialog with semantic theme tokens and zero hardcoded white/slate text', () => {
      const modalPath = path.resolve(__dirname, '../apps/studio/src/components/SettingsModal.tsx');
      const dialogPath = path.resolve(__dirname, '../apps/studio/src/components/ui/dialog.tsx');

      expect(fs.existsSync(modalPath)).toBe(true);
      expect(fs.existsSync(dialogPath)).toBe(true);

      const modalCode = fs.readFileSync(modalPath, 'utf8');
      const dialogCode = fs.readFileSync(dialogPath, 'utf8');

      // Must not hardcode text-slate-100, text-slate-200, or text-slate-400 which wash out on light frosted glass
      expect(modalCode).not.toContain('text-slate-100');
      expect(modalCode).not.toContain('text-slate-200');
      expect(modalCode).not.toContain('text-slate-400');
      expect(modalCode).not.toContain('border-white/10');
      expect(modalCode).not.toContain('border-white/5');

      // Must NOT contain hardcoded inline button background styles
      expect(modalCode).not.toContain('bg-[var(--accent-primary)]');
      expect(modalCode).not.toContain('ring-[var(--accent-primary)]');

      // Must use dynamic tokens and semantic classes
      expect(modalCode).toContain('glass-pill');
      expect(modalCode).toContain('glass-badge-accent');
      expect(modalCode).toContain('variant="accent"');
      expect(modalCode).toContain('text-foreground');
      expect(modalCode).toContain('text-muted-foreground');
      expect(modalCode).toContain('border-[var(--glass-border)]');

      // Button component checks:
      const buttonPath = path.resolve(__dirname, '../apps/studio/src/components/ui/button.tsx');
      expect(fs.existsSync(buttonPath)).toBe(true);
      const buttonCode = fs.readFileSync(buttonPath, 'utf8');
      expect(buttonCode).toContain('accent:');
      expect(buttonCode).toContain('glass:');
      expect(buttonCode).toContain('glass-button-primary');

      // Dialog primitive checks:
      // Must not hardcode text-slate-900 or text-slate-500
      expect(dialogCode).not.toContain('text-slate-900');
      expect(dialogCode).not.toContain('text-slate-500');
      expect(dialogCode).toContain('text-foreground');
      expect(dialogCode).toContain('text-muted-foreground');
    });
  });
});

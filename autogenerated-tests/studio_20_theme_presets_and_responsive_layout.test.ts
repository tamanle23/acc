import { describe, it, expect, beforeEach } from 'bun:test';
import fs from 'fs';
import path from 'path';
import {
  STUDIO_THEME_PRESETS,
  getThemePreset,
  getAllThemePresets,
  getPresetsByCategory,
  type StudioThemePreset,
  applyThemeToDocument,
  type ThemePreferences,
} from '../apps/studio/src/lib/theme';

describe('Studio 20 Curated Theme Presets & Responsive Layout Architecture (Task 428)', () => {
  it('should define exactly 20 curated iconic theme presets', () => {
    expect(STUDIO_THEME_PRESETS.length).toBe(20);
    const allPresets = getAllThemePresets();
    expect(allPresets.length).toBe(20);
  });

  it('should contain all 20 required preset IDs matching design specifications', () => {
    const expectedIds = [
      'obsidian',
      'tokyo-night',
      'catppuccin-mocha',
      'catppuccin-latte',
      'dracula-pro',
      'nord-frost',
      'one-dark-pro',
      'github-dark-dimmed',
      'github-light-modern',
      'monokai-pro',
      'cyberpunk-2077',
      'synthwave-84',
      'solarized-dark',
      'solarized-light',
      'gruvbox-dark',
      'rose-pine',
      'horizon-dark',
      'ayu-mirage',
      'midnight-oled',
      'vesper-noir',
    ];

    const actualIds = STUDIO_THEME_PRESETS.map((p) => p.id);
    for (const id of expectedIds) {
      expect(actualIds).toContain(id);
    }
  });

  it('should specify complete semantic HSL and Liquid Glass tokens for every preset', () => {
    for (const preset of STUDIO_THEME_PRESETS) {
      expect(preset.name).toBeTruthy();
      expect(preset.category).toBeDefined();
      expect(['dark', 'light']).toContain(preset.mode);
      expect(preset.preview.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(preset.preview.primary).toMatch(/^#[0-9a-fA-F]{6}$/);

      const t = preset.tokens;
      expect(t.background).toBeTruthy();
      expect(t.foreground).toBeTruthy();
      expect(t.card).toBeTruthy();
      expect(t.primary).toBeTruthy();
      expect(t.border).toBeTruthy();
      expect(t.accentPrimary).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(t.accentGlow).toContain('rgba(');
      expect(t.glassBg).toContain('rgba(');
      expect(t.glassBorder).toContain('rgba(');
    }
  });

  it('should filter presets accurately by category', () => {
    const darkPresets = getPresetsByCategory('dark');
    expect(darkPresets.length).toBeGreaterThan(0);
    expect(darkPresets.every((p) => p.category === 'dark')).toBe(true);

    const lightPresets = getPresetsByCategory('light');
    expect(lightPresets.length).toBeGreaterThanOrEqual(3); // catppuccin-latte, github-light-modern, solarized-light
    expect(lightPresets.every((p) => p.category === 'light')).toBe(true);

    const cyberPresets = getPresetsByCategory('cyber');
    expect(cyberPresets.some((p) => p.id === 'cyberpunk-2077')).toBe(true);

    const oledPresets = getPresetsByCategory('minimal');
    expect(oledPresets.some((p) => p.id === 'midnight-oled')).toBe(true);
  });

  it('should retrieve preset by id with fallback to default obsidian', () => {
    const tokyo = getThemePreset('tokyo-night');
    expect(tokyo.id).toBe('tokyo-night');
    expect(tokyo.name).toBe('Tokyo Night');

    const fallback = getThemePreset('non-existent-theme-id');
    expect(fallback.id).toBe('obsidian');
  });

  describe('applyThemeToDocument Preset Synchronization', () => {
    let mockClassList: Set<string>;
    let mockAttributes: Map<string, string>;
    let mockStyleProperties: Map<string, string>;

    beforeEach(() => {
      mockClassList = new Set<string>();
      mockAttributes = new Map<string, string>();
      mockStyleProperties = new Map<string, string>();

      (globalThis as any).document = {
        documentElement: {
          classList: {
            add: (cls: string) => mockClassList.add(cls),
            remove: (cls: string) => mockClassList.delete(cls),
            toggle: (cls: string, force?: boolean) => {
              const shouldHave = force !== undefined ? force : !mockClassList.has(cls);
              if (shouldHave) mockClassList.add(cls);
              else mockClassList.delete(cls);
              return shouldHave;
            },
            contains: (cls: string) => mockClassList.has(cls),
          },
          setAttribute: (attr: string, val: string) => mockAttributes.set(attr, val),
          getAttribute: (attr: string) => mockAttributes.get(attr) ?? null,
          style: {
            setProperty: (prop: string, val: string) => mockStyleProperties.set(prop, val),
            getPropertyValue: (prop: string) => mockStyleProperties.get(prop) ?? '',
          },
        },
      };
    });

    it('injects preset tokens into CSS variables and sets data-theme-preset attribute', () => {
      const prefs: ThemePreferences = {
        presetId: 'catppuccin-mocha',
        mode: 'dark',
        glassStyle: 'specular',
        blurIntensity: 'medium',
        accentColor: 'cyan',
      };

      applyThemeToDocument(prefs);

      expect(mockAttributes.get('data-theme-preset')).toBe('catppuccin-mocha');
      expect(mockAttributes.get('data-theme-mode')).toBe('dark');
      expect(mockClassList.has('dark')).toBe(true);

      const mocha = getThemePreset('catppuccin-mocha');
      expect(mockStyleProperties.get('--background')).toBe(mocha.tokens.background);
      expect(mockStyleProperties.get('--card')).toBe(mocha.tokens.card);
      expect(mockStyleProperties.get('--glass-bg')).toBe(mocha.tokens.glassBg);
    });

    it('handles light presets accurately with preset-governed mode', () => {
      const prefs: ThemePreferences = {
        presetId: 'github-light-modern',
        mode: 'light',
        glassStyle: 'frosted',
        blurIntensity: 'high',
        accentColor: 'emerald',
      };

      applyThemeToDocument(prefs);

      expect(mockAttributes.get('data-theme-preset')).toBe('github-light-modern');
      expect(mockAttributes.get('data-theme-mode')).toBe('light');
      expect(mockClassList.has('light')).toBe(true);
      expect(mockClassList.has('dark')).toBe(false);

      const ghLight = getThemePreset('github-light-modern');
      expect(mockStyleProperties.get('--background')).toBe(ghLight.tokens.background);
    });
  });

  describe('UI Component Modernization & Responsive Layout Verification', () => {
    const rootDir = path.resolve(__dirname, '..');

    it('Titlebar.tsx includes ThemeQuickSwitcher and Zen Mode toggle', () => {
      const titlebarCode = fs.readFileSync(
        path.join(rootDir, 'apps/studio/src/components/Titlebar.tsx'),
        'utf8'
      );
      expect(titlebarCode).toContain('ThemeQuickSwitcher');
      expect(titlebarCode).toContain('onToggleZen');
      expect(titlebarCode).toContain('isZenMode');
    });

    it('ThemeQuickSwitcher.tsx exists and renders search, categories, and preset grid', () => {
      const switcherPath = path.join(rootDir, 'apps/studio/src/components/ThemeQuickSwitcher.tsx');
      expect(fs.existsSync(switcherPath)).toBe(true);
      const code = fs.readFileSync(switcherPath, 'utf8');
      expect(code).toContain('STUDIO_THEME_PRESETS');
      expect(code).toContain('selectPreset');
      expect(code).toContain('Palette');
      expect(code).toContain('Popover');
    });

    it('ViewportQuickTransport.tsx exists and provides studio-grade floating playback controls', () => {
      const transportPath = path.join(
        rootDir,
        'apps/studio/src/components/preview/ViewportQuickTransport.tsx'
      );
      expect(fs.existsSync(transportPath)).toBe(true);
      const code = fs.readFileSync(transportPath, 'utf8');
      expect(code).toContain('glass-panel px-4 py-2 rounded-full');
      expect(code).toContain('RationalTime');
      expect(code).toContain('handleStepBack');
      expect(code).toContain('handleStepForward');
    });

    it('Toolbar.tsx implements progressive collapse for responsive viewports', () => {
      const toolbarCode = fs.readFileSync(
        path.join(rootDir, 'apps/studio/src/components/timeline/Toolbar.tsx'),
        'utf8'
      );
      expect(toolbarCode).toContain('hidden md:flex');
      expect(toolbarCode).toContain('ZoomIn');
      expect(toolbarCode).toContain('ZoomOut');
    });

    it('App.tsx manages Zen Mode state and passes controls to Titlebar', () => {
      const appCode = fs.readFileSync(path.join(rootDir, 'apps/studio/src/App.tsx'), 'utf8');
      expect(appCode).toContain('isZenMode');
      expect(appCode).toContain('handleToggleZen');
      expect(appCode).toContain('isZenMode={isZenMode}');
      expect(appCode).toContain('onToggleZen={handleToggleZen}');
    });
  });
});

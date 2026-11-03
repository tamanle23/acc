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

    it('dynamically applies decoupled optical glass finishes (specular, frosted, cyber) to DOM CSS variables', () => {
      // 1. Frosted Matte: specular is none, border highlight equals border, soft shadow
      applyThemeToDocument({
        presetId: 'obsidian',
        mode: 'dark',
        glassStyle: 'frosted',
        blurIntensity: 'medium',
        accentColor: 'cyan',
      });

      expect(mockAttributes.get('data-glass-style')).toBe('frosted');
      expect(mockStyleProperties.get('--glass-specular')).toBe('none');
      const obsidian = getThemePreset('obsidian');
      expect(mockStyleProperties.get('--glass-border-highlight')).toBe(obsidian.tokens.glassBorder);
      expect(mockStyleProperties.get('--glass-shadow')).toBe('0 6px 20px 0 rgba(0, 0, 0, 0.4)');

      // 2. Cyber Glow: preset-governed rim highlight, cyber border, and chromatic glow shadow (derived directly from preset tokens)
      applyThemeToDocument({
        presetId: 'dracula-pro',
        mode: 'dark',
        glassStyle: 'cyber',
        blurIntensity: 'medium',
      });

      const dracula = getThemePreset('dracula-pro');
      expect(mockAttributes.get('data-glass-style')).toBe('cyber');
      expect(mockStyleProperties.get('--glass-border-highlight')).toBe(dracula.tokens.accentPrimary);
      expect(mockStyleProperties.get('--glass-specular')).toContain(dracula.tokens.accentPrimary);
      expect(mockStyleProperties.get('--glass-shadow')).toContain(dracula.tokens.accentPrimary);

      // Verify that obsidian with cyber finish strictly uses obsidian.tokens.accentPrimary (#06b6d4)
      applyThemeToDocument({
        presetId: 'obsidian',
        mode: 'dark',
        glassStyle: 'cyber',
        blurIntensity: 'medium',
      });
      expect(mockStyleProperties.get('--glass-border-highlight')).toBe(obsidian.tokens.accentPrimary);
      expect(mockStyleProperties.get('--glass-specular')).toContain(obsidian.tokens.accentPrimary);
      expect(mockStyleProperties.get('--glass-shadow')).toContain(obsidian.tokens.accentPrimary);

      // 3. Specular Sheen: native preset specular reflection restored
      applyThemeToDocument({
        presetId: 'obsidian',
        mode: 'dark',
        glassStyle: 'specular',
        blurIntensity: 'medium',
        accentColor: 'cyan',
      });

      expect(mockAttributes.get('data-glass-style')).toBe('specular');
      expect(mockStyleProperties.get('--glass-specular')).toBe(obsidian.tokens.glassSpecular);
      expect(mockStyleProperties.get('--glass-border-highlight')).toBe(obsidian.tokens.glassBorderHighlight);
      expect(mockStyleProperties.get('--glass-shadow')).toBe(obsidian.tokens.glassShadow);
    });

    it('dynamically applies decoupled acrylic blur intensities (low, medium, high) to DOM CSS variables', () => {
      applyThemeToDocument({
        presetId: 'tokyo-night',
        mode: 'dark',
        glassStyle: 'specular',
        blurIntensity: 'low',
        accentColor: 'cyan',
      });
      expect(mockAttributes.get('data-blur-intensity')).toBe('low');
      expect(mockStyleProperties.get('--glass-blur')).toBe('blur(6px)');

      applyThemeToDocument({
        presetId: 'tokyo-night',
        mode: 'dark',
        glassStyle: 'specular',
        blurIntensity: 'medium',
        accentColor: 'cyan',
      });
      expect(mockAttributes.get('data-blur-intensity')).toBe('medium');
      expect(mockStyleProperties.get('--glass-blur')).toBe('blur(18px)');

      applyThemeToDocument({
        presetId: 'tokyo-night',
        mode: 'dark',
        glassStyle: 'specular',
        blurIntensity: 'high',
        accentColor: 'cyan',
      });
      expect(mockAttributes.get('data-blur-intensity')).toBe('high');
      expect(mockStyleProperties.get('--glass-blur')).toBe('blur(40px)');
    });
  });

  describe('UI Component Modernization & Responsive Layout Verification', () => {
    const rootDir = path.resolve(__dirname, '..');

    it('SettingsModal.tsx renders live material specimen and uses decoupled shadow-glass and bg-glass-surface', () => {
      const modalCode = fs.readFileSync(
        path.join(rootDir, 'apps/studio/src/components/SettingsModal.tsx'),
        'utf8'
      );
      expect(modalCode).toContain('Live Material Specimen (Physics Parity)');
      expect(modalCode).toContain('shadow-glass');
      expect(modalCode).toContain('bg-glass-surface');
      expect(modalCode).toContain('border-t-glass-border-highlight');
      expect(modalCode).not.toContain('shadow-2xl backdrop-blur-2xl');

      // Verify elimination of duplicated dynamic accent color control
      expect(modalCode).not.toContain('Dynamic Accent Color Override');
      expect(modalCode).not.toContain('ACCENT_COLORS');
    });

    it('Titlebar.tsx includes ThemeQuickSwitcher and Zen Mode toggle', () => {
      const titlebarCode = fs.readFileSync(
        path.join(rootDir, 'apps/studio/src/components/Titlebar.tsx'),
        'utf8'
      );
      expect(titlebarCode).toContain('ThemeQuickSwitcher');
      expect(titlebarCode).toContain('onToggleZen');
      expect(titlebarCode).toContain('isZenMode');
    });

    it('Titlebar.tsx implements adaptive LOD support with useTitlebarLOD and More Actions Popover', () => {
      const titlebarCode = fs.readFileSync(
        path.join(rootDir, 'apps/studio/src/components/Titlebar.tsx'),
        'utf8'
      );
      expect(titlebarCode).toContain('useTitlebarLOD');
      expect(titlebarCode).toContain('TitlebarLOD');
      expect(titlebarCode).toContain("lod === 'compact'");
      expect(titlebarCode).toContain("lod === 'full'");
      expect(titlebarCode).toContain("lod !== 'full'");
      expect(titlebarCode).toContain('Popover');
      expect(titlebarCode).not.toContain('overflow-x-auto');
    });

    it('useContainerLOD.ts exports getTitlebarLODTier and correctly maps breakpoint widths', async () => {
      const { getTitlebarLODTier } = await import(
        '../apps/studio/src/components/preview/useContainerLOD'
      );
      expect(getTitlebarLODTier(500)).toBe('compact');
      expect(getTitlebarLODTier(799)).toBe('compact');
      expect(getTitlebarLODTier(800)).toBe('medium');
      expect(getTitlebarLODTier(1100)).toBe('medium');
      expect(getTitlebarLODTier(1279)).toBe('medium');
      expect(getTitlebarLODTier(1280)).toBe('full');
      expect(getTitlebarLODTier(1920)).toBe('full');
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

    it('Preview.tsx docks ViewportQuickTransport bottom center outside of canvas viewport', () => {
      const previewPath = path.join(rootDir, 'apps/studio/src/components/Preview.tsx');
      const previewCode = fs.readFileSync(previewPath, 'utf8');

      // Must mount ViewportQuickTransport
      expect(previewCode).toContain('ViewportQuickTransport');

      // Must be outside the inner canvas viewport wrapper
      const canvasIndex = previewCode.indexOf('isolate rounded-xl overflow-hidden');
      const canvasCloseIndex = previewCode.indexOf('</div>\n\n        {/* Telemetry Companion Card */}');
      const transportIndex = previewCode.indexOf('<ViewportQuickTransport');

      expect(canvasIndex).toBeGreaterThan(0);
      expect(canvasCloseIndex).toBeGreaterThan(canvasIndex);
      expect(transportIndex).toBeGreaterThan(canvasCloseIndex);

      // Viewport container must reserve top and bottom padding so canvas is never occluded
      expect(previewCode).toContain('pt-14 pb-14');
      expect(previewCode).toContain('useContainerLOD');
      expect(previewCode).toContain('lod={containerLOD}');
    });

    it('ViewportControlBar.tsx docks top center of Preview.tsx with adaptive LOD support', () => {
      const controlBarPath = path.join(
        rootDir,
        'apps/studio/src/components/preview/ViewportControlBar.tsx'
      );
      expect(fs.existsSync(controlBarPath)).toBe(true);
      const code = fs.readFileSync(controlBarPath, 'utf8');

      // Must dock top center as a floating HUD
      expect(code).toContain('absolute top-3 left-1/2 -translate-x-1/2');
      expect(code).toContain('glass-panel px-3 py-1.5 rounded-full');

      // Must NOT use horizontal scrolling - must use adaptive LOD instead!
      expect(code).not.toContain('overflow-x-auto');

      // Must support adaptive PreviewLOD and tools popover
      expect(code).toContain('PreviewLOD');
      expect(code).toContain("lod = 'full'");
      expect(code).toContain("lod === 'compact'");
      expect(code).toContain("lod === 'full'");
      expect(code).toContain("lod !== 'full'");
      expect(code).toContain('Popover');

      // Transform Coordinates Readout must have strict fixed-width and tabular numbers to eliminate gizmo drag jitter
      expect(code).toContain('w-[248px] shrink-0');
      expect(code).toContain('tabular-nums font-mono');
    });

    it('ViewportQuickTransport.tsx implements adaptive LOD support', () => {
      const transportPath = path.join(
        rootDir,
        'apps/studio/src/components/preview/ViewportQuickTransport.tsx'
      );
      const code = fs.readFileSync(transportPath, 'utf8');

      // Must support adaptive PreviewLOD
      expect(code).toContain('PreviewLOD');
      expect(code).toContain("lod = 'full'");
      expect(code).toContain("lod !== 'compact'");
      expect(code).toContain("lod === 'full'");
      expect(code).toContain('absolute bottom-3.5 left-1/2 -translate-x-1/2');

      // Must NOT use horizontal scrolling - must adapt cleanly to compact/medium/full
      expect(code).not.toContain('overflow-x-auto');
    });

    it('useContainerLOD.ts exports getLODTierFromWidth and correctly maps breakpoint widths', async () => {
      const { getLODTierFromWidth } = await import(
        '../apps/studio/src/components/preview/useContainerLOD'
      );
      expect(getLODTierFromWidth(320)).toBe('compact');
      expect(getLODTierFromWidth(500)).toBe('compact');
      expect(getLODTierFromWidth(639)).toBe('compact');
      expect(getLODTierFromWidth(640)).toBe('medium');
      expect(getLODTierFromWidth(800)).toBe('medium');
      expect(getLODTierFromWidth(959)).toBe('medium');
      expect(getLODTierFromWidth(960)).toBe('full');
      expect(getLODTierFromWidth(1440)).toBe('full');
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

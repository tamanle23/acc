import { describe, it, expect, beforeEach } from 'bun:test';
import fs from 'fs';
import path from 'path';
import {
  DEFAULT_THEME_PREFERENCES,
  applyThemeToDocument,
  type ThemePreferences,
  type GlassStyle,
  type BlurIntensity,
} from '../apps/studio/src/lib/theme/ThemeProvider';
import {
  STUDIO_THEME_PRESETS,
  getThemePreset,
} from '../apps/studio/src/lib/theme';

describe('Studio Unified System Theme Manager & Tailwind v4 Integration', () => {
  const indexCssPath = path.join(process.cwd(), 'apps/studio/src/index.css');
  const indexCssContent = fs.readFileSync(indexCssPath, 'utf-8');

  it('defines custom variants and bridges ThemeProvider CSS variables into Tailwind v4 @theme', () => {
    // Custom variants for mode, glass style, and blur intensity
    expect(indexCssContent).toContain('@custom-variant dark');
    expect(indexCssContent).toContain('@custom-variant light');
    expect(indexCssContent).toContain('@custom-variant glass-cyber');
    expect(indexCssContent).toContain('@custom-variant glass-frosted');
    expect(indexCssContent).toContain('@custom-variant glass-specular');
    expect(indexCssContent).toContain('@custom-variant blur-low');
    expect(indexCssContent).toContain('@custom-variant blur-medium');
    expect(indexCssContent).toContain('@custom-variant blur-high');

    // @theme token bridging
    expect(indexCssContent).toContain('--color-accent-theme: var(--accent-primary)');
    expect(indexCssContent).toContain('--color-accent-glow: var(--accent-glow)');
    expect(indexCssContent).toContain('--color-glass-surface: var(--glass-bg)');
    expect(indexCssContent).toContain('--color-glass-border: var(--glass-border)');
    expect(indexCssContent).toContain('--color-glass-border-highlight: var(--glass-border-highlight)');
    expect(indexCssContent).toContain('--shadow-glass: var(--glass-specular), var(--glass-shadow)');
    expect(indexCssContent).toContain('--shadow-accent-glow: 0 0 15px var(--accent-glow)');

    // Ensure invalid var(--alpha(...)) syntax is removed from cyber glass style
    expect(indexCssContent).not.toContain('var(--alpha(');
    expect(indexCssContent).toContain('color-mix(in srgb, var(--accent-primary)');
  });

  it('ensures theme presets define rich accent colors and eliminates duplicated dynamic accent overrides', () => {
    // Colors are strictly governed by presets
    for (const preset of STUDIO_THEME_PRESETS) {
      expect(preset.tokens.accentPrimary).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(preset.tokens.accentGlow).toContain('rgba(');
      expect(preset.tokens.primary).toBeTruthy();
      expect(preset.tokens.ring).toBeTruthy();
    }
    // Verify no [data-accent] rules in index.css
    expect(indexCssContent).not.toContain('[data-accent=');
  });

  describe('applyThemeToDocument DOM & CSS Variable Synchronization', () => {
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

    it('synchronizes dark/light mode classes, data attributes, and CSS custom properties across theme presets and optical styles', () => {
      const glassStyles: GlassStyle[] = ['specular', 'frosted', 'cyber'];
      const blurs: BlurIntensity[] = ['low', 'medium', 'high'];

      for (const preset of STUDIO_THEME_PRESETS) {
        for (const glassStyle of glassStyles) {
          for (const blurIntensity of blurs) {
            const prefs: ThemePreferences = {
              presetId: preset.id,
              mode: preset.mode,
              glassStyle,
              blurIntensity,
            };

            applyThemeToDocument(prefs);

            // Class & data-theme-mode synchronization
            expect(mockClassList.has(preset.mode)).toBe(true);
            expect(mockClassList.has(preset.mode === 'dark' ? 'light' : 'dark')).toBe(false);
            expect(mockAttributes.get('data-theme-mode')).toBe(preset.mode);
            expect(mockAttributes.get('data-theme-preset')).toBe(preset.id);

            // Optical physics attributes
            expect(mockAttributes.get('data-glass-style')).toBe(glassStyle);
            expect(mockAttributes.get('data-blur-intensity')).toBe(blurIntensity);

            // Strictly NO data-accent attribute (eliminated duplicate control)
            expect(mockAttributes.has('data-accent')).toBe(false);

            // Preset tokens strictly govern color variables
            expect(mockStyleProperties.get('--primary')).toBe(preset.tokens.primary);
            expect(mockStyleProperties.get('--ring')).toBe(preset.tokens.ring);
            expect(mockStyleProperties.get('--accent-primary')).toBe(preset.tokens.accentPrimary);
            expect(mockStyleProperties.get('--color-brand-accent')).toBe(preset.tokens.colorBrandAccent);
            expect(mockStyleProperties.get('--accent-glow')).toBe(preset.tokens.accentGlow);
          }
        }
      }
    });
  });

  it('ensures inspector, titlebar, modals, preview, debugger, and timeline components use unified semantic theme tokens', () => {
    const filesToVerify = [
      'apps/studio/src/App.tsx',
      'apps/studio/src/components/Titlebar.tsx',
      'apps/studio/src/components/RightSidebar.tsx',
      'apps/studio/src/components/LeftSidebar.tsx',
      'apps/studio/src/components/ShortcutsModal.tsx',
      'apps/studio/src/components/SettingsModal.tsx',
      'apps/studio/src/components/EasingCurveSelector.tsx',
      'apps/studio/src/components/audio/MasterAudioMeter.tsx',
      'apps/studio/src/components/inspector/ProjectInspector.tsx',
      'apps/studio/src/components/inspector/TrackInspector.tsx',
      'apps/studio/src/components/inspector/SequenceInspector.tsx',
      'apps/studio/src/components/inspector/ModifierControlStrategies.tsx',
      'apps/studio/src/components/inspector/ParameterControls.tsx',
      'apps/studio/src/components/inspector/DynamicModifierInspector.tsx',
      'apps/studio/src/components/inspector/CueTimelineDialog.tsx',
      'apps/studio/src/components/timeline/Toolbar.tsx',
      'apps/studio/src/components/timeline/ClipItem.tsx',
      'apps/studio/src/components/timeline/TrimHandle.tsx',
      'apps/studio/src/components/preview/ViewportControlBar.tsx',
      'apps/studio/src/components/preview/TransformGizmoOverlay.tsx',
      'apps/studio/src/components/preview/TelemetryCompanionCard.tsx',
      'apps/studio/src/components/preview/ContextualActionPill.tsx',
      'apps/studio/src/components/preview/ViewportSafeGuides.tsx',
      'apps/studio/src/components/debugger/VisualIRJsonDebuggerModal.tsx',
      'apps/studio/src/components/debugger/code-editor/ShikiCodeViewer.tsx',
      'apps/studio/src/components/debugger/visual-editor/VisualJsonFieldEditor.tsx',
      'apps/studio/src/components/debugger/visual-editor/VisualJsonTreeNode.tsx',
    ];

    for (const relPath of filesToVerify) {
      const fullPath = path.join(process.cwd(), relPath);
      const content = fs.readFileSync(fullPath, 'utf-8');

      // Must not have broken Tailwind opacity scale classes like /200 or /600
      expect(content).not.toContain('accent-theme/200');
      expect(content).not.toContain('accent-theme/600');

      // Must not have legacy light-only hardcoded slate/indigo classes
      expect(content).not.toContain('bg-indigo-600');
      expect(content).not.toContain('text-indigo-600');
      expect(content).not.toContain('border-slate-200');
      expect(content).not.toContain('text-slate-600');
      expect(content).not.toContain('bg-slate-900');
    }
  });

  it('documents the unified Studio Theme System & Tailwind v4 styling guide', () => {
    const guidePath = path.join(process.cwd(), 'docs/studio_theme_styling_guide.md');
    expect(fs.existsSync(guidePath)).toBe(true);
    const guideContent = fs.readFileSync(guidePath, 'utf-8');
    expect(guideContent).toContain('applyThemeToDocument');
    expect(guideContent).toContain('bg-accent-theme');
    expect(guideContent).toContain('text-primary-foreground');
    expect(guideContent).toContain('glass-panel');
    expect(guideContent).toContain('glass-card');
    expect(guideContent).toContain('glass-pill');
  });
});

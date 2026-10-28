import { describe, it, expect } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const STUDIO_ROOT = path.resolve(__dirname, '../apps/studio');
const STUDIO_SRC = path.join(STUDIO_ROOT, 'src');

describe('Studio Phase 4: Enterprise UX, Resizable Layout, Sonner Toasts & Specs Sync', () => {
  describe('1. Mandatory Workspace Specs Sync (DESIGN.md & ROUTE.md)', () => {
    it('verifies apps/studio/DESIGN.md exists and documents Liquid Glass tokens and color invariants', () => {
      const designPath = path.join(STUDIO_ROOT, 'DESIGN.md');
      expect(fs.existsSync(designPath)).toBe(true);
      const content = fs.readFileSync(designPath, 'utf-8');

      expect(content).toContain('Liquid Glass Enterprise');
      expect(content).toContain('--glass-bg');
      expect(content).toContain('--glass-border');
      expect(content).toContain('track-audio');
      expect(content).toContain('track-v1');
      expect(content).toContain('track-vfx');
      expect(content).toContain('track-text');
      expect(content).toContain('WCAG 2.2 AA Compliance');
    });

    it('verifies apps/studio/ROUTE.md exists and documents workspace topology and keybinding matrix', () => {
      const routePath = path.join(STUDIO_ROOT, 'ROUTE.md');
      expect(fs.existsSync(routePath)).toBe(true);
      const content = fs.readFileSync(routePath, 'utf-8');

      expect(content).toContain('Workspace Layout Architecture');
      expect(content).toContain('react-resizable-panels');
      expect(content).toContain('Export Progress Modal');
      expect(content).toContain('Settings Modal');
      expect(content).toContain('Visual IR Debugger');
      expect(content).toContain('Global Keyboard Shortcut Matrix');
    });
  });

  describe('2. Resizable Workspace Layout & Non-Blocking Sonner Toasts', () => {
    it('composes ResizablePanelGroup and ResizablePanel in App.tsx for dynamic viewport/timeline split', () => {
      const appContent = fs.readFileSync(path.join(STUDIO_SRC, 'App.tsx'), 'utf-8');

      expect(appContent).toContain('ResizablePanelGroup');
      expect(appContent).toContain('ResizablePanel');
      expect(appContent).toContain('ResizableHandle');
      expect(appContent).toContain('direction="vertical"');
    });

    it('replaces window.alert() with Sonner toast notifications in App.tsx', () => {
      const appContent = fs.readFileSync(path.join(STUDIO_SRC, 'App.tsx'), 'utf-8');

      expect(appContent).not.toContain('alert(');
      expect(appContent).toContain('toast.success(');
      expect(appContent).toContain('toast.error(');
      expect(appContent).toContain('<Toaster');
    });
  });

  describe('3. WCAG 2.2 AA Accessibility & Aria Attributes', () => {
    it('enforces aria-pressed, aria-label, and focus-visible rings on SettingsModal finish/blur swatches', () => {
      const settingsContent = fs.readFileSync(
        path.join(STUDIO_SRC, 'components/SettingsModal.tsx'),
        'utf-8'
      );

      expect(settingsContent).toContain('aria-pressed={preferences.mode === \'dark\'}');
      expect(settingsContent).toContain('aria-pressed={preferences.mode === \'light\'}');
      expect(settingsContent).toContain('aria-pressed={preferences.glassStyle === style.id}');
      expect(settingsContent).toContain('aria-pressed={preferences.blurIntensity === blur.id}');
      expect(settingsContent).toContain('aria-pressed={preferences.accentColor === accent.id}');
      expect(settingsContent).toContain('focus-visible:ring-2 focus-visible:ring-accent-theme');
    });

    it('enforces aria-pressed and aria-label on TrackHeaderCard lock and mute toggles', () => {
      const cardContent = fs.readFileSync(
        path.join(STUDIO_SRC, 'components/timeline/TrackHeaderCard.tsx'),
        'utf-8'
      );

      expect(cardContent).toContain('aria-pressed={isLocked}');
      expect(cardContent).toContain('aria-label={isLocked ? \'Unlock Track\' : \'Lock Track\'}');
      expect(cardContent).toContain('aria-pressed={isMuted}');
      expect(cardContent).toContain('aria-label={isMuted ? \'Unmute Track\' : \'Mute Track\'}');
    });

    it('enforces aria-pressed and aria-label across Timeline Toolbar and ViewportControlBar transport buttons', () => {
      const toolbarContent = fs.readFileSync(
        path.join(STUDIO_SRC, 'components/timeline/Toolbar.tsx'),
        'utf-8'
      );
      expect(toolbarContent).toContain('aria-label="Selection Tool (V)"');
      expect(toolbarContent).toContain('aria-label="Razor Split Tool (C)"');
      expect(toolbarContent).toContain('aria-label="Hand Panning Tool (H)"');
      expect(toolbarContent).toContain('aria-label="Shuttle Rewind (J)"');
      expect(toolbarContent).toContain('aria-label="Shuttle Forward (L)"');
      expect(toolbarContent).toContain('aria-pressed={isPlaying}');

      const viewportControlContent = fs.readFileSync(
        path.join(STUDIO_SRC, 'components/preview/ViewportControlBar.tsx'),
        'utf-8'
      );
      expect(viewportControlContent).toContain('aria-label={isPlaying ? \'Pause Viewport\' : \'Play Viewport\'}');
      expect(viewportControlContent).toContain('aria-pressed={isPlaying}');
    });
  });
});

/**
 * studio_build_and_module_resolution.test.ts
 *
 * CI regression test for Task 308: Verifies that the Vite alias configuration
 * correctly resolves all internal bare imports used by shadcn/ui components
 * (i.e., 'cn' -> src/lib/utils, 'radix-ui' package present).
 *
 * Also validates post-decomposition module structure for Tasks 302 and 303.
 */
import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const STUDIO = path.join(ROOT, 'apps/studio');
const SRC = path.join(STUDIO, 'src');

describe('Task 308: Studio Production Build Parity & Module Resolution', () => {
  describe('Vite Config: Alias Resolution', () => {
    it('should define the cn alias resolving to src/lib/utils in vite.config.ts', () => {
      const viteConfig = fs.readFileSync(path.join(STUDIO, 'vite.config.ts'), 'utf-8');
      expect(viteConfig).toContain("'cn':");
      expect(viteConfig).toContain("src/lib/utils");
    });

    it('should have src/lib/utils.ts exporting cn()', () => {
      const utils = fs.readFileSync(path.join(SRC, 'lib/utils.ts'), 'utf-8');
      expect(utils).toContain('export function cn');
      expect(utils).toContain('twMerge');
      expect(utils).toContain('clsx');
    });

    it('should have radix-ui listed in apps/studio/package.json dependencies', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(STUDIO, 'package.json'), 'utf-8'));
      expect(pkg.dependencies['radix-ui']).toBeDefined();
    });

    it('all shadcn UI components should import cn from "cn" bare specifier (alias target)', () => {
      const uiDir = path.join(SRC, 'components/ui');
      const uiFiles = fs.readdirSync(uiDir).filter(f => f.endsWith('.tsx'));
      // At least 50 shadcn primitive components should use `from "cn"`
      const filesUsingCn = uiFiles.filter(f => {
        const code = fs.readFileSync(path.join(uiDir, f), 'utf-8');
        return code.includes('from "cn"');
      });
      expect(filesUsingCn.length).toBeGreaterThan(50);
    });
  });

  describe('Task 302/303: Timeline & Preview Decomposition Structure', () => {
    it('should have timeline submodule directory with all key modules', () => {
      const timelineDir = path.join(SRC, 'components/timeline');
      expect(fs.existsSync(timelineDir)).toBe(true);
      const files = fs.readdirSync(timelineDir);
      expect(files).toContain('TimelineClipItem.tsx');
      expect(files).toContain('TimelineToolbar.tsx');
      expect(files).toContain('TrackHeaderCard.tsx');
      expect(files).toContain('DroppableTrackLane.tsx');
      expect(files).toContain('TrimHandle.tsx');
      expect(files).toContain('TimelineEmptyState.tsx');
      expect(files).toContain('index.ts');
    });

    it('should have preview submodule directory with all key modules', () => {
      const previewDir = path.join(SRC, 'components/preview');
      expect(fs.existsSync(previewDir)).toBe(true);
      const files = fs.readdirSync(previewDir);
      expect(files).toContain('ViewportCanvasLayer.tsx');
      expect(files).toContain('ViewportControlBar.tsx');
      expect(files).toContain('ViewportQuickTransport.tsx');
      expect(files).toContain('SubtitlesOverlay.tsx');
      expect(files).toContain('TransformGizmoOverlay.tsx');
      expect(files).toContain('TelemetryCompanionCard.tsx');
      expect(files).toContain('index.ts');
    });

    it('Timeline.tsx coordinator should import TimelineEmptyState', () => {
      const coord = fs.readFileSync(path.join(SRC, 'components/Timeline.tsx'), 'utf-8');
      expect(coord).toContain('TimelineEmptyState');
    });

    it('timeline/index.ts should export TimelineEmptyState', () => {
      const idx = fs.readFileSync(path.join(SRC, 'components/timeline/index.ts'), 'utf-8');
      expect(idx).toContain('TimelineEmptyState');
    });
  });
});

describe('Task 310: TransitionCurveGraph — Visual Easing Bezier Visualizer', () => {
  const graphPath = path.join(SRC, 'components/inspector/TransitionCurveGraph.tsx');

  it('should exist as a new component file', () => {
    expect(fs.existsSync(graphPath)).toBe(true);
  });

  it('should export TransitionCurveGraph and BezierPoint types', () => {
    const code = fs.readFileSync(graphPath, 'utf-8');
    expect(code).toContain('export const TransitionCurveGraph');
    expect(code).toContain('export interface BezierPoint');
    expect(code).toContain('export interface CubicBezier');
    expect(code).toContain('export interface TransitionCurveGraphProps');
  });

  it('should render an interactive SVG with draggable control points', () => {
    const code = fs.readFileSync(graphPath, 'utf-8');
    expect(code).toContain('onPointerDown');
    expect(code).toContain('onPointerMove');
    expect(code).toContain('onPointerUp');
    // P1 and P2 draggable handles
    expect(code).toContain("'p1'");
    expect(code).toContain("'p2'");
  });

  it('should implement cubic bezier math for curve evaluation', () => {
    const code = fs.readFileSync(graphPath, 'utf-8');
    expect(code).toContain('cubicBezierY');
    expect(code).toContain('buildBezierPath');
  });

  it('should have animated scrubber ball using requestAnimationFrame (not Date.now)', () => {
    const code = fs.readFileSync(graphPath, 'utf-8');
    expect(code).toContain('requestAnimationFrame');
    expect(code).toContain('cancelAnimationFrame');
    // Must NOT use Date.now() (non-deterministic) per DETERMINISTIC-HANDSHAKE-BACKPRESSURE rule
    expect(code).not.toContain('Date.now()');
  });

  it('should sync bezier preset on easingId change via useEffect', () => {
    const code = fs.readFileSync(graphPath, 'utf-8');
    expect(code).toContain('getDefaultBezier(easingId)');
    expect(code).toContain('setBezier(getDefaultBezier(easingId))');
  });

  it('should use glass-border and accent-primary for Tailwind v4 token compliance', () => {
    const code = fs.readFileSync(graphPath, 'utf-8');
    expect(code).toContain('border-glass-border');
    expect(code).toContain('var(--accent-primary)');
    expect(code).toContain('var(--accent-glow)');
  });

  it('EasingCurveSelector.tsx should import and render TransitionCurveGraph', () => {
    const sel = fs.readFileSync(path.join(SRC, 'components/EasingCurveSelector.tsx'), 'utf-8');
    expect(sel).toContain('TransitionCurveGraph');
    expect(sel).toContain('showGraph');
    expect(sel).toContain('ChevronDown');
  });
});

describe('Task 311: 5-State Component Matrix & WCAG 2.1 AA', () => {
  describe('TimelineEmptyState — Empty State Component', () => {
    const emptyStatePath = path.join(SRC, 'components/timeline/TimelineEmptyState.tsx');

    it('should exist as a dedicated empty state component', () => {
      expect(fs.existsSync(emptyStatePath)).toBe(true);
    });

    it('should use semantic ARIA role and label for screen readers', () => {
      const code = fs.readFileSync(emptyStatePath, 'utf-8');
      expect(code).toContain('role="region"');
      expect(code).toContain('aria-label=');
    });

    it('should render a primary CTA button with aria-label', () => {
      const code = fs.readFileSync(emptyStatePath, 'utf-8');
      expect(code).toContain('onLoadSample');
      expect(code).toContain('onAddTrack');
      expect(code).toContain('aria-label=');
    });

    it('should use focus-visible rings for WCAG 2.1 AA keyboard navigation', () => {
      const code = fs.readFileSync(emptyStatePath, 'utf-8');
      expect(code).toContain('focus-visible:ring-2');
      expect(code).toContain('focus-visible:ring-accent-theme');
    });

    it('should use semantic theme tokens (no hardcoded colors)', () => {
      const code = fs.readFileSync(emptyStatePath, 'utf-8');
      expect(code).toContain('bg-muted');
      expect(code).toContain('text-muted-foreground');
      expect(code).toContain('text-foreground');
      expect(code).not.toContain('bg-gray-');
      expect(code).not.toContain('text-gray-');
    });
  });

  describe('Button.tsx WCAG 2.1 AA Focus Rings', () => {
    it('should have focus-visible:ring on all button variants', () => {
      const code = fs.readFileSync(path.join(SRC, 'components/ui/button.tsx'), 'utf-8');
      expect(code).toContain('focus-visible:ring');
      expect(code).toContain('focus-visible:ring-[var(--accent-primary)]');
    });
  });

  describe('Input.tsx WCAG 2.1 AA Focus Rings', () => {
    it('should have focus-visible ring on input elements', () => {
      const code = fs.readFileSync(path.join(SRC, 'components/ui/input.tsx'), 'utf-8');
      expect(code).toContain('focus-visible:ring');
    });
  });

  describe('Inspector Panel — Semantic aria attributes', () => {
    it('ProjectInspector.tsx should render accessible form labels', () => {
      const code = fs.readFileSync(
        path.join(SRC, 'components/inspector/ProjectInspector.tsx'), 'utf-8'
      );
      // Has form labels for content ID and canvas resolution fields
      expect(code).toContain('<label');
    });

    it('SequenceInspector.tsx should include aria-label or role on key interactive controls', () => {
      const code = fs.readFileSync(
        path.join(SRC, 'components/inspector/SequenceInspector.tsx'), 'utf-8'
      );
      expect(code).toContain('aria-label');
    });
  });
});

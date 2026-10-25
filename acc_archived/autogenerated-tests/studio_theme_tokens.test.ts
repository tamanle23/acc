import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';

describe('Studio Theme Tokens & Liquid Glass UI Consistency (Iteration 8 Phase 5)', () => {
  const rootDir = path.resolve(__dirname, '..');
  const buttonPath = path.join(rootDir, 'apps/studio/src/components/ui/button.tsx');
  const titlebarPath = path.join(rootDir, 'apps/studio/src/components/Titlebar.tsx');
  // Timeline.tsx was decomposed in Task 302 into modular subcomponents under timeline/.
  // We aggregate coordinator + all submodule sources for assertions.
  const timelinePath = path.join(rootDir, 'apps/studio/src/components/Timeline.tsx');
  const timelineDir = path.join(rootDir, 'apps/studio/src/components/timeline');

  /**
   * Helper: read coordinator file + all timeline submodules as one aggregated source string.
   * This handles the post-302 decomposition where tokens may live in TrackHeaderCard.tsx,
   * TimelineToolbar.tsx, DroppableTrackLane.tsx, etc.
   */
  function readTimelineModuleTree(): string {
    const coordinatorCode = fs.readFileSync(timelinePath, 'utf-8');
    const submoduleFiles = fs.readdirSync(timelineDir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
    const submoduleCodes = submoduleFiles.map(f => fs.readFileSync(path.join(timelineDir, f), 'utf-8'));
    return [coordinatorCode, ...submoduleCodes].join('\n');
  }

  it('button.tsx should use semantic Liquid Glass accent tokens without hardcoded indigo-600', () => {
    const content = fs.readFileSync(buttonPath, 'utf-8');
    
    // Must contain active accent primary and glow
    expect(content).toContain('var(--accent-primary)');
    expect(content).toContain('var(--accent-glow)');
    expect(content).toContain('focus-visible:ring-[var(--accent-primary)]');
    
    // Must NOT contain hardcoded bg-indigo-600 or ring-indigo-500
    expect(content).not.toContain('bg-indigo-600');
    expect(content).not.toContain('ring-indigo-500');
    expect(content).not.toContain('hover:bg-indigo-700');
  });

  it('Titlebar.tsx should use semantic glass tokens without rogue indigo/slate classes', () => {
    const content = fs.readFileSync(titlebarPath, 'utf-8');

    // IR Badge logo must use accent tokens.
    // Task 306 migrated from CSS var bg-[var(--accent-primary)] to Tailwind v4 bg-accent-theme.
    const hasOldAccentBadge = content.includes('bg-[var(--accent-primary)] text-slate-950');
    const hasNewAccentBadge = content.includes('bg-accent-theme text-primary-foreground');
    expect(hasOldAccentBadge || hasNewAccentBadge).toBe(true);

    // Shadow glow: may be CSS var or Tailwind v4 shadow-accent-glow
    const hasOldGlow = content.includes('shadow-[0_0_12px_var(--accent-glow)]');
    const hasNewGlow = content.includes('shadow-accent-glow');
    expect(hasOldGlow || hasNewGlow).toBe(true);

    // Select trigger must use glass tokens
    expect(content).toContain('bg-[var(--glass-bg)] border-[var(--glass-border)] text-foreground');

    // Drawer and action buttons must not have hardcoded indigo
    expect(content).not.toContain('bg-indigo-600 text-white');
    expect(content).not.toContain('text-indigo-700 dark:text-indigo-300');
    expect(content).not.toContain('border-indigo-200');
  });

  it('Timeline module tree should use glass-panel track headers and semantic controls', () => {
    // Read full decomposed module tree (Task 302: coordinator + timeline/ submodules)
    const content = readTimelineModuleTree();

    // Track headers (TrackHeaderCard.tsx) must use glass variables
    expect(content).toContain('bg-[var(--glass-bg)] rounded-md border border-[var(--glass-border)]');

    // Toolbar (TimelineToolbar.tsx) must use glass-border semantic tokens
    // Post-306 unification: may be Tailwind v4 tokens (border-glass-border) or CSS vars
    const hasGlassBorderTw4 = content.includes('border-glass-border');
    const hasGlassBorderCssVar = content.includes('border-b border-[var(--glass-border)]');
    expect(hasGlassBorderTw4 || hasGlassBorderCssVar).toBe(true);

    // Toggle buttons must use accent highlight (Tailwind v4: accent-theme or CSS var: accent-primary)
    const hasAccentTw4 = content.includes('data-[state=on]:bg-accent-theme/15');
    const hasAccentCssVar = content.includes('data-[state=on]:bg-[var(--accent-primary)]/15');
    expect(hasAccentTw4 || hasAccentCssVar).toBe(true);

    // Must NOT contain rogue slate header backgrounds or indigo rings
    expect(content).not.toContain('bg-slate-100/90 rounded-md border border-slate-200');
    expect(content).not.toContain('ring-indigo-500');
    expect(content).not.toContain('ring-indigo-400');
    expect(content).not.toContain('active:bg-indigo-300');
  });
});

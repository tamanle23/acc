import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';

describe('Studio Theme Tokens & Liquid Glass UI Consistency (Iteration 8 Phase 5)', () => {
  const rootDir = path.resolve(__dirname, '..');
  const buttonPath = path.join(rootDir, 'apps/studio/src/components/ui/button.tsx');
  const titlebarPath = path.join(rootDir, 'apps/studio/src/components/Titlebar.tsx');
  const timelinePath = path.join(rootDir, 'apps/studio/src/components/Timeline.tsx');

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

    // IR Badge logo must use accent primary
    expect(content).toContain('bg-[var(--accent-primary)] text-slate-950');
    expect(content).toContain('shadow-[0_0_12px_var(--accent-glow)]');

    // Select trigger must use glass tokens
    expect(content).toContain('bg-[var(--glass-bg)] border-[var(--glass-border)] text-foreground');

    // Drawer and action buttons must not have hardcoded indigo
    expect(content).not.toContain('bg-indigo-600 text-white');
    expect(content).not.toContain('text-indigo-700 dark:text-indigo-300');
    expect(content).not.toContain('border-indigo-200');
  });

  it('Timeline.tsx should use glass-panel track headers and semantic controls', () => {
    const content = fs.readFileSync(timelinePath, 'utf-8');

    // Track headers must use glass variables
    expect(content).toContain('bg-[var(--glass-bg)] rounded-md border border-[var(--glass-border)]');

    // Transport bar must use glass border and accent tokens
    expect(content).toContain('border-b border-[var(--glass-border)]');
    expect(content).toContain('data-[state=on]:bg-[var(--accent-primary)]/15');

    // Must NOT contain rogue slate header backgrounds or indigo rings
    expect(content).not.toContain('bg-slate-100/90 rounded-md border border-slate-200');
    expect(content).not.toContain('ring-indigo-500');
    expect(content).not.toContain('ring-indigo-400');
    expect(content).not.toContain('active:bg-indigo-300');
  });
});

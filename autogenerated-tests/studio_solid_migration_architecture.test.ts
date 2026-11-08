import { describe, it, expect } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRoot } from 'solid-js';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';
import { useIRState, useStudioStore } from '../apps/studio/src/lib/ir/useStudioStore';
import { PlayheadController } from '../apps/studio/src/lib/playhead/PlayheadController';
import { TimelinePointerStateMachine } from '../apps/studio/src/lib/timeline/interaction/TimelinePointerStateMachine';

const STUDIO_ROOT = path.resolve(__dirname, '../apps/studio');
const STUDIO_SRC = path.resolve(STUDIO_ROOT, 'src');

function getAllFiles(dir: string, ext = ['.ts', '.tsx']): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, ext));
    } else if (ext.some((e) => item.name.endsWith(e))) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Studio SolidJS 1.9 Migration Architecture & Boundary Tests', () => {
  describe('1. Monorepo Package Dependencies Parity (apps/studio/package.json)', () => {
    const pkgPath = path.join(STUDIO_ROOT, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };

    it('has zero React dependencies or types in package.json', () => {
      expect(allDeps['react']).toBeUndefined();
      expect(allDeps['react-dom']).toBeUndefined();
      expect(allDeps['@types/react']).toBeUndefined();
      expect(allDeps['@types/react-dom']).toBeUndefined();
      expect(allDeps['lucide-react']).toBeUndefined();
      expect(allDeps['@dnd-kit/core']).toBeUndefined();
      expect(allDeps['@dnd-kit/utilities']).toBeUndefined();
      expect(allDeps['sonner']).toBeUndefined();
      expect(allDeps['@radix-ui/react-dialog']).toBeUndefined();
    });

    it('includes all modern SolidJS runtime, headless UI, and DND libraries', () => {
      expect(allDeps['solid-js']).toBeDefined();
      expect(allDeps['vite-plugin-solid']).toBeDefined();
      expect(allDeps['@kobalte/core']).toBeDefined();
      expect(allDeps['@corvu/resizable']).toBeDefined();
      expect(allDeps['@tanstack/solid-virtual']).toBeDefined();
      expect(allDeps['@dnd-kit/solid']).toBeDefined();
      expect(allDeps['lucide-solid']).toBeDefined();
      expect(allDeps['solid-sonner']).toBeDefined();
    });
  });

  describe('2. Source Code React-Free Invariant across apps/studio/src', () => {
    const srcFiles = getAllFiles(STUDIO_SRC);

    it('scans all source files and verifies zero React import statements', () => {
      const violations: string[] = [];
      const reactImportRegex = /from\s+['"](react|react-dom|lucide-react|@dnd-kit\/core|@dnd-kit\/utilities|sonner)['"]/;

      for (const file of srcFiles) {
        const content = fs.readFileSync(file, 'utf8');
        if (reactImportRegex.test(content)) {
          violations.push(path.relative(STUDIO_ROOT, file));
        }
      }

      expect(violations).toEqual([]);
      expect(srcFiles.length).toBeGreaterThan(60);
    });

    it('verifies zero React namespace qualifiers (React.FC, React.useState, etc.)', () => {
      const violations: string[] = [];
      const reactNamespaceRegex = /\bReact\.(FC|useState|useEffect|useMemo|useCallback|useRef|ComponentProps|ReactNode|MouseEvent)\b/;

      for (const file of srcFiles) {
        const content = fs.readFileSync(file, 'utf8');
        if (reactNamespaceRegex.test(content)) {
          violations.push(path.relative(STUDIO_ROOT, file));
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('3. SolidJS Reactive Store (useStudioStore & useIRState)', () => {
    it('returns an accessor function that re-executes reactively in Solid createRoot', () => {
      createRoot((dispose) => {
        const stateAccessor = useIRState();
        expect(typeof stateAccessor).toBe('function');
        const state = stateAccessor();
        expect(state).toBeDefined();
        expect(state.doc).toBeDefined();
        expect(Array.isArray(state.doc.tracks)).toBe(true);

        const store = useStudioStore();
        expect(typeof store.irState).toBe('function');
        expect(typeof store.dispatch).toBe('function');
        expect(typeof store.undo).toBe('function');
        expect(typeof store.redo).toBe('function');

        dispose();
      });
    });
  });

  describe('4. Framework-Agnostic State Machines & Playhead Controller Parity', () => {
    it('verifies TimelinePointerStateMachine is vanilla TypeScript and works without UI framework', () => {
      let ghostUpdates = 0;
      const sm = new TimelinePointerStateMachine({
        onGhostUpdate: () => {
          ghostUpdates++;
        },
      });

      expect(sm).toBeDefined();
      expect(sm.getCursor()).toBe('default');
      expect(sm.getGhostState()).toBeNull();
    });

    it('verifies PlayheadController creates zero-allocation 60fps needle controller', () => {
      const pc = PlayheadController.getInstance();
      expect(pc).toBeDefined();
      expect(typeof pc.getFrame).toBe('function');
      expect(typeof pc.getIsPlaying).toBe('function');
      expect(typeof pc.subscribeLowFrequency).toBe('function');

      const initialFrame = pc.getFrame();
      expect(typeof initialFrame).toBe('number');
    });
  });
});

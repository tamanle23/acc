import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { StudioBootController } from '../apps/studio/src/lib/boot/StudioBootController';

describe('Studio Boot Splash & First-Load Lifecycle Suite', () => {
  const indexHtmlPath = path.resolve(__dirname, '../apps/studio/index.html');
  const appTsxPath = path.resolve(__dirname, '../apps/studio/src/App.tsx');

  describe('1. Static HTML & Pre-Hydration Architecture (Zero FOUC & Accessibility)', () => {
    it('verifies index.html has no light-mode background classes and initializes with dark obsidian', () => {
      const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

      // Must NOT contain bg-slate-50 (which caused the blinding white flash on cold boot)
      expect(htmlContent).not.toContain('bg-slate-50');

      // Must initialize body with deep obsidian canvas styling
      expect(htmlContent).toContain('bg-[#070a13]');
      expect(htmlContent).toContain('text-slate-100');
    });

    it('verifies #app-boot-splash has strict ARIA accessibility attributes and Liquid Glass elements', () => {
      const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

      // Accessible status announcement
      expect(htmlContent).toContain('id="app-boot-splash"');
      expect(htmlContent).toContain('role="status"');
      expect(htmlContent).toContain('aria-live="polite"');
      expect(htmlContent).toContain('aria-label="Loading ACC Studio Workstation"');

      // Key visual elements
      expect(htmlContent).toContain('splash-card');
      expect(htmlContent).toContain('splash-logo-container');
      expect(htmlContent).toContain('splash-logo-svg');
      expect(htmlContent).toContain('splash-title');
      expect(htmlContent).toContain('ACC STUDIO');
      expect(htmlContent).toContain('splash-badge');
      expect(htmlContent).toContain('splash-progress-track');
      expect(htmlContent).toContain('splash-progress-bar');
      expect(htmlContent).toContain('id="splash-status-text"');
      expect(htmlContent).toContain('id="splash-reload-btn"');
    });

    it('verifies critical inline CSS uses GPU compositor-only properties and respects prefers-reduced-motion', () => {
      const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

      // Critical style tag
      expect(htmlContent).toContain('id="boot-splash-style"');

      // GPU Compositor only (@keyframes use transform and opacity)
      expect(htmlContent).toContain('@keyframes splash-pulse');
      expect(htmlContent).toContain('transform: scale(');
      expect(htmlContent).toContain('@keyframes splash-shimmer');
      expect(htmlContent).toContain('transform: translateX(');
      expect(htmlContent).toContain('will-change: transform');

      // Smooth exit transition
      expect(htmlContent).toContain('.splash-hidden');
      expect(htmlContent).toContain('opacity: 0');
      expect(htmlContent).toContain('pointer-events: none');

      // WCAG 2.2 AA Motion reduction
      expect(htmlContent).toContain('@media (prefers-reduced-motion: reduce)');
      expect(htmlContent).toContain('animation: none !important');
    });

    it('verifies inline timer handles slow-network progressive feedback (5s, 10s)', () => {
      const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

      expect(htmlContent).toContain('__studioBootTimers');
      expect(htmlContent).toContain('5000');
      expect(htmlContent).toContain('10000');
      expect(htmlContent).toContain('Loading video & audio subsystems...');
      expect(htmlContent).toContain('Taking longer than usual...');
    });
  });

  describe('2. StudioBootController Lifecycle & First-Paint Synchronization', () => {
    class MockElement {
      id: string = '';
      textContent: string = '';
      classList = {
        classes: new Set<string>(),
        add: (cls: string) => this.classList.classes.add(cls),
        contains: (cls: string) => this.classList.classes.has(cls),
        remove: (cls: string) => this.classList.classes.delete(cls),
      };
      parentNode: any = null;
      children: MockElement[] = [];

      appendChild(child: MockElement) {
        child.parentNode = this;
        this.children.push(child);
        return child;
      }

      removeChild(child: MockElement) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) {
          this.children.splice(idx, 1);
          child.parentNode = null;
        }
        return child;
      }
    }

    let mockSplashEl: MockElement;
    let mockStatusEl: MockElement;
    let mockStyleEl: MockElement;
    let elementsById: Map<string, MockElement>;

    beforeEach(() => {
      StudioBootController._reset();

      elementsById = new Map();
      mockStyleEl = new MockElement();
      mockStyleEl.id = 'boot-splash-style';
      elementsById.set('boot-splash-style', mockStyleEl);

      mockSplashEl = new MockElement();
      mockSplashEl.id = 'app-boot-splash';
      elementsById.set('app-boot-splash', mockSplashEl);

      mockStatusEl = new MockElement();
      mockStatusEl.id = 'splash-status-text';
      mockStatusEl.textContent = 'Initializing workstation...';
      mockSplashEl.appendChild(mockStatusEl);
      elementsById.set('splash-status-text', mockStatusEl);

      const mockBody = new MockElement();
      mockBody.appendChild(mockSplashEl);

      const mockHead = new MockElement();
      mockHead.appendChild(mockStyleEl);

      (globalThis as any).document = {
        getElementById: (id: string) => elementsById.get(id) || null,
        body: mockBody,
        head: mockHead,
      };

      (globalThis as any).window = {
        __studioBootTimers: [],
        requestAnimationFrame: (cb: FrameRequestCallback) => {
          setTimeout(() => cb(performance.now()), 1);
          return 1;
        },
      };
    });

    afterEach(() => {
      delete (globalThis as any).document;
      delete (globalThis as any).window;
    });

    it('updates status message dynamically when requested', () => {
      StudioBootController.updateStatus('Compiling VideoIR modifiers...');
      expect(mockStatusEl.textContent).toBe('Compiling VideoIR modifiers...');
    });

    it('clears slow-network timers and dismisses splash with double-rAF first-paint synchronization', async () => {
      const timer1 = setTimeout(() => {}, 10000);
      const timer2 = setTimeout(() => {}, 10000);
      (window as any).__studioBootTimers = [timer1, timer2];

      let rafCalls = 0;
      (window as any).requestAnimationFrame = (cb: FrameRequestCallback): number => {
        rafCalls++;
        setTimeout(() => cb(performance.now()), 1);
        return rafCalls;
      };

      const dismissPromise = StudioBootController.dismiss();

      // Let the RAFs fire
      await new Promise((r) => setTimeout(r, 15));

      // Splash should have .splash-hidden added
      expect(mockSplashEl.classList.contains('splash-hidden')).toBe(true);
      expect(rafCalls).toBeGreaterThanOrEqual(2);

      // Timer array should be cleared
      expect((window as any).__studioBootTimers).toEqual([]);

      // Mock removal from map when removeChild is called
      mockSplashEl.parentNode.removeChild = (child: MockElement) => {
        elementsById.delete(child.id);
        return child;
      };
      mockStyleEl.parentNode.removeChild = (child: MockElement) => {
        elementsById.delete(child.id);
        return child;
      };

      // Wait for removal timeout (420ms)
      await dismissPromise;

      // Both splash element and style element should be pruned from DOM to free GPU memory
      expect(document.getElementById('app-boot-splash')).toBeNull();
      expect(document.getElementById('boot-splash-style')).toBeNull();
    });

    it('is idempotent and ignores redundant dismissal invocations', async () => {
      await StudioBootController.dismiss();
      const secondCall = StudioBootController.dismiss();
      expect(secondCall).resolves.toBeUndefined();
    });
  });

  describe('3. React UI Performance Tuning & Code-Splitting in App.tsx', () => {
    it('verifies non-critical modals are lazy-loaded via React.lazy and wrapped in Suspense', () => {
      const appContent = fs.readFileSync(appTsxPath, 'utf8');

      // Export modals and settings modal must be lazy-loaded
      expect(appContent).toContain("const ExportProgressModal = React.lazy(");
      expect(appContent).toContain("const ExportConfigModal = React.lazy(");
      expect(appContent).toContain("const SettingsModal = React.lazy(");

      // Must be wrapped in Suspense
      expect(appContent).toContain('<Suspense fallback={null}>');
      expect(appContent).toContain('<SettingsModal />');
      expect(appContent).toContain('<ExportConfigModal');
      expect(appContent).toContain('<ExportProgressModal');

      // StudioBootController must be called in StudioWorkspace
      expect(appContent).toContain('StudioBootController.dismiss()');
    });
  });
});

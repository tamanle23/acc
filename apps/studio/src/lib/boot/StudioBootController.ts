/**
 * StudioBootController
 * Coordinates first-paint synchronization and seamless dismissal of the
 * pre-hydration boot splash screen (#app-boot-splash).
 *
 * Implements double-rAF to guarantee zero canvas/timeline flicker.
 */

export class StudioBootController {
  private static dismissed = false;
  private static canvasReady = false;
  private static canvasReadyResolvers: Array<() => void> = [];

  /**
   * Updates the boot splash status readout if visible.
   */
  static updateStatus(message: string): void {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('splash-status-text');
    if (el) {
      el.textContent = message;
    }
  }

  /**
   * Signals that the viewport canvas worker has initialized and rendered its first frame.
   */
  static notifyCanvasReady(): void {
    this.canvasReady = true;
    const resolvers = [...this.canvasReadyResolvers];
    this.canvasReadyResolvers = [];
    resolvers.forEach((r) => r());
  }

  /**
   * Returns a promise that resolves when the viewport canvas worker is ready, or falls back gracefully on timeout.
   */
  static waitForCanvas(timeoutMs = 3000): Promise<boolean> {
    if (this.canvasReady) return Promise.resolve(true);

    return new Promise<boolean>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const onReady = () => {
        if (timer) clearTimeout(timer);
        resolve(true);
      };
      this.canvasReadyResolvers.push(onReady);

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          const idx = this.canvasReadyResolvers.indexOf(onReady);
          if (idx !== -1) this.canvasReadyResolvers.splice(idx, 1);
          resolve(false);
        }, timeoutMs);
      }
    });
  }

  /**
   * Orchestrates the engine warmup sequence before smoothly dismissing the splash:
   * 1. Updates splash status to "Warming up preview worker & neural engines..."
   * 2. Waits for PreviewWorkerCoordinator sidecar worker warmup (with timeout fallback).
   * 3. Waits for Viewport Canvas worker initialization (with timeout fallback).
   * 4. Enforces a minimum dwell time (at least 2.5 seconds by default) to prevent jarring/rushed outro.
   * 5. Updates splash status to "Ready" with a brief visual settling beat.
   * 6. Triggers smooth 700ms cinematic crossfade dismissal & unlinks DOM elements.
   */
  static async waitForEngineWarmup(options?: {
    workerTimeoutMs?: number;
    canvasTimeoutMs?: number;
    minDurationMs?: number;
    settleDelayMs?: number;
  }): Promise<void> {
    if (this.dismissed) return;

    this.updateStatus('Warming up preview worker & neural engines...');

    try {
      const { PreviewWorkerCoordinator } = await import('../../renderer/PreviewWorkerCoordinator');
      await Promise.all([
        PreviewWorkerCoordinator.getInstance().waitForWarmup(options?.workerTimeoutMs ?? 3500),
        this.waitForCanvas(options?.canvasTimeoutMs ?? 2500),
      ]);
    } catch {
      // Graceful fallback: never let an error trap the splash screen
    }

    // Enforce minimum dwell time (at least 2.5s) to guarantee an unhurried, calm brand presentation
    const minDuration = options?.minDurationMs ?? 2500;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const startTime = (typeof window !== 'undefined' && (window as any)?.__studioBootStartTime) ?? now;
    const elapsed = now - startTime;
    const remainingMs = Math.max(0, minDuration - elapsed);

    if (remainingMs > 0) {
      await new Promise((r) => setTimeout(r, remainingMs));
    }

    this.updateStatus('Ready');

    // Visual settle pause (default: 250ms) so "Ready" status is perceived before the smooth outro
    const settleDelay = options?.settleDelayMs ?? 250;
    if (settleDelay > 0) {
      await new Promise((r) => setTimeout(r, settleDelay));
    }

    await this.dismiss(0);
  }

  /**
   * Synchronizes with first paint via double requestAnimationFrame,
   * triggers the smooth 700ms cinematic fade/scale/blur dismissal, and unlinks
   * the splash element and its critical stylesheet from the DOM.
   */
  static dismiss(minDisplayDurationMs = 2500): Promise<void> {
    if (this.dismissed) return Promise.resolve();
    this.dismissed = true;

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return Promise.resolve();
    }

    // Developer simulation query param: ?splash=hold or ?splash=5000 (delay in ms)
    const searchParams = typeof window !== 'undefined' && window.location?.search
      ? new URLSearchParams(window.location.search)
      : null;
    const splashParam = searchParams?.get('splash');

    if (splashParam === 'hold' || splashParam === 'preview') {
      // Hold splash indefinitely for visual inspection and UI styling
      return Promise.resolve();
    }

    const simulatedDelayMs = splashParam && !isNaN(Number(splashParam)) ? Number(splashParam) : 0;

    // Calculate remaining minimum dwell time
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const startTime = (typeof window !== 'undefined' && (window as any)?.__studioBootStartTime) ?? now;
    const elapsed = now - startTime;
    const remainingMs = Math.max(0, minDisplayDurationMs - elapsed);
    const totalDelayMs = Math.max(remainingMs, simulatedDelayMs);

    return new Promise<void>((resolve) => {
      const splashEl = document.getElementById('app-boot-splash');
      if (!splashEl) {
        resolve();
        return;
      }

      const performDismiss = () => {
        // Clear slow-network timers to prevent late status triggers
        const win = window as any;
        if (Array.isArray(win.__studioBootTimers)) {
          win.__studioBootTimers.forEach((timerId: number) => clearTimeout(timerId));
          win.__studioBootTimers = [];
        }

        splashEl.classList.add('splash-hidden');

        // Transition duration is 700ms in CSS; remove DOM elements at 750ms
        setTimeout(() => {
          try {
            if (splashEl.parentNode) {
              splashEl.parentNode.removeChild(splashEl);
            }
            const styleEl = document.getElementById('boot-splash-style');
            if (styleEl && styleEl.parentNode) {
              styleEl.parentNode.removeChild(styleEl);
            }
          } catch {
            // Ignore edge-case removal errors
          }
          resolve();
        }, 750);
      };

      const scheduleDismiss = () => {
        if (typeof window.requestAnimationFrame === 'function') {
          // Double-rAF ensures Viewport Canvas and Timeline rulers have completed their first paint
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              performDismiss();
            });
          });
        } else {
          performDismiss();
        }
      };

      if (totalDelayMs > 0) {
        setTimeout(scheduleDismiss, totalDelayMs);
      } else {
        scheduleDismiss();
      }
    });
  }

  /**
   * For testing or resetting state across test runs.
   */
  static _reset(): void {
    this.dismissed = false;
    this.canvasReady = false;
    this.canvasReadyResolvers = [];
  }
}

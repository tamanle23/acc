/**
 * StudioBootController
 * Coordinates first-paint synchronization and seamless dismissal of the
 * pre-hydration boot splash screen (#app-boot-splash).
 *
 * Implements double-rAF to guarantee zero canvas/timeline flicker.
 */

export class StudioBootController {
  private static dismissed = false;

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
   * Synchronizes with first paint via double requestAnimationFrame,
   * triggers the smooth 400ms fade/scale dismissal, and unlinks
   * the splash element and its critical stylesheet from the DOM.
   */
  static dismiss(): Promise<void> {
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

        // Transition duration is 400ms in CSS; remove DOM elements at 420ms
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
        }, 420);
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

      if (simulatedDelayMs > 0) {
        setTimeout(scheduleDismiss, simulatedDelayMs);
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
  }
}

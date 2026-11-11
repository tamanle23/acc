import { onMount, onCleanup } from 'solid-js';
import type { AspectRatio } from '@/types/spatial';
import { useStudio } from '@/context/studio-context';

export interface UseStudioShortcutsOptions {
  onOpenShortcuts?: () => void;
  onOpenMediaVault?: () => void;
  onOpenThemeModal?: () => void;
  onToggleTheme?: () => void;
  onToggleLeftSidebar?: () => void;
  onToggleRightSidebar?: () => void;
  onTogglePresenter?: () => void;
}

const RATIOS: AspectRatio[] = ['9:16', '4:5', '1:1', '16:9'];

/**
 * Global Keyboard Shortcuts Hook for Kinetix Studio in SolidJS
 */
export function useStudioShortcuts(options?: UseStudioShortcutsOptions): void {
  const studio = useStudio();

  const handleKeyDown = (e: KeyboardEvent) => {
    // Don't intercept when user is typing in forms/inputs
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }

    // Space: Toggle Play/Pause
    if (e.code === 'Space') {
      e.preventDefault();
      studio.setIsPlaying((prev) => !prev);
      return;
    }

    // R / Shift+R: Reset Frame / Randomize Payload
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      if (e.shiftKey) {
        studio.handleRandomizeEvent();
      } else {
        studio.setIsPlaying(false);
        studio.setCurrentFrame(0);
      }
      return;
    }

    // M: Open Media Vault (or Shift+M: Toggle Audio Synth)
    if (e.key === 'm' || e.key === 'M') {
      if (!e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (e.shiftKey) {
          studio.handleToggleBpmSynth();
        } else if (options?.onOpenMediaVault) {
          options.onOpenMediaVault();
        } else {
          studio.handleToggleBpmSynth();
        }
        return;
      }
    }

    // 1, 2, 3, 4: Phase Jumps (0%, 25%, 50%, 75%)
    if (['1', '2', '3', '4'].includes(e.key)) {
      e.preventDefault();
      const phaseIdx = parseInt(e.key, 10) - 1;
      const targetProgress = phaseIdx * 0.25;
      studio.setCurrentFrame(Math.floor(targetProgress * studio.totalFrames));
      return;
    }

    // [ / ]: Toggle Sidebars (or Shift+[ / Shift+] for Aspect Ratios)
    if (e.key === '[' || e.key === ']') {
      e.preventDefault();
      if (e.shiftKey) {
        const currentIdx = RATIOS.indexOf(studio.state.aspectRatio);
        const nextIdx =
          e.key === ']'
            ? (currentIdx + 1) % RATIOS.length
            : (currentIdx - 1 + RATIOS.length) % RATIOS.length;
        studio.patchState({ aspectRatio: RATIOS[nextIdx] });
      } else {
        if (e.key === '[') {
          options?.onToggleLeftSidebar?.();
        } else {
          options?.onToggleRightSidebar?.();
        }
      }
      return;
    }

    // S: Copy Shareable Link
    if (e.key === 's' || e.key === 'S') {
      if (!e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        studio.copyShareUrl().then(() => {
          studio.triggerToast('Copied Shareable Deep Link (#config=...)');
        });
        return;
      }
    }

    // C: Switch to Config Tab
    if (e.key === 'c' || e.key === 'C') {
      if (!e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        studio.setActiveTab('config');
        studio.triggerToast('Opened 1. Config Hub');
        return;
      }
    }

    // F: Toggle Exhibition Gallery Kiosk Presenter Mode
    if (e.key === 'f' || e.key === 'F') {
      if (!e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        options?.onTogglePresenter?.();
        return;
      }
    }

    // T / Shift+T: Open Theme Modal / Toggle Studio Theme Mode
    if (e.key === 't' || e.key === 'T') {
      if (!e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (e.shiftKey) {
          options?.onToggleTheme?.();
        } else if (options?.onOpenThemeModal) {
          options.onOpenThemeModal();
        } else {
          options?.onToggleTheme?.();
        }
        return;
      }
    }

    // ?: Open Shortcuts Dialog
    if (e.key === '?') {
      e.preventDefault();
      options?.onOpenShortcuts?.();
      return;
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
}

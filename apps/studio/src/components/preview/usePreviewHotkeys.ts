import { onMount, onCleanup } from 'solid-js';
import { IRStateManager } from '../../lib/ir/irState';

export interface UsePreviewHotkeysOptions {
  selectedSeqId: () => string | null;
  editingCue: () => { sequenceId: string; cueIndex: number; text: string } | null;
  setEditingCue: (cue: { sequenceId: string; cueIndex: number; text: string } | null) => void;
  isSpacePressed: () => boolean;
  setIsSpacePressed: (pressed: boolean) => void;
  setVisionPassMode: (fn: (prev: 'composite' | 'depth' | 'normals' | 'alpha') => 'composite' | 'depth' | 'normals' | 'alpha') => void;
}

export function usePreviewHotkeys(options: UsePreviewHotkeysOptions) {
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        if (!options.isSpacePressed()) {
          options.setIsSpacePressed(true);
        }
      }

      if (e.shiftKey && e.key.toUpperCase() === 'V') {
        e.preventDefault();
        options.setVisionPassMode((prev) => {
          if (prev === 'composite') return 'depth';
          if (prev === 'depth') return 'normals';
          if (prev === 'normals') return 'alpha';
          return 'composite';
        });
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        const id = options.selectedSeqId();
        if (id) {
          e.preventDefault();
          IRStateManager.getInstance().duplicateSequence(id);
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const id = options.selectedSeqId();
        if (id && !options.editingCue()) {
          e.preventDefault();
          IRStateManager.getInstance().deleteSequence(id);
        }
      }

      if (e.key === 'Escape') {
        if (options.editingCue()) {
          options.setEditingCue(null);
        } else if (options.selectedSeqId()) {
          IRStateManager.getInstance().setSelectedSequenceId(null);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        options.setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    });
  });
}

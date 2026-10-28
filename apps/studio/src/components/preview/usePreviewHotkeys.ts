import { useEffect } from 'react';
import { IRStateManager } from '../../lib/ir/irState';

export interface UsePreviewHotkeysOptions {
  selectedSeqId: string | null;
  editingCue: { sequenceId: string; cueIndex: number; text: string } | null;
  setEditingCue: (cue: { sequenceId: string; cueIndex: number; text: string } | null) => void;
  isSpacePressed: boolean;
  setIsSpacePressed: (pressed: boolean) => void;
  setVisionPassMode: (fn: (prev: 'composite' | 'depth' | 'normals' | 'alpha') => 'composite' | 'depth' | 'normals' | 'alpha') => void;
}

export function usePreviewHotkeys({
  selectedSeqId,
  editingCue,
  setEditingCue,
  isSpacePressed,
  setIsSpacePressed,
  setVisionPassMode,
}: UsePreviewHotkeysOptions) {
  useEffect(() => {
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
        if (!isSpacePressed) {
          setIsSpacePressed(true);
        }
      }

      if (e.shiftKey && e.key.toUpperCase() === 'V') {
        e.preventDefault();
        setVisionPassMode((prev) => {
          if (prev === 'composite') return 'depth';
          if (prev === 'depth') return 'normals';
          if (prev === 'normals') return 'alpha';
          return 'composite';
        });
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedSeqId) {
          e.preventDefault();
          IRStateManager.getInstance().duplicateSequence(selectedSeqId);
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedSeqId && !editingCue) {
          e.preventDefault();
          IRStateManager.getInstance().deleteSequence(selectedSeqId);
        }
      }

      if (e.key === 'Escape') {
        if (editingCue) {
          setEditingCue(null);
        } else if (selectedSeqId) {
          IRStateManager.getInstance().setSelectedSequenceId(null);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedSeqId, editingCue, isSpacePressed, setEditingCue, setIsSpacePressed, setVisionPassMode]);
}

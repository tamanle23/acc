import React, { useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import type { StudioSequence } from '../../lib/ir/studioTypes';
import type { SequenceBounds } from '../../lib/hit-test/CanvasHitTester';
import type { TransformState } from './useGizmoTransform';

export interface InPlaceTextEditorProps {
  editingCue: {
    sequenceId: string;
    cueIndex: number;
    text: string;
  } | null;
  selectedSeq: StudioSequence | null;
  bounds: SequenceBounds;
  transform: TransformState;
  canvasWidth: number;
  canvasHeight: number;
  onUpdateText: (text: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

/**
 * InPlaceTextEditor:
 * Studio-grade, zero-backdrop on-canvas direct text editing overlay.
 * Replaces intrusive modal dialogs by projecting an auto-expanding transparent textarea
 * precisely aligned with the sequence's canvas bounding box and affine transform matrix.
 *
 * Interaction standards:
 * - Enter: Inserts a newline (multi-line text friendly).
 * - Cmd/Ctrl + Enter: Commits edits and exits editor.
 * - Escape: Commits edits and exits editor.
 * - Blur (clicking outside): Commits edits and exits editor.
 * - Event isolation: All keydowns and pointerdowns are stopped from bubbling to timeline/gizmo.
 */
export function InPlaceTextEditor({
  editingCue,
  selectedSeq,
  bounds,
  transform,
  canvasWidth,
  canvasHeight,
  onUpdateText,
  onCommit,
  onCancel,
}: InPlaceTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-focus and place cursor at end on mount
  useEffect(() => {
    if (!editingCue) return;
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editingCue?.sequenceId]);

  // Auto-resize height based on content
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(el.scrollHeight, 40)}px`;
    }
  }, [editingCue?.text]);

  if (!editingCue) return null;

  // Extract typography parameters from text/draw or text/overlay modifier
  const textMod = selectedSeq?.modifiers?.find(
    (m: any) => m.type === 'text/draw' || m.type === 'text/overlay'
  );
  const params = (textMod?.params as Record<string, any>) || {};

  // Reference scaling factor relative to 1080p canvas baseline
  const refScale = Math.min(canvasWidth / 1920, canvasHeight / 1080);
  const baseFontSize = typeof params.fontSize === 'number' ? params.fontSize : 48;
  const scaledFontSize = Math.max(12, Math.round(baseFontSize * refScale * transform.scale));

  const fontFamily = params.fontFamily || 'Inter, system-ui, -apple-system, sans-serif';
  const fontWeight = params.fontWeight || '700';
  const fontStyle = params.fontStyle || 'normal';
  const color = params.fill || params.color || '#ffffff';
  const textAlign = (params.textAlign || 'center') as 'left' | 'center' | 'right';
  const letterSpacing = params.letterSpacing ? `${params.letterSpacing * refScale}px` : 'normal';
  const lineHeight = params.lineHeight || 1.15;

  // Affine screen position calculation
  const curX = bounds.normX * canvasWidth + transform.x;
  const curY = bounds.normY * canvasHeight + transform.y;
  const percentX = (curX / canvasWidth) * 100;
  const percentY = (curY / canvasHeight) * 100;
  const boxWidthPx = Math.max(160, bounds.normWidth * canvasWidth * transform.scale);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();

    if (e.key === 'Escape') {
      e.preventDefault();
      onCommit();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onCommit();
    }
    // Plain Enter naturally adds a newline into the textarea
  };

  return (
    <div
      className="absolute pointer-events-auto z-40"
      style={{
        left: `${percentX}%`,
        top: `${percentY}%`,
        width: `${boxWidthPx}px`,
        transform: `translate(-50%, -50%) rotate(${transform.rotation}deg)`,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <textarea
        ref={textareaRef}
        value={editingCue.text}
        onChange={(e) => onUpdateText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onCommit}
        rows={1}
        spellCheck={false}
        className="w-full bg-black/40 backdrop-blur-xs text-white rounded-md p-1.5 resize-none overflow-hidden outline-none ring-1.5 ring-accent-theme/80 shadow-[0_0_20px_rgba(var(--accent-glow-rgb,0,255,255),0.35)] transition-shadow leading-tight"
        style={{
          fontFamily,
          fontSize: `${scaledFontSize}px`,
          fontWeight,
          fontStyle,
          color,
          textAlign,
          letterSpacing,
          lineHeight,
        }}
      />
      {/* Micro-hint pill */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full bg-slate-900/85 backdrop-blur-md border border-white/10 text-[9px] font-mono text-white/70 shadow-md pointer-events-none select-none flex items-center gap-1.5 animate-in fade-in duration-200">
        <span>Enter: ↵ newline</span>
        <span className="opacity-40">•</span>
        <span>Esc or Blur: commit</span>
      </div>
    </div>
  );
}

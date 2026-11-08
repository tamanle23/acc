import { onMount, createEffect, Show } from 'solid-js';
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

export function InPlaceTextEditor(props: InPlaceTextEditorProps) {
  let textareaRef!: HTMLTextAreaElement;

  onMount(() => {
    if (!props.editingCue) return;
    if (textareaRef) {
      textareaRef.focus();
      textareaRef.setSelectionRange(textareaRef.value.length, textareaRef.value.length);
    }
  });

  createEffect(() => {
    const text = props.editingCue?.text;
    if (textareaRef && text !== undefined) {
      textareaRef.style.height = 'auto';
      textareaRef.style.height = `${Math.max(textareaRef.scrollHeight, 40)}px`;
    }
  });

  return (
    <Show when={props.editingCue}>
      {(() => {
        const textMod = () =>
          props.selectedSeq?.modifiers?.find(
            (m: any) => m.type === 'text/draw' || m.type === 'text/overlay'
          );
        const params = () => ((textMod()?.params as Record<string, any>) || {});

        const refScale = () => Math.min(props.canvasWidth / 1920, props.canvasHeight / 1080);
        const baseFontSize = () =>
          typeof params().fontSize === 'number' ? params().fontSize : 48;
        const scaledFontSize = () =>
          Math.max(12, Math.round(baseFontSize() * refScale() * props.transform.scale));

        const fontFamily = () => params().fontFamily || 'Inter, system-ui, -apple-system, sans-serif';
        const fontWeight = () => params().fontWeight || '700';
        const fontStyle = () => params().fontStyle || 'normal';
        const color = () => params().fill || params().color || '#ffffff';
        const textAlign = () => ((params().textAlign || 'center') as 'left' | 'center' | 'right');
        const letterSpacing = () =>
          params().letterSpacing ? `${params().letterSpacing * refScale()}px` : 'normal';
        const lineHeight = () => params().lineHeight || 1.15;

        const curX = () => props.bounds.normX * props.canvasWidth + props.transform.x;
        const curY = () => props.bounds.normY * props.canvasHeight + props.transform.y;
        const percentX = () => (curX() / props.canvasWidth) * 100;
        const percentY = () => (curY() / props.canvasHeight) * 100;
        const boxWidthPx = () =>
          Math.max(160, props.bounds.normWidth * props.canvasWidth * props.transform.scale);

        const handleKeyDown = (e: KeyboardEvent) => {
          e.stopPropagation();

          if (e.key === 'Escape') {
            e.preventDefault();
            props.onCommit();
          } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            props.onCommit();
          }
        };

        return (
          <div
            class="absolute pointer-events-auto z-40"
            style={{
              left: `${percentX()}%`,
              top: `${percentY()}%`,
              width: `${boxWidthPx()}px`,
              transform: `translate(-50%, -50%) rotate(${props.transform.rotation}deg)`,
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <textarea
              ref={textareaRef}
              value={props.editingCue!.text}
              onInput={(e: any) => props.onUpdateText(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={props.onCommit}
              rows={1}
              spellcheck={false}
              class="w-full bg-black/40 backdrop-blur-xs text-white rounded-md p-1.5 resize-none overflow-hidden outline-none ring-1.5 ring-accent-theme/80 shadow-[0_0_20px_rgba(var(--accent-glow-rgb,0,255,255),0.35)] transition-shadow leading-tight"
              style={{
                "font-family": fontFamily(),
                "font-size": `${scaledFontSize()}px`,
                "font-weight": fontWeight(),
                "font-style": fontStyle(),
                color: color(),
                "text-align": textAlign(),
                "letter-spacing": letterSpacing(),
                "line-height": lineHeight(),
              }}
            />
            {/* Micro-hint pill */}
            <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full bg-slate-900/85 backdrop-blur-md border border-white/10 text-[9px] font-mono text-white/70 shadow-md pointer-events-none select-none flex items-center gap-1.5 animate-in fade-in duration-200">
              <span>Enter: ↵ newline</span>
              <span class="opacity-40">•</span>
              <span>Esc or Blur: commit</span>
            </div>
          </div>
        );
      })()}
    </Show>
  );
}

import { For, Show } from 'solid-js';
import { Type } from 'lucide-solid';
import type { TimedTextCue, ResolvedSequence } from '@acc/ir';

export interface SubtitlesOverlayProps {
  activeCues: TimedTextCue[];
  activeSequences: ResolvedSequence[];
  editingCue: { sequenceId: string; cueIndex: number; text: string } | null;
  onStartEditing: (cue: { sequenceId: string; cueIndex: number; text: string }) => void;
  onUpdateEditingText: (text: string) => void;
  onCommitEditing: (cue: { sequenceId: string; cueIndex: number; text: string }) => void;
  onCancelEditing: () => void;
}

export function SubtitlesOverlay(props: SubtitlesOverlayProps) {
  return (
    <>
      {/* Dynamic Subtitles & Captions Overlay (In-Canvas, Strictly Isolated from Studio Theme - Rule 235) */}
      <Show when={props.activeCues && props.activeCues.length > 0}>
        <div class="absolute bottom-6 left-6 right-6 flex flex-col items-center gap-1.5 pointer-events-auto z-20 select-none">
          <For each={props.activeCues}>
            {(cue) => {
              const isTarget = () => cue.text.startsWith('TARGET') || cue.text.includes('[');
              return (
                <span
                  onDblClick={(e) => {
                    e.stopPropagation();
                    const parentSeq = props.activeSequences.find(
                      (s) => s.cues && s.cues.some((c) => c.text === cue.text)
                    );
                    if (parentSeq) {
                      const cueIdx = parentSeq.cues?.findIndex((c) => c.text === cue.text) ?? 0;
                      props.onStartEditing({
                        sequenceId: parentSeq.id,
                        cueIndex: cueIdx,
                        text: cue.text,
                      });
                    }
                  }}
                  class={`px-4 py-1.5 rounded-lg text-center cursor-pointer transition-transform hover:scale-105 select-none font-bold tracking-wide ${
                    isTarget()
                      ? 'border border-rose-500/80 bg-rose-950/85 text-rose-200 font-mono text-xs tracking-wider shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                      : 'border border-white/15 bg-black/80 text-white text-base shadow-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]'
                  }`}
                  style={{
                    "text-shadow": isTarget()
                      ? '0 0 8px rgba(244,63,94,0.8)'
                      : '0 2px 4px rgba(0,0,0,0.95), 0 0 2px #000, 0 0 1px #000',
                  }}
                  title="Double click to edit text"
                >
                  {cue.text}
                </span>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Floating Inline Canvas Text Editor Modal */}
      <Show when={props.editingCue}>
        {(editingCue) => (
          <div class="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-md pointer-events-auto">
            <div class="glass-panel border-t-[var(--glass-border-highlight)] rounded-2xl p-5 shadow-2xl flex flex-col gap-3.5 max-w-md w-full mx-4 animate-in fade-in zoom-in-95 duration-150">
              <div class="flex items-center justify-between text-xs font-mono">
                <span class="flex items-center gap-1.5 font-bold text-[var(--accent-primary)]">
                  <Type class="w-4 h-4 text-[var(--accent-primary)]" />
                  Inline Canvas Text Editor
                </span>
                <span class="text-[10px] text-muted-foreground">[Enter to commit, Esc to cancel]</span>
              </div>
              <input
                type="text"
                autofocus
                value={editingCue().text}
                onInput={(e: any) => props.onUpdateEditingText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    props.onCommitEditing(editingCue());
                  } else if (e.key === 'Escape') {
                    props.onCancelEditing();
                  }
                }}
                onBlur={() => {
                  props.onCommitEditing(editingCue());
                }}
                class="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl px-3.5 py-2.5 text-foreground font-mono text-sm focus:outline-hidden focus:border-[var(--accent-primary)] focus:shadow-[0_0_15px_var(--accent-glow)] transition-all shadow-inner"
              />
            </div>
          </div>
        )}
      </Show>
    </>
  );
}

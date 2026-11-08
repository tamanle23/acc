import { Show, For, createMemo } from 'solid-js';
import { useDraggable } from '@dnd-kit/solid';
import {
  Link2,
  Unlink,
  Type,
  Music,
  Sparkles,
  Clock,
  Film,
  Image as ImageIcon,
} from 'lucide-solid';
import { TrimHandle } from './TrimHandle';
import { TransitionBlock } from './TransitionBlock';
import { AudioWaveform } from './AudioWaveform';
import { FilmstripThumbnail } from './FilmstripThumbnail';
import { ClipHoverHUD } from './ClipHoverHUD';
import { IRStateManager } from '../../lib/ir/irState';
import {
  getSequenceDurationFrames,
  getSequenceStartFrame,
  type StudioSequence,
  type StudioTrack,
} from '../../lib/ir/studioTypes';
import type { ModifierNode } from '@acc/ir';

export interface ClipItemProps {
  seq: StudioSequence;
  track: StudioTrack;
  pixelsPerFrame: number;
  isSelected: boolean;
  activeTool: 'select' | 'razor' | 'hand';
  fps?: number;
  getTrackBadgeStyle: (track: StudioTrack) => string;
  onClipClick: (seq: StudioSequence, e: MouseEvent) => void;
  onClipHover?: (clipData: { seq: StudioSequence; track: StudioTrack; position: { leftPx: number; topPx: number; widthPx: number } } | null) => void;
  /**
   * Scoped primitive drag props for 60 FPS memoization isolation.
   */
  isBeingDragged?: boolean;
  isPairedDrag?: boolean;
  dragType?: 'clip' | 'trim' | null;
  trimHandle?: 'start' | 'end';
  trimDeltaFrames?: number;
  isAnyDragActive?: boolean;
  /**
   * Optional legacy drag state object (preserved for backward compatibility).
   */
  activeDragState?: {
    type: 'clip' | 'trim';
    seqId: string;
    pairedSeqId?: string | null;
    handle?: 'start' | 'end';
    initialStartFrame: number;
    initialDurationFrames: number;
    deltaFrames: number;
    targetTrackId?: string;
  } | null;
}

export type TimelineClipItemProps = ClipItemProps;

export function ClipItem(props: ClipItemProps) {
  const isBeingDragged = () => props.isBeingDragged ?? (props.activeDragState?.seqId === props.seq.id);
  const isPairedDrag = () => props.isPairedDrag ?? (props.activeDragState?.pairedSeqId === props.seq.id);
  const effectiveDragType = () => props.dragType ?? (isBeingDragged() ? props.activeDragState?.type ?? null : null);
  const effectiveTrimHandle = () => props.trimHandle ?? props.activeDragState?.handle;
  const effectiveTrimDelta = () => props.trimDeltaFrames ?? (props.activeDragState?.deltaFrames ?? 0);
  const anyDragActive = () => props.isAnyDragActive ?? Boolean(props.activeDragState);

  const isAudio = () => props.seq.type === 'audio';
  const isTextOrOverlay = () =>
    props.track.type === 'timed_text' ||
    props.seq.type === 'text' ||
    Boolean(props.seq.cues && props.seq.cues.length > 0);
  const isFx = () => !props.seq.assetId;
  const isImageAsset = () => props.seq.type === 'image';

  const rawStart = () => getSequenceStartFrame(props.seq);
  const seqDurationFrames = () => getSequenceDurationFrames(props.seq, 30);

  const displayStartFrame = () => {
    if (isBeingDragged() && effectiveDragType() === 'trim') {
      if (effectiveTrimHandle() === 'start') {
        return Math.max(0, rawStart() + effectiveTrimDelta());
      }
    }
    return rawStart();
  };

  const displayDurationFrames = () => {
    if (isBeingDragged() && effectiveDragType() === 'trim') {
      if (effectiveTrimHandle() === 'start') {
        return Math.max(1, seqDurationFrames() - effectiveTrimDelta());
      } else {
        return Math.max(1, seqDurationFrames() + effectiveTrimDelta());
      }
    }
    return seqDurationFrames();
  };

  const leftPx = () => displayStartFrame() * props.pixelsPerFrame;
  const widthPx = () => Math.max(16, displayDurationFrames() * props.pixelsPerFrame);

  const draggable = useDraggable({
    get id() {
      return `clip-${props.seq.id}`;
    },
    get data() {
      return {
        type: 'clip',
        seq: props.seq,
        trackId: props.track.id,
      };
    },
    get disabled() {
      return props.activeTool === 'razor';
    },
  });

  const cueSnippet = () =>
    props.seq.cues && props.seq.cues.length > 0 && props.seq.cues[0]?.text
      ? String(props.seq.cues[0].text).trim()
      : null;

  const lod = () => (widthPx() < 36 ? 0 : widthPx() < 90 ? 1 : widthPx() < 220 ? 2 : 3);

  const durationSec = () => (displayDurationFrames() / 30).toFixed(1);
  const durationBadge = () => (displayDurationFrames() >= 30 ? `${durationSec()}s` : `${displayDurationFrames()}f`);

  const transMod = () => {
    if (!props.seq.modifiers) return null;
    const found = props.seq.modifiers.find(
      (m: ModifierNode) => m.type.startsWith('transition/') || m.type.startsWith('editorial/transition')
    );
    if (!found || (found.params as any)?.enabled === false) return null;
    return found;
  };

  const avLink = () => props.seq.modifiers?.find((m: ModifierNode) => m.type === 'editorial/av_link');
  const isLinked = () => (avLink() ? (avLink()!.params as any)?.enabled !== false : false);
  const linkedSeqId = () => (avLink()?.params as any)?.linkedSequenceId as string | undefined;

  return (
    <ClipHoverHUD seq={props.seq} track={props.track} fps={props.fps ?? 30} disabled={anyDragActive()}>
      <div
        ref={draggable.ref}
        onClick={(e: MouseEvent) => props.onClipClick(props.seq, e)}
        onMouseEnter={(e: MouseEvent) => {
          if (anyDragActive()) return;
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          props.onClipHover?.({
            seq: props.seq,
            track: props.track,
            position: {
              leftPx: leftPx(),
              topPx: rect.height + 12,
              widthPx: widthPx(),
            },
          });
        }}
        onMouseLeave={() => props.onClipHover?.(null)}
        style={{
          left: `${leftPx()}px`,
          width: `${widthPx()}px`,
          'touch-action': 'none',
        }}
        class={`absolute top-1 bottom-1 rounded-sm border px-1.5 flex items-center justify-between select-none group overflow-hidden ${
          isBeingDragged() ? 'transition-none' : 'transition-all'
        } ${
          isBeingDragged() && effectiveDragType() === 'clip'
            ? 'opacity-35 border-dashed border-accent-theme/70 bg-accent-theme/15 z-10'
            : isPairedDrag()
              ? 'ring-1 ring-dashed ring-accent-theme/70 opacity-70 z-10'
              : props.activeTool === 'razor'
                ? 'cursor-crosshair'
                : 'cursor-grab'
        } ${
          props.isSelected && !isBeingDragged()
            ? 'ring-2 ring-accent-theme shadow-md z-20 brightness-110'
            : 'hover:brightness-110 z-10'
        } ${props.getTrackBadgeStyle(props.track)}`}
      >
        <TrimHandle seq={props.seq} handle="start" />

        {/* Visual Transition Block Handle (Cut boundary) */}
        <Show when={transMod()}>
          {(mod) => (
            <TransitionBlock
              transitionModifier={mod()}
              sequenceId={props.seq.id}
              pixelsPerFrame={props.pixelsPerFrame}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                IRStateManager.getInstance().setSelectedSequenceId(props.seq.id);
                IRStateManager.getInstance().setInspectorMode('sequence');
              }}
            />
          )}
        </Show>

        <div class="flex-1 truncate px-0.5 flex items-center gap-1.5 relative overflow-hidden h-full pointer-events-none">
          {/* Background Visual Artifact (Waveform or Filmstrip) */}
          <Show
            when={isAudio()}
            fallback={
              <FilmstripThumbnail
                assetId={props.seq.assetId || props.seq.id}
                width={widthPx()}
                height={28}
              />
            }
          >
            <AudioWaveform
              id={props.seq.assetId || props.seq.id}
              durationFrames={seqDurationFrames()}
              width={widthPx()}
              height={28}
            />
          </Show>

          {/* Semantic Archetype Leading Icon: Always rendered across all LODs */}
          <span class="shrink-0 relative z-10 opacity-90">
            <Show
              when={isAudio()}
              fallback={
                <Show
                  when={isTextOrOverlay()}
                  fallback={
                    <Show
                      when={isFx()}
                      fallback={
                        <Show
                          when={isImageAsset()}
                          fallback={<Film class="w-3 h-3 text-indigo-400" />}
                        >
                          <ImageIcon class="w-3 h-3 text-blue-400" />
                        </Show>
                      }
                    >
                      <Sparkles class="w-3 h-3 text-amber-400" />
                    </Show>
                  }
                >
                  <Type class="w-3 h-3 text-violet-400" />
                </Show>
              }
            >
              <Music class="w-3 h-3 text-emerald-400" />
            </Show>
          </span>

          {/* LOD 1+: Compact & Above - Clip ID */}
          <Show when={lod() >= 1}>
            <span
              class={`font-mono font-semibold text-white relative z-10 drop-shadow-xs truncate ${
                lod() === 1 ? 'text-[9px] max-w-[50px]' : 'text-[10px]'
              }`}
            >
              {props.seq.id}
            </span>
          </Show>

          {/* LOD 2+: Standard & Expanded - Duration Badge & Linked A/V button */}
          <Show when={lod() >= 2}>
            <span class="shrink-0 text-[8px] font-mono text-white/80 bg-black/50 px-1 py-0.2 rounded relative z-10 border border-white/10 flex items-center gap-0.5">
              <Clock class="w-2 h-2 text-white/60" />
              {durationBadge()}
            </span>
          </Show>

          {/* LOD 3 Exclusively: Expanded View (>= 220px) - Dialogue Cue Snippet */}
          <Show when={lod() === 3 && cueSnippet()}>
            <span class="text-[9px] font-sans italic text-violet-200/90 truncate max-w-[140px] bg-violet-900/60 px-1.5 py-0.5 rounded border border-violet-400/30">
              "{cueSnippet()}"
            </span>
          </Show>

          {/* Linked A/V Button (Available on LOD 2 and LOD 3) */}
          <Show when={lod() >= 2 && avLink()}>
            <button
              type="button"
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                const link = avLink();
                if (!link) return;
                const newEnabled = !isLinked();
                // Update on this sequence
                IRStateManager.getInstance().updateModifier(props.seq.id, 'editorial/av_link', {
                  ...link.params,
                  enabled: newEnabled,
                });
                // Also update on partner sequence if present
                const partnerId = linkedSeqId();
                if (partnerId) {
                  IRStateManager.getInstance().updateModifier(partnerId, 'editorial/av_link', {
                    ...link.params,
                    linkedSequenceId: props.seq.id,
                    linkedTrackId: props.track.id,
                    enabled: newEnabled,
                  });
                }
              }}
              class={`p-0.5 rounded pointer-events-auto cursor-pointer relative z-10 transition-colors ${
                isLinked()
                  ? 'text-accent-theme bg-accent-theme/20 hover:bg-accent-theme/30 border border-accent-theme/50'
                  : 'text-muted-foreground bg-muted/40 hover:bg-muted/80 border border-border/40'
              }`}
              title={
                isLinked()
                  ? `Linked to ${linkedSeqId()} (Click to unlink)`
                  : 'Unlinked A/V (Click to re-link)'
              }
            >
              <Show when={isLinked()} fallback={<Unlink class="w-2.5 h-2.5" />}>
                <Link2 class="w-2.5 h-2.5" />
              </Show>
            </button>
          </Show>

          {/* LOD 2 Modifier Count Badge (compact) */}
          <Show when={lod() === 2 && props.seq.modifiers && props.seq.modifiers.length > 0}>
            <span class="shrink-0 text-[8px] font-mono bg-white/20 text-white font-medium px-1 py-0.5 rounded-xs relative z-10 backdrop-blur-xs">
              {props.seq.modifiers?.length} mod
            </span>
          </Show>

          {/* LOD 3: Individual Active Modifier Pills */}
          <Show when={lod() === 3 && props.seq.modifiers && props.seq.modifiers.length > 0}>
            <div class="flex items-center gap-1 shrink-0 relative z-10">
              <For each={props.seq.modifiers?.slice(0, 3)}>
                {(mod) => {
                  const modShortName = (mod.type || '').split('/').pop() || 'mod';
                  return (
                    <span class="text-[7.5px] font-mono uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded-xs">
                      {modShortName}
                    </span>
                  );
                }}
              </For>
            </div>
          </Show>
        </div>

        <TrimHandle seq={props.seq} handle="end" />
      </div>
    </ClipHoverHUD>
  );
}

// Backward-compatible alias
export const TimelineClipItem = ClipItem;

import { Show } from 'solid-js';
import {
  Film,
  Music,
  Type,
  Sparkles,
  Image as ImageIcon,
  Clock,
  Magnet,
} from 'lucide-solid';

import {
  getSequenceDurationFrames,
  type StudioSequence,
  type StudioTrack,
} from '../../lib/ir/studioTypes';

export interface ClipDragProxyProps {
  seq: StudioSequence;
  track?: StudioTrack | null;
  pixelsPerFrame: number;
  deltaFrames: number;
  snappedStartFrame: number;
  isInvalidDrop?: boolean;
  snapLabel?: string | null;
  getTrackBadgeStyle?: (track: StudioTrack) => string;
}

/**
 * ClipDragProxy:
 * High-performance, elevated proxy rendered exclusively within @dnd-kit's <DragOverlay>.
 * Visual Model:
 * - Fluidly translates with the pointer in top-level unclipped portal (z-index: 100).
 * - Displays precise SMPTE delta frame micro-pill HUD.
 * - Displays magnetic snap target badge when locked to abutment or playhead.
 * - Highlights red with forbidden state when hovering over incompatible track.
 */
export function ClipDragProxy(props: ClipDragProxyProps) {
  const durationFrames = () => getSequenceDurationFrames(props.seq, 30);
  const widthPx = () => Math.max(16, durationFrames() * props.pixelsPerFrame);
  const isAudio = () => props.seq.type === 'audio' || props.track?.type === 'audio';

  const durationSec = () => (durationFrames() / 30).toFixed(1);
  const durationBadge = () => (durationFrames() >= 30 ? `${durationSec()}s` : `${durationFrames()}f`);

  return (
    <div
      style={{
        width: `${widthPx()}px`,
        height: '32px',
        'will-change': 'transform',
      }}
      class={`rounded-sm border px-2 flex items-center justify-between select-none shadow-2xl scale-[1.02] backdrop-blur-md pointer-events-none ${
        props.isInvalidDrop
          ? 'bg-destructive/35 border-destructive text-destructive-foreground ring-2 ring-destructive cursor-not-allowed shadow-[0_0_20px_rgba(239,68,68,0.4)]'
          : 'bg-popover/90 border-accent-theme/80 text-foreground ring-2 ring-accent-theme/90 shadow-[0_10px_30px_rgba(0,0,0,0.5)]'
      }`}
    >
      {/* Left Icon & Clip ID */}
      <div class="flex items-center gap-1.5 min-w-0">
        <span class="shrink-0 opacity-90">
          <Show
            when={isAudio()}
            fallback={
              <Show
                when={props.seq.type === 'text' || props.seq.cues?.length}
                fallback={
                  <Show
                    when={!props.seq.assetId}
                    fallback={
                      <Show
                        when={props.seq.type === 'image'}
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
        <span class="font-mono text-[9.5px] font-semibold text-white drop-shadow-xs truncate max-w-[90px]">
          {props.seq.id}
        </span>
      </div>

      {/* Center / Right Delta HUD Pill */}
      <div class="flex items-center gap-1 shrink-0">
        <Show when={props.snapLabel}>
          <span class="flex items-center gap-0.5 text-[8px] font-mono px-1 py-0.2 rounded bg-amber-400 text-black font-bold uppercase shadow-xs">
            <Magnet class="w-2.5 h-2.5" />
            {props.snapLabel}
          </span>
        </Show>

        <span
          class={`text-[8.5px] font-mono px-1.5 py-0.2 rounded font-bold shadow-xs ${
            props.isInvalidDrop
              ? 'bg-destructive text-destructive-foreground'
              : 'bg-black/90 text-accent-theme border border-accent-theme/50'
          }`}
        >
          {props.deltaFrames >= 0 ? `+${props.deltaFrames}f` : `${props.deltaFrames}f`}
        </span>

        <span class="text-[8px] font-mono text-muted-foreground/80 flex items-center gap-0.5">
          <Clock class="w-2.5 h-2.5" />
          {durationBadge()}
        </span>
      </div>
    </div>
  );
}

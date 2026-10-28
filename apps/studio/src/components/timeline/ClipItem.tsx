import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  Link2,
  Unlink,
  Type,
  Music,
  Sparkles,
  Clock,
  Film,
  Image
} from 'lucide-react';
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
  onClipClick: (seq: StudioSequence, e: React.MouseEvent) => void;
  onClipHover?: (clipData: { seq: StudioSequence; track: StudioTrack; position: { leftPx: number; topPx: number; widthPx: number } } | null) => void;
  /**
   * Scoped primitive drag props for 60 FPS memoization isolation.
   * Stationary clips receive constant primitive booleans so they do not re-render
   * on every animation frame while another clip is being dragged.
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

function ClipItemInner({
  seq,
  track,
  pixelsPerFrame,
  isSelected,
  activeTool,
  fps = 30,
  getTrackBadgeStyle,
  onClipClick,
  onClipHover,
  isBeingDragged: propIsBeingDragged,
  isPairedDrag: propIsPairedDrag,
  dragType: propDragType,
  trimHandle: propTrimHandle,
  trimDeltaFrames: propTrimDeltaFrames,
  isAnyDragActive: propIsAnyDragActive,
  activeDragState,
}: ClipItemProps) {
  const isBeingDragged = propIsBeingDragged ?? (activeDragState?.seqId === seq.id);
  const isPairedDrag = propIsPairedDrag ?? (activeDragState?.pairedSeqId === seq.id);
  const effectiveDragType = propDragType ?? (isBeingDragged ? activeDragState?.type ?? null : null);
  const effectiveTrimHandle = propTrimHandle ?? activeDragState?.handle;
  const effectiveTrimDelta = propTrimDeltaFrames ?? (activeDragState?.deltaFrames ?? 0);
  const anyDragActive = propIsAnyDragActive ?? Boolean(activeDragState);

  const isAudio = seq.type === 'audio';
  const isTextOrOverlay =
    track.type === 'overlay' ||
    track.type === 'timed_text' ||
    seq.type === 'text' ||
    (seq.cues && seq.cues.length > 0);
  const isFx = !seq.assetId;
  const isImageAsset = seq.type === 'image';

  const rawStart = getSequenceStartFrame(seq);
  const seqDurationFrames = getSequenceDurationFrames(seq, 30);
  let displayStartFrame = rawStart;
  let displayDurationFrames = seqDurationFrames;

  // Trim handle interaction directly modifies display frames during trim
  if (isBeingDragged && effectiveDragType === 'trim') {
    if (effectiveTrimHandle === 'start') {
      displayStartFrame = Math.max(0, rawStart + effectiveTrimDelta);
      displayDurationFrames = Math.max(1, seqDurationFrames - effectiveTrimDelta);
    } else {
      displayDurationFrames = Math.max(1, seqDurationFrames + effectiveTrimDelta);
    }
  }

  const leftPx = displayStartFrame * pixelsPerFrame;
  const widthPx = Math.max(16, displayDurationFrames * pixelsPerFrame);

  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `clip-${seq.id}`,
    data: {
      type: 'clip',
      seq,
      trackId: track.id,
    },
    disabled: activeTool === 'razor',
  });

  // Extract first cue text snippet if present
  const cueSnippet =
    seq.cues && seq.cues.length > 0 && seq.cues[0]?.text
      ? String(seq.cues[0].text).trim()
      : null;

  // Derive LOD Mode based on rendered pixel width
  // LOD 0 (< 36px): Micro icon only
  // LOD 1 (36px - 90px): Compact (Icon + Truncated ID)
  // LOD 2 (90px - 220px): Standard (Icon + ID + Duration + Waveform/Filmstrip)
  // LOD 3 (> 220px): Expanded (Icon + ID + Cue Text / Asset + Full SMPTE + Modifier Badges)
  const lod = widthPx < 36 ? 0 : widthPx < 90 ? 1 : widthPx < 220 ? 2 : 3;

  // Format Duration string
  const durationSec = (displayDurationFrames / 30).toFixed(1);
  const durationBadge = displayDurationFrames >= 30 ? `${durationSec}s` : `${displayDurationFrames}f`;

  return (
    <ClipHoverHUD seq={seq} track={track} fps={fps} disabled={anyDragActive}>
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={(e) => onClipClick(seq, e)}
        onMouseEnter={(e) => {
          if (anyDragActive) return;
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          onClipHover?.({
            seq,
            track,
            position: {
              leftPx: leftPx,
              topPx: rect.height + 12,
              widthPx,
            },
          });
        }}
        onMouseLeave={() => onClipHover?.(null)}
        style={{
          left: `${leftPx}px`,
          width: `${widthPx}px`,
        }}
        className={`absolute top-1 bottom-1 rounded-sm border px-1.5 flex items-center justify-between select-none group overflow-hidden ${
          isBeingDragged
            ? 'transition-none'
            : 'transition-all'
        } ${
          isBeingDragged && effectiveDragType === 'clip'
            ? 'opacity-35 border-dashed border-accent-theme/70 bg-accent-theme/15 z-10'
            : isPairedDrag
              ? 'ring-1 ring-dashed ring-accent-theme/70 opacity-70 z-10'
              : activeTool === 'razor'
                ? 'cursor-crosshair'
                : 'cursor-grab'
        } ${isSelected && !isBeingDragged
            ? 'ring-2 ring-accent-theme shadow-md z-20 brightness-110'
            : 'hover:brightness-110 z-10'
        } ${getTrackBadgeStyle(track)}`}
      >
        <TrimHandle seq={seq} handle="start" />

      {/* Visual Transition Block Handle (Cut boundary) */}
      {seq.modifiers &&
        (() => {
          const transMod = seq.modifiers.find(
            (m: ModifierNode) =>
              m.type.startsWith('transition/') || m.type.startsWith('editorial/transition')
          );
          if (!transMod || transMod.params?.enabled === false) return null;
          return (
            <TransitionBlock
              transitionModifier={transMod}
              sequenceId={seq.id}
              pixelsPerFrame={pixelsPerFrame}
              onClick={(e) => {
                e.stopPropagation();
                IRStateManager.getInstance().setSelectedSequenceId(seq.id);
                IRStateManager.getInstance().setInspectorMode('sequence');
              }}
            />
          );
        })()}

      <div className="flex-1 truncate px-0.5 flex items-center gap-1.5 relative overflow-hidden h-full pointer-events-none">
        {/* Background Visual Artifact (Waveform or Filmstrip) */}
        {isAudio ? (
          <AudioWaveform
            id={seq.assetId || seq.id}
            durationFrames={seqDurationFrames}
            width={widthPx}
            height={28}
          />
        ) : (
          <FilmstripThumbnail
            assetId={seq.assetId || seq.id}
            width={widthPx}
            height={28}
          />
        )}

        {/* Semantic Archetype Leading Icon: Always rendered across all LODs */}
        <span className="shrink-0 relative z-10 opacity-90">
          {isAudio ? (
            <Music className="w-3 h-3 text-emerald-400" />
          ) : isTextOrOverlay ? (
            <Type className="w-3 h-3 text-violet-400" />
          ) : isFx ? (
            <Sparkles className="w-3 h-3 text-amber-400" />
          ) : isImageAsset ? (
            <Image className="w-3 h-3 text-blue-400" />
          ) : (
            <Film className="w-3 h-3 text-indigo-400" />
          )}
        </span>

        {/* LOD 1+: Compact & Above - Clip ID (truncated for compact, full for standard/expanded) */}
        {lod >= 1 && (
          <span
            className={`font-mono font-semibold text-white relative z-10 drop-shadow-xs truncate ${
              lod === 1 ? 'text-[9px] max-w-[50px]' : 'text-[10px]'
            }`}
          >
            {seq.id}
          </span>
        )}

        {/* LOD 2+: Standard & Expanded - Duration Badge & Linked A/V button */}
        {lod >= 2 && (
          <span className="shrink-0 text-[8px] font-mono text-white/80 bg-black/50 px-1 py-0.2 rounded relative z-10 border border-white/10 flex items-center gap-0.5">
            <Clock className="w-2 h-2 text-white/60" />
            {durationBadge}
          </span>
        )}

        {/* LOD 3 Exclusively: Expanded View (>= 220px) - Dialogue Cue Snippet, Modifiers Pills, and AV Link */}
        {lod === 3 && cueSnippet && (
          <span className="text-[9px] font-sans italic text-violet-200/90 truncate max-w-[140px] bg-violet-900/60 px-1.5 py-0.5 rounded border border-violet-400/30">
            "{cueSnippet}"
          </span>
        )}

        {/* Linked A/V Button (Available on LOD 2 and LOD 3) */}
        {lod >= 2 &&
          (() => {
            const avLink = seq.modifiers?.find((m: ModifierNode) => m.type === 'editorial/av_link');
            if (!avLink) return null;
            const isLinked = avLink.params?.enabled !== false;
            const linkedSeqId = avLink.params?.linkedSequenceId as string | undefined;
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const newEnabled = !isLinked;
                  // Update on this sequence
                  IRStateManager.getInstance().updateModifier(seq.id, 'editorial/av_link', {
                    ...avLink.params,
                    enabled: newEnabled,
                  });
                  // Also update on partner sequence if present
                  if (linkedSeqId) {
                    IRStateManager.getInstance().updateModifier(
                      linkedSeqId,
                      'editorial/av_link',
                      {
                        ...avLink.params,
                        linkedSequenceId: seq.id,
                        linkedTrackId: track.id,
                        enabled: newEnabled,
                      }
                    );
                  }
                }}
                className={`p-0.5 rounded pointer-events-auto cursor-pointer relative z-10 transition-colors ${
                  isLinked
                    ? 'text-accent-theme bg-accent-theme/20 hover:bg-accent-theme/30 border border-accent-theme/50'
                    : 'text-muted-foreground bg-muted/40 hover:bg-muted/80 border border-border/40'
                }`}
                title={
                  isLinked
                    ? `Linked to ${linkedSeqId} (Click to unlink)`
                    : 'Unlinked A/V (Click to re-link)'
                }
              >
                {isLinked ? <Link2 className="w-2.5 h-2.5" /> : <Unlink className="w-2.5 h-2.5" />}
              </button>
            );
          })()}

        {/* LOD 2 Modifier Count Badge (compact) vs LOD 3 Individual Modifier Chips */}
        {lod === 2 && seq.modifiers && seq.modifiers.length > 0 && (
          <span className="shrink-0 text-[8px] font-mono bg-white/20 text-white font-medium px-1 py-0.5 rounded-xs relative z-10 backdrop-blur-xs">
            {seq.modifiers.length} mod
          </span>
        )}

        {/* LOD 3: Individual Active Modifier Pills */}
        {lod === 3 && seq.modifiers && seq.modifiers.length > 0 && (
          <div className="flex items-center gap-1 shrink-0 relative z-10">
            {seq.modifiers.slice(0, 3).map((mod: ModifierNode, mIdx: number) => {
              const modShortName = (mod.type || '').split('/').pop() || 'mod';
              return (
                <span
                  key={mIdx}
                  className="text-[7.5px] font-mono uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded-xs"
                >
                  {modShortName}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <TrimHandle seq={seq} handle="end" />
    </div>
  </ClipHoverHUD>
  );
}

/**
 * Memoized ClipItem component.
 * Prevents stationary clips across all timeline tracks from re-rendering at 60Hz
 * when another clip is being dragged or trimmed.
 */
export const ClipItem = React.memo(ClipItemInner);

// Backward-compatible alias
export const TimelineClipItem = ClipItem;

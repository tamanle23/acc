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

export interface ClipItemProps {
  seq: any;
  track: any;
  pixelsPerFrame: number;
  isSelected: boolean;
  activeTool: 'select' | 'razor' | 'hand';
  fps?: number;
  getTrackBadgeStyle: (track: any) => string;
  onClipClick: (seq: any, e: React.MouseEvent) => void;
  onClipHover?: (clipData: { seq: any; track: any; position: { leftPx: number; topPx: number; widthPx: number } } | null) => void;
  activeDragState: {
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

export function ClipItem({
  seq,
  track,
  pixelsPerFrame,
  isSelected,
  activeTool,
  fps = 30,
  getTrackBadgeStyle,
  onClipClick,
  onClipHover,
  activeDragState,
}: ClipItemProps) {
  const isBeingDragged = activeDragState?.seqId === seq.id;
  const isPairedDrag = activeDragState?.pairedSeqId === seq.id;
  const isAudio = seq.type === 'audio';
  const isTextOrOverlay =
    track.type === 'overlay' ||
    track.type === 'timed_text' ||
    seq.type === 'text' ||
    (seq.cues && seq.cues.length > 0);
  const isFx = !seq.assetId;
  const isVideoAsset = seq.type === 'video';
  const isImageAsset = seq.type === 'image';

  const rawStart = (seq as any).startFrame ?? (seq as any).timelineStartFrame ?? 0;
  let displayStartFrame = rawStart;
  let displayDurationFrames = seq.durationFrames;

  // Trim handle interaction directly modifies display frames during trim
  if (isBeingDragged && activeDragState && activeDragState.type === 'trim') {
    if (activeDragState.handle === 'start') {
      displayStartFrame = Math.max(0, rawStart + activeDragState.deltaFrames);
      displayDurationFrames = Math.max(1, seq.durationFrames - activeDragState.deltaFrames);
    } else {
      displayDurationFrames = Math.max(1, seq.durationFrames + activeDragState.deltaFrames);
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
    <ClipHoverHUD seq={seq} track={track} fps={fps} disabled={Boolean(activeDragState)}>
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={(e) => onClipClick(seq, e)}
        onMouseEnter={(e) => {
          if (activeDragState) return;
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
        className={`absolute top-1 bottom-1 rounded-sm border px-1.5 flex items-center justify-between select-none group transition-all overflow-hidden ${
          isBeingDragged && activeDragState?.type === 'clip'
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
            (m: any) =>
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
            durationFrames={seq.durationFrames}
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
            const avLink = seq.modifiers?.find((m: any) => m.type === 'editorial/av_link');
            if (!avLink) return null;
            const isLinked = avLink.params?.enabled !== false;
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
                  if (avLink.params?.linkedSequenceId) {
                    IRStateManager.getInstance().updateModifier(
                      avLink.params.linkedSequenceId,
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
                    ? `Linked to ${avLink.params?.linkedSequenceId} (Click to unlink)`
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
            {seq.modifiers.slice(0, 3).map((mod: any, mIdx: number) => {
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

// Backward-compatible alias
export const TimelineClipItem = ClipItem;


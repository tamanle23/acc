import React from 'react';
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '../ui/button';
import { IRStateManager } from '../../lib/ir/irState';
import type { StudioTrack } from '../../lib/ir/studioTypes';

export interface TrackHeaderCardProps {
  track: StudioTrack;
  isLocked: boolean;
  isMuted: boolean;
  isVisible?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggleLock: (trackId: string) => void;
  onToggleMute: (trackId: string) => void;
  onToggleVisible?: (trackId: string) => void;
}

export function TrackHeaderCard({
  track,
  isLocked,
  isMuted,
  isVisible = true,
  canMoveUp,
  canMoveDown,
  onToggleLock,
  onToggleMute,
  onToggleVisible,
}: TrackHeaderCardProps) {
  const isAudioTrack = track.type === 'audio';
  const isTextOrOverlay = track.type === 'timed_text' || track.type === 'overlay';
  const isVideoTrack = track.type === 'video';

  const showVisibilityControl = isVideoTrack || isTextOrOverlay;
  const showMuteControl = isVideoTrack || isAudioTrack;

  return (
    <div
      onClick={() => {
        IRStateManager.getInstance().setSelectedTrackId(track.id);
        IRStateManager.getInstance().setInspectorMode('track');
      }}
      className="sticky left-0 z-20 w-52 h-full bg-[var(--glass-bg)] rounded-md border border-[var(--glass-border)] hover:bg-muted/60 cursor-pointer transition-colors flex items-center justify-between px-2.5 shrink-0 shadow-2xs backdrop-blur-md"
      title={`Inspect Track ${track.type} - ${track.id}`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 cursor-grab" />
        <span className="text-[11px] font-medium text-foreground truncate max-w-[85px]">
          {track.type} - {track.id}
        </span>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        {/* Track Reorder Up/Down */}
        <Button
          variant="ghost"
          size="icon"
          disabled={!canMoveUp}
          onClick={(e) => {
            e.stopPropagation();
            IRStateManager.getInstance().reorderTrack(track.id, 'up');
          }}
          className="h-5 w-5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
          title="Move Track Up"
        >
          <ChevronUp className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={!canMoveDown}
          onClick={(e) => {
            e.stopPropagation();
            IRStateManager.getInstance().reorderTrack(track.id, 'down');
          }}
          className="h-5 w-5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
          title="Move Track Down"
        >
          <ChevronDown className="w-3 h-3" />
        </Button>

        {/* Lock Control */}
        <Button
          variant="ghost"
          size="icon"
          aria-pressed={isLocked}
          aria-label={isLocked ? 'Unlock Track' : 'Lock Track'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock(track.id);
          }}
          className={`h-5 w-5 rounded transition-colors ${
            isLocked
              ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25 font-bold shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title={isLocked ? 'Unlock Track' : 'Lock Track'}
        >
          {isLocked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
        </Button>

        {/* Visibility (Eye) Control for Video and Overlay/Text Tracks */}
        {showVisibilityControl && (
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={!isVisible}
            aria-label={isVisible ? 'Hide Track Visuals' : 'Show Track Visuals'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisible?.(track.id);
            }}
            className={`h-5 w-5 rounded transition-colors ${
              !isVisible
                ? 'text-muted-foreground/40 bg-muted/20 font-bold'
                : 'text-sky-400 hover:bg-sky-500/15'
            }`}
            title={isVisible ? 'Hide Track Visuals' : 'Show Track Visuals'}
          >
            {isVisible ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
          </Button>
        )}

        {/* Mute (Speaker) Control for Audio and Video Tracks */}
        {showMuteControl && (
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={isMuted}
            aria-label={isMuted ? 'Unmute Track Audio' : 'Mute Track Audio'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute(track.id);
            }}
            className={`h-5 w-5 rounded transition-colors ${
              isMuted
                ? 'text-rose-400 bg-rose-500/15 hover:bg-rose-500/25 font-bold shadow-xs'
                : 'text-emerald-400 hover:bg-emerald-500/15'
            }`}
            title={isMuted ? 'Unmute Track Audio' : 'Mute Track Audio'}
          >
            {isMuted ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
          </Button>
        )}
      </div>
    </div>
  );
}

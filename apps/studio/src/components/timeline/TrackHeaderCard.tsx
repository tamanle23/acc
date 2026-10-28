import React from 'react';
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '../ui/button';
import { IRStateManager } from '../../lib/ir/irState';
import type { StudioTrack } from '../../lib/ir/studioTypes';

export interface TrackHeaderCardProps {
  track: StudioTrack;
  isLocked: boolean;
  isMuted: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggleLock: (trackId: string) => void;
  onToggleMute: (trackId: string) => void;
}

export function TrackHeaderCard({
  track,
  isLocked,
  isMuted,
  canMoveUp,
  canMoveDown,
  onToggleLock,
  onToggleMute,
}: TrackHeaderCardProps) {
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

        <Button
          variant="ghost"
          size="icon"
          aria-pressed={isMuted}
          aria-label={isMuted ? 'Unmute Track' : 'Mute Track'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute(track.id);
          }}
          className={`h-5 w-5 rounded transition-colors ${
            isMuted
              ? 'text-rose-400 bg-rose-500/15 hover:bg-rose-500/25 font-bold shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title={isMuted ? 'Unmute Track' : 'Mute Track'}
        >
          {isMuted ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
        </Button>
      </div>
    </div>
  );
}

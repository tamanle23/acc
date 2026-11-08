import { Show } from 'solid-js';
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
} from 'lucide-solid';
import { Button } from '../ui/button';
import { IRStateManager } from '../../lib/ir/irState';
import type { StudioTrack } from '../../lib/ir/studioTypes';
import type { TrackQuotaStatus } from '@acc/ir';

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
  quotaStatus?: TrackQuotaStatus;
}

export function TrackHeaderCard(props: TrackHeaderCardProps) {
  const isAudioTrack = () => props.track.type === 'audio';
  const isTextOrOverlay = () => props.track.type === 'timed_text' || props.track.type === 'overlay';
  const isVideoTrack = () => props.track.type === 'video';

  const showVisibilityControl = () => isVideoTrack() || isTextOrOverlay();
  const showMuteControl = () => isVideoTrack() || isAudioTrack();
  const isVisible = () => props.isVisible ?? true;

  return (
    <div
      onClick={() => {
        IRStateManager.getInstance().setSelectedTrackId(props.track.id);
        IRStateManager.getInstance().setInspectorMode('track');
      }}
      class="sticky left-0 z-20 w-52 h-full bg-[var(--glass-bg)] rounded-md border border-[var(--glass-border)] hover:bg-muted/60 cursor-pointer transition-colors flex items-center justify-between px-2.5 shrink-0 shadow-2xs backdrop-blur-md"
      title={`Inspect Track ${props.track.type} - ${props.track.id}`}
    >
      <div class="flex items-center gap-1.5 min-w-0">
        <GripVertical class="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 cursor-grab" />
        <span class="text-[11px] font-medium text-foreground truncate max-w-[80px]">
          {props.track.name || `${props.track.type} - ${props.track.id}`}
        </span>
        <Show when={props.quotaStatus?.isSoftCapExceeded}>
          <span
            class={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-medium border shrink-0 ${
              props.quotaStatus?.isHardCapReached
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
            }`}
            title={props.quotaStatus?.message || `Track cap: ${props.quotaStatus?.currentCount}/${props.quotaStatus?.softCap}`}
          >
            {props.quotaStatus?.currentCount}/{props.quotaStatus?.softCap}
          </span>
        </Show>
      </div>

      <div class="flex items-center gap-0.5 shrink-0">
        {/* Track Reorder Up/Down */}
        <Button
          variant="ghost"
          size="icon"
          disabled={!props.canMoveUp}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            IRStateManager.getInstance().reorderTrack(props.track.id, 'up');
          }}
          class="h-5 w-5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
          title="Move Track Up"
        >
          <ChevronUp class="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={!props.canMoveDown}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            IRStateManager.getInstance().reorderTrack(props.track.id, 'down');
          }}
          class="h-5 w-5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
          title="Move Track Down"
        >
          <ChevronDown class="w-3 h-3" />
        </Button>

        {/* Lock Control */}
        <Button
          variant="ghost"
          size="icon"
          aria-pressed={props.isLocked}
          aria-label={props.isLocked ? 'Unlock Track' : 'Lock Track'}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            props.onToggleLock(props.track.id);
          }}
          class={`h-5 w-5 rounded transition-colors ${
            props.isLocked
              ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25 font-bold shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title={props.isLocked ? 'Unlock Track' : 'Lock Track'}
        >
          <Show when={props.isLocked} fallback={<Unlock class="w-2.5 h-2.5" />}>
            <Lock class="w-2.5 h-2.5" />
          </Show>
        </Button>

        {/* Visibility (Eye) Control for Video and Overlay/Text Tracks */}
        <Show when={showVisibilityControl()}>
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={!isVisible()}
            aria-label={isVisible() ? 'Hide Track Visuals' : 'Show Track Visuals'}
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              props.onToggleVisible?.(props.track.id);
            }}
            class={`h-5 w-5 rounded transition-colors ${
              !isVisible()
                ? 'text-muted-foreground/40 bg-muted/20 font-bold'
                : 'text-sky-400 hover:bg-sky-500/15'
            }`}
            title={isVisible() ? 'Hide Track Visuals' : 'Show Track Visuals'}
          >
            <Show when={isVisible()} fallback={<EyeOff class="w-2.5 h-2.5" />}>
              <Eye class="w-2.5 h-2.5" />
            </Show>
          </Button>
        </Show>

        {/* Mute (Speaker) Control for Audio and Video Tracks */}
        <Show when={showMuteControl()}>
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={props.isMuted}
            aria-label={props.isMuted ? 'Unmute Track' : 'Mute Track'}
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              props.onToggleMute(props.track.id);
            }}
            class={`h-5 w-5 rounded transition-colors ${
              props.isMuted
                ? 'text-rose-400 bg-rose-500/15 hover:bg-rose-500/25 font-bold shadow-xs'
                : 'text-emerald-400 hover:bg-emerald-500/15'
            }`}
            title={props.isMuted ? 'Unmute Track' : 'Mute Track'}
          >
            <Show when={props.isMuted} fallback={<Volume2 class="w-2.5 h-2.5" />}>
              <VolumeX class="w-2.5 h-2.5" />
            </Show>
          </Button>
        </Show>
      </div>
    </div>
  );
}

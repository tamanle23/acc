import { createSignal, Show } from 'solid-js';
import {
  Copy,
  AlignCenter,
  Lock,
  Unlock,
  RotateCcw,
  Trash2,
  Box,
  Layers,
  Sparkles,
  Scissors,
  Crop,
} from 'lucide-solid';
import { Tooltip } from '../ui/tooltip';
import { IRStateManager } from '../../lib/ir/irState';

export interface ContextualActionPillProps {
  selectedSeqId: string;
  isLocked: boolean;
  onDuplicate: (seqId: string) => void;
  onCenter: () => void;
  onToggleLock: () => void;
  onResetTransform: () => void;
  onDelete: (seqId: string) => void;
}

export function ContextualActionPill(props: ContextualActionPillProps) {
  const [showDepthMenu, setShowDepthMenu] = createSignal(false);

  const handleApplyDepthMode = (mode: string) => {
    setShowDepthMenu(false);
    if (!props.selectedSeqId) return;

    const irState = IRStateManager.getInstance().getState();
    const seq = irState.doc.tracks
      .flatMap((t) => t.sequences)
      .find((s) => s.id === props.selectedSeqId);

    const existingMod = seq?.modifiers?.find((m) => m.type === 'vfx/depth3d');

    if (existingMod) {
      IRStateManager.getInstance().updateModifier(props.selectedSeqId, 'vfx/depth3d', {
        ...existingMod.params,
        enabled: true,
        mode,
      });
    } else {
      IRStateManager.getInstance().addModifier(props.selectedSeqId, {
        type: 'vfx/depth3d',
        params: {
          enabled: true,
          mode,
          popOutIntensity: 1.25,
          autoDepth: true,
          autoSegment: true,
        },
      });
    }
  };

  const handleApplyAutoReframe = () => {
    setShowDepthMenu(false);
    if (!props.selectedSeqId) return;

    const irState = IRStateManager.getInstance().getState();
    const seq = irState.doc.tracks
      .flatMap((t) => t.sequences)
      .find((s) => s.id === props.selectedSeqId);

    const existingMod = seq?.modifiers?.find((m) => m.type === 'vfx/auto_reframe');

    if (existingMod) {
      IRStateManager.getInstance().updateModifier(props.selectedSeqId, 'vfx/auto_reframe', {
        ...existingMod.params,
        enabled: !existingMod.params?.enabled,
      });
    } else {
      IRStateManager.getInstance().addModifier(props.selectedSeqId, {
        type: 'vfx/auto_reframe',
        params: {
          enabled: true,
          targetAspectRatio: '9:16',
          smoothingFactor: 0.85,
          visualGuide: true,
        },
      });
    }
  };

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      class="relative absolute -top-12 left-1/2 -translate-x-1/2 glass-panel shadow-xl border border-glass-border-highlight px-2 py-1 rounded-full flex items-center gap-1.5 z-30 select-none pointer-events-auto backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
    >
      {/* 3D Depth & Vision Popover Trigger */}
      <Tooltip content="3D Depth & Vision Tools">
        <button
          type="button"
          onClick={() => setShowDepthMenu((prev) => !prev)}
          class={`p-1 rounded-full active:scale-90 transition-all cursor-pointer ${
            showDepthMenu()
              ? 'text-accent-theme bg-accent-theme/20 shadow-accent-glow'
              : 'text-accent-theme hover:bg-accent-theme/15'
          }`}
        >
          <Box class="w-3.5 h-3.5" />
        </button>
      </Tooltip>

      {/* Floating Depth Mode Popover Menu */}
      <Show when={showDepthMenu()}>
        <div class="absolute top-9 left-1/2 -translate-x-1/2 glass-panel border border-glass-border shadow-2xl rounded-xl p-1.5 min-w-[210px] space-y-1 z-40 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
          <button
            type="button"
            onClick={() => handleApplyDepthMode('parallax_25d')}
            class="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-foreground/10 text-foreground flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Layers class="w-3.5 h-3.5 text-accent-theme" />
            <div>
              <div class="font-medium text-[11px]">2.5D Parallax Plane</div>
              <div class="text-[9px] text-muted-foreground">Volumetric spatial depth motion</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleApplyDepthMode('frame_breaker')}
            class="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-foreground/10 text-foreground flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Sparkles class="w-3.5 h-3.5 text-amber-400" />
            <div>
              <div class="font-medium text-[11px]">Frame Breaker Pop-Out</div>
              <div class="text-[9px] text-muted-foreground">Subject exceeds frame boundary</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleApplyDepthMode('silhouette_rim_light')}
            class="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-foreground/10 text-foreground flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Scissors class="w-3.5 h-3.5 text-emerald-400" />
            <div>
              <div class="font-medium text-[11px]">Subject Rim Light Cutout</div>
              <div class="text-[9px] text-muted-foreground">Isolate subject with rim glow</div>
            </div>
          </button>

          <div class="w-full h-px bg-glass-border my-1" />

          <button
            type="button"
            onClick={handleApplyAutoReframe}
            class="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-foreground/10 text-foreground flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Crop class="w-3.5 h-3.5 text-indigo-400" />
            <div>
              <div class="font-medium text-[11px]">Smart Auto-Reframe (9:16)</div>
              <div class="text-[9px] text-muted-foreground">Dynamic vertical subject tracking</div>
            </div>
          </button>
        </div>
      </Show>

      <div class="w-px h-3.5 bg-glass-border mx-0.5" />

      {/* Duplicate */}
      <Tooltip content="Duplicate Sequence (Ctrl+D)">
        <button
          type="button"
          onClick={() => props.onDuplicate(props.selectedSeqId)}
          class="p-1 hover:bg-foreground/10 rounded-full text-foreground/80 hover:text-foreground active:scale-90 transition-all cursor-pointer"
        >
          <Copy class="w-3.5 h-3.5" />
        </button>
      </Tooltip>

      {/* Center Alignment */}
      <Tooltip content="Center in Canvas">
        <button
          type="button"
          onClick={props.onCenter}
          class="p-1 hover:bg-foreground/10 rounded-full text-foreground/80 hover:text-foreground active:scale-90 transition-all cursor-pointer"
        >
          <AlignCenter class="w-3.5 h-3.5" />
        </button>
      </Tooltip>

      {/* Lock / Unlock */}
      <Tooltip content={props.isLocked ? 'Unlock Transform' : 'Lock Transform'}>
        <button
          type="button"
          onClick={props.onToggleLock}
          class={`p-1 rounded-full active:scale-90 transition-all cursor-pointer ${
            props.isLocked
              ? 'text-amber-400 bg-amber-500/15'
              : 'text-foreground/80 hover:text-foreground hover:bg-foreground/10'
          }`}
        >
          <Show when={props.isLocked} fallback={<Unlock class="w-3.5 h-3.5" />}>
            <Lock class="w-3.5 h-3.5 text-amber-400" />
          </Show>
        </button>
      </Tooltip>

      {/* Reset Transform */}
      <Tooltip content="Reset Transform">
        <button
          type="button"
          onClick={props.onResetTransform}
          class="p-1 hover:bg-foreground/10 rounded-full text-foreground/80 hover:text-foreground active:scale-90 transition-all cursor-pointer"
        >
          <RotateCcw class="w-3.5 h-3.5" />
        </button>
      </Tooltip>

      <div class="w-px h-3.5 bg-glass-border mx-0.5" />

      {/* Delete */}
      <Tooltip content="Delete Sequence (Del)">
        <button
          type="button"
          onClick={() => props.onDelete(props.selectedSeqId)}
          class="p-1 hover:bg-destructive/20 rounded-full text-destructive active:scale-90 transition-all cursor-pointer"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </Tooltip>
    </div>
  );
}

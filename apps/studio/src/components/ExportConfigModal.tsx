import { createSignal, createMemo, For, Show } from 'solid-js';
import { Download, Film, Check, ShieldCheck } from 'lucide-solid';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  getExportPresetsForAspectRatio,
  inferAspectRatioFromCanvasSize,
  type VideoExportPreset,
  type StandardAspectRatio,
} from '@acc/ir';

export interface ExportConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  width: number;
  height: number;
  aspectRatio?: StandardAspectRatio;
  fps: number;
  totalFrames: number;
  onConfirmExport: (config: {
    preset: VideoExportPreset;
    width: number;
    height: number;
    videoBitrate: number;
  }) => void;
}

export function ExportConfigModal(props: ExportConfigModalProps) {
  const activeRatio = () =>
    props.aspectRatio || inferAspectRatioFromCanvasSize(props.width, props.height);
  const matchingPresets = createMemo(() => getExportPresetsForAspectRatio(activeRatio()));

  const [selectedPresetId, setSelectedPresetId] = createSignal<string>('');

  const selectedPreset = createMemo(() => {
    const presets = matchingPresets();
    const currentId = selectedPresetId();
    if (currentId) {
      const found = presets.find((p) => p.id === currentId);
      if (found) return found;
    }
    const default1080p = presets.find((p) => p.height === 1080 || p.width === 1080);
    return default1080p || presets[0];
  });

  const handleStart = () => {
    const preset = selectedPreset();
    if (!preset) return;
    props.onConfirmExport({
      preset,
      width: preset.width,
      height: preset.height,
      videoBitrate: preset.recommendedBitrateBps,
    });
    props.onOpenChange(false);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent class="max-w-xl glass-modal border-glass-border text-foreground">
        <DialogHeader class="pb-3 border-b border-glass-border">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-accent-theme/20 text-accent-theme flex items-center justify-center font-bold shadow-accent-glow">
              <Film class="w-4 h-4" />
            </div>
            <div>
              <DialogTitle class="text-sm font-bold flex items-center gap-2">
                Export MP4 Delivery Master
                <Badge variant="outline" class="text-[10px] bg-accent-theme/10 text-accent-theme border-accent-theme/30">
                  Hardware WebCodecs
                </Badge>
              </DialogTitle>
              <DialogDescription class="text-xs text-muted-foreground">
                Select your target delivery resolution for native aspect ratio export.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div class="flex-1 flex flex-col overflow-hidden">
          {/* Base Aspect Ratio Optimal Quality Indicator */}
          <div class="flex items-center justify-between gap-3 w-full">
            <div class="flex items-center gap-2.5 min-w-0">
              <ShieldCheck class="w-5 h-5 text-emerald-400 shrink-0" />
              <div class="min-w-0">
                <div class="font-bold text-emerald-300 flex items-center gap-1.5 text-xs">
                  <span>Native Aspect Ratio Locked:</span>
                  <span class="font-mono bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-200">
                    {activeRatio()}
                  </span>
                </div>
                <p class="text-[10px] text-emerald-200/80 truncate">
                  100% optimal framing without letterboxing, pillarboxing, or image distortion.
                </p>
              </div>
            </div>
            <Badge class="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px] shrink-0 font-mono">
              ★ Optimal Quality
            </Badge>
          </div>
          {/* Platform Resolution Preset Cards Grid */}
          <div class="space-y-2  w-full">
            <label class="text-[11px] font-mono text-muted-foreground">
              Target Resolution Standards ({activeRatio()})
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              <For each={matchingPresets()}>
                {(preset) => {
                  const isSelected = () => selectedPreset()?.id === preset.id;
                  return (
                    <button
                      type="button"
                      onClick={() => setSelectedPresetId(preset.id)}
                      class={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${isSelected()
                        ? 'bg-accent-theme/15 border-accent-theme shadow-accent-glow text-foreground'
                        : 'bg-glass-surface border-glass-border text-foreground/80 hover:border-accent-theme/50 hover:bg-accent-theme/5'
                        }`}
                    >
                      <div class="flex items-start justify-between gap-2">
                        <div>
                          <div class="font-bold text-xs flex items-center gap-1.5">
                            {preset.label}
                          </div>
                          <div class="text-[10px] font-mono text-accent-theme font-semibold mt-0.5">
                            {preset.width} × {preset.height} px
                          </div>
                        </div>
                        <Show
                          when={isSelected()}
                          fallback={
                            <Badge variant="outline" class="text-[9px] font-mono shrink-0">
                              {preset.badge}
                            </Badge>
                          }
                        >
                          <div class="w-4 h-4 rounded-full bg-accent-theme text-primary-foreground flex items-center justify-center shrink-0">
                            <Check class="w-3 h-3 stroke-[3]" />
                          </div>
                        </Show>
                      </div>
                      <p class="text-[9px] text-muted-foreground mt-2 line-clamp-2">
                        {preset.description}
                      </p>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>
        </div>
        {/* Export Telemetry & Actions */}
        <DialogFooter class="pt-3 border-t border-glass-border flex items-center justify-between text-xs">
          <div class="text-muted-foreground font-mono text-[10px]">
            Target Bitrate: {((selectedPreset()?.recommendedBitrateBps || 0) / 1_000_000).toFixed(1)} Mbps @ {props.fps}fps ({props.totalFrames} frames)
          </div>
          <div class="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => props.onOpenChange(false)} class="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleStart}
              class="bg-accent-theme hover:bg-accent-theme/90 text-primary-foreground text-xs font-bold shadow-accent-glow cursor-pointer gap-1.5"
            >
              <Download class="w-3.5 h-3.5" />
              Start MP4 Export
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

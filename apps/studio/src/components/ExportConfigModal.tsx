import React, { useState } from 'react';
import { Download, Film, Check, Sparkles, X, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
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

export const ExportConfigModal: React.FC<ExportConfigModalProps> = ({
  open,
  onOpenChange,
  width,
  height,
  aspectRatio,
  fps,
  totalFrames,
  onConfirmExport,
}) => {
  const activeRatio: StandardAspectRatio =
    aspectRatio || inferAspectRatioFromCanvasSize(width, height);
  const matchingPresets = getExportPresetsForAspectRatio(activeRatio);

  const [selectedPresetId, setSelectedPresetId] = useState<string>(() => {
    // Default to 1080p preset if available, else first preset
    const default1080p = matchingPresets.find((p) => p.height === 1080 || p.width === 1080);
    return default1080p?.id || matchingPresets[0]?.id || '';
  });

  const selectedPreset =
    matchingPresets.find((p) => p.id === selectedPresetId) || matchingPresets[0];

  const handleStart = () => {
    if (!selectedPreset) return;
    onConfirmExport({
      preset: selectedPreset,
      width: selectedPreset.width,
      height: selectedPreset.height,
      videoBitrate: selectedPreset.recommendedBitrateBps,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl glass-modal border-glass-border p-5 text-foreground">
        <DialogHeader className="pb-3 border-b border-glass-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-theme/20 text-accent-theme flex items-center justify-center font-bold shadow-accent-glow">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                Export MP4 Delivery Master
                <Badge variant="outline" className="text-[10px] bg-accent-theme/10 text-accent-theme border-accent-theme/30">
                  Hardware WebCodecs
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Select your target delivery resolution for native aspect ratio export.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Base Aspect Ratio Optimal Quality Indicator */}
        <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-950/20 text-xs flex items-center justify-between gap-3 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-emerald-300 flex items-center gap-1.5 text-xs">
                <span>Native Aspect Ratio Locked:</span>
                <span className="font-mono bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-200">
                  {activeRatio}
                </span>
              </div>
              <p className="text-[10px] text-emerald-200/80 truncate">
                100% optimal framing without letterboxing, pillarboxing, or image distortion.
              </p>
            </div>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px] shrink-0 font-mono">
            ★ Optimal Quality
          </Badge>
        </div>

        {/* Platform Resolution Preset Cards Grid */}
        <div className="space-y-2">
          <label className="text-[11px] font-mono text-muted-foreground">
            Target Resolution Standards ({activeRatio})
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {matchingPresets.map((preset) => {
              const isSelected = selectedPreset?.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedPresetId(preset.id)}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-accent-theme/15 border-accent-theme shadow-accent-glow text-foreground'
                      : 'bg-glass-surface border-glass-border text-foreground/80 hover:border-accent-theme/50 hover:bg-accent-theme/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        {preset.label}
                      </div>
                      <div className="text-[10px] font-mono text-accent-theme font-semibold mt-0.5">
                        {preset.width} × {preset.height} px
                      </div>
                    </div>
                    {isSelected ? (
                      <div className="w-4 h-4 rounded-full bg-accent-theme text-primary-foreground flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-[9px] font-mono shrink-0">
                        {preset.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-2 line-clamp-2">
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Export Telemetry & Actions */}
        <div className="pt-3 border-t border-glass-border flex items-center justify-between text-xs">
          <div className="text-muted-foreground font-mono text-[10px]">
            Target Bitrate: {(selectedPreset?.recommendedBitrateBps / 1_000_000).toFixed(1)} Mbps @ {fps}fps ({totalFrames} frames)
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleStart}
              className="bg-accent-theme hover:bg-accent-theme/90 text-primary-foreground text-xs font-bold shadow-accent-glow cursor-pointer gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Start MP4 Export
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

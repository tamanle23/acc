import React from 'react';
import { Settings, Clock } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { IRStateManager } from '../../lib/ir/irState';

export interface ProjectInspectorProps {
  irState: ReturnType<typeof IRStateManager.prototype.getState>;
}

export const ASPECT_PRESETS: Array<{ label: string; w: number; h: number }> = [
  { label: '16:9', w: 1920, h: 1080 },
  { label: '9:16', w: 1080, h: 1920 },
  { label: '1:1', w: 1080, h: 1080 },
  { label: '4:4', w: 1440, h: 1440 },
  { label: '3:4', w: 1080, h: 1440 },
  { label: '3:2', w: 1620, h: 1080 },
  { label: '21:9', w: 2560, h: 1080 },
];

export const ProjectInspector: React.FC<ProjectInspectorProps> = ({ irState }) => {
  const width = irState.doc.meta?.canvasSize?.w || 1920;
  const height = irState.doc.meta?.canvasSize?.h || 1080;
  const fps = irState.doc.meta?.globalFps || 30;
  const totalDurationFrames = irState.timeline?.totalFrames || 300;
  const activeSequencesCount = irState.timeline?.sequences
    ? irState.timeline.sequences.size
    : irState.doc.tracks.reduce((acc, t) => acc + t.sequences.length, 0);

  return (
    <div className="space-y-3">
      <Card className="p-3 glass-card border-glass-border space-y-3 text-xs">
        <div className="flex items-center gap-2 pb-2 border-b border-glass-border">
          <div className="w-8 h-8 rounded bg-accent-theme/15 text-accent-theme flex items-center justify-center">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-xs">
              Project Master Settings
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Global canvas resolution & timeline timing
            </p>
          </div>
        </div>

        {/* Content ID */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground font-mono">
            Content ID / Project Title
          </label>
          <Input
            type="text"
            value={irState.doc.meta?.contentId || ''}
            onChange={(e) => {
              IRStateManager.getInstance().updateProjectMeta({
                contentId: e.target.value,
              });
            }}
            className="h-6 text-[11px] font-sans bg-background/60 border-glass-border"
          />
        </div>

        {/* Aspect Ratio 1-Click Pills */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-muted-foreground font-mono">Aspect Ratio Presets</label>
          <div className="grid grid-cols-4 gap-1">
            {ASPECT_PRESETS.map((preset) => {
              const isSelected = width === preset.w && height === preset.h;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    IRStateManager.getInstance().updateProjectMeta({
                      canvasSize: { w: preset.w, h: preset.h },
                    });
                  }}
                  className={`px-1.5 py-1 text-[10px] font-mono rounded border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-accent-theme text-primary-foreground border-accent-theme font-bold shadow-accent-glow'
                      : 'bg-glass-surface border-glass-border text-foreground/80 hover:border-accent-theme/60 hover:text-foreground'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Numerical Width / Height Inputs */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-mono">Width (px)</label>
            <Input
              type="number"
              min={320}
              max={7680}
              step={10}
              value={width}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1920;
                IRStateManager.getInstance().updateProjectMeta({
                  canvasSize: { w: val, h: height },
                });
              }}
              className="h-6 text-[11px] font-mono bg-background/60 border-glass-border"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-mono">Height (px)</label>
            <Input
              type="number"
              min={240}
              max={4320}
              step={10}
              value={height}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1080;
                IRStateManager.getInstance().updateProjectMeta({
                  canvasSize: { w: width, h: val },
                });
              }}
              className="h-6 text-[11px] font-mono bg-background/60 border-glass-border"
            />
          </div>
        </div>

        {/* Global FPS Selector */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-muted-foreground text-[11px] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-accent-theme" />
            Timeline Framerate
          </span>
          <select
            value={fps}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 30;
              IRStateManager.getInstance().updateProjectMeta({ globalFps: val });
            }}
            className="h-6 text-[10px] font-mono bg-glass-surface border border-glass-border rounded px-1.5 text-foreground focus:outline-none focus:border-accent-theme"
          >
            <option value={24}>24 FPS (Cinematic)</option>
            <option value={30}>30 FPS (Standard)</option>
            <option value={60}>60 FPS (Fluid)</option>
          </select>
        </div>

        {/* Project Stats Summary */}
        <div className="pt-2 border-t border-glass-border space-y-1.5 text-[11px]">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Duration:</span>
            <span className="font-mono font-medium text-foreground">
              {totalDurationFrames}f ({(totalDurationFrames / Math.max(1, fps)).toFixed(2)}s)
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Active Tracks:</span>
            <Badge
              variant="outline"
              className="font-mono text-[10px] text-accent-theme bg-accent-theme/10 border-accent-theme/30"
            >
              {irState.doc.tracks.length} Tracks
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Sequences:</span>
            <span className="font-mono font-medium text-foreground">
              {activeSequencesCount} items
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};

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
      <Card className="p-3 bg-slate-50/70 dark:bg-slate-900/60 border-slate-200 dark:border-white/10 space-y-3 text-xs">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60 dark:border-white/10">
          <div className="w-8 h-8 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs">
              Project Master Settings
            </h3>
            <p className="text-[10px] text-slate-400">
              Global canvas resolution & timeline timing
            </p>
          </div>
        </div>

        {/* Content ID */}
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 font-mono">
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
            className="h-6 text-[11px] font-sans"
          />
        </div>

        {/* Aspect Ratio 1-Click Pills */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-400 font-mono">Aspect Ratio Presets</label>
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
                      ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-2xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
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
            <label className="text-[10px] text-slate-400 font-mono">Width (px)</label>
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
              className="h-6 text-[11px] font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-mono">Height (px)</label>
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
              className="h-6 text-[11px] font-mono"
            />
          </div>
        </div>

        {/* Global FPS Selector */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-slate-500 text-[11px] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Timeline Framerate
          </span>
          <select
            value={fps}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 30;
              IRStateManager.getInstance().updateProjectMeta({ globalFps: val });
            }}
            className="h-6 text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded px-1.5 text-slate-700 dark:text-slate-200"
          >
            <option value={24}>24 FPS (Cinematic)</option>
            <option value={30}>30 FPS (Standard)</option>
            <option value={60}>60 FPS (Fluid)</option>
          </select>
        </div>

        {/* Project Stats Summary */}
        <div className="pt-2 border-t border-slate-200/60 dark:border-white/10 space-y-1.5 text-[11px]">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Total Duration:</span>
            <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
              {totalDurationFrames}f ({(totalDurationFrames / Math.max(1, fps)).toFixed(2)}s)
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Active Tracks:</span>
            <Badge
              variant="outline"
              className="font-mono text-[10px] text-indigo-700 bg-indigo-50 border-indigo-200"
            >
              {irState.doc.tracks.length} Tracks
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Total Sequences:</span>
            <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
              {activeSequencesCount} items
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};

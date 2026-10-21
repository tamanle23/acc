import React from 'react';
import { ArrowUp, ArrowDown, Layers, Volume2, ChevronRight } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { ParameterSlider } from './modifierCatalog';
import { IRStateManager } from '../../lib/ir/irState';

export interface TrackInspectorProps {
  selectedTrack: any;
  irState: ReturnType<typeof IRStateManager.prototype.getState>;
}

export const TrackInspector: React.FC<TrackInspectorProps> = ({
  selectedTrack,
  irState,
}) => {
  const trackIndex = selectedTrack
    ? irState.doc.tracks.findIndex((t) => t.id === selectedTrack.id)
    : -1;
  const canMoveTrackUp = trackIndex > 0;
  const canMoveTrackDown =
    trackIndex >= 0 && trackIndex < irState.doc.tracks.length - 1;

  if (!selectedTrack) {
    return (
      <div className="p-3 text-center text-xs text-slate-400">
        No track selected.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="p-2.5 bg-slate-50/70 dark:bg-slate-900/60 border-slate-200 dark:border-white/10 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <Badge
              variant="outline"
              className="font-mono text-[10px] text-indigo-700 bg-indigo-50 border-indigo-200 truncate"
            >
              {selectedTrack.id}
            </Badge>
            <Badge variant="secondary" className="font-mono text-[9px] uppercase">
              {selectedTrack.type}
            </Badge>
          </div>

          {/* Track Reordering Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              disabled={!canMoveTrackUp}
              onClick={() =>
                IRStateManager.getInstance().reorderTrack(selectedTrack.id, 'up')
              }
              className="h-5 w-5 text-slate-600 hover:text-indigo-600 disabled:opacity-30 cursor-pointer"
              title="Move track up"
            >
              <ArrowUp className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={!canMoveTrackDown}
              onClick={() =>
                IRStateManager.getInstance().reorderTrack(selectedTrack.id, 'down')
              }
              className="h-5 w-5 text-slate-600 hover:text-indigo-600 disabled:opacity-30 cursor-pointer"
              title="Move track down"
            >
              <ArrowDown className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Track Name */}
        <div className="space-y-1 pt-1 border-t border-slate-200/60 dark:border-white/10">
          <label className="text-[10px] text-slate-400 font-mono">Track Name</label>
          <Input
            type="text"
            value={selectedTrack.name || selectedTrack.id}
            onChange={(e) => {
              IRStateManager.getInstance().updateTrack(selectedTrack.id, {
                name: e.target.value,
              });
            }}
            className="h-6 text-[11px] font-sans"
          />
        </div>

        {/* Compositing & Styling */}
        <div className="pt-2 border-t border-slate-200/60 dark:border-white/10 space-y-2">
          <span className="font-semibold text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            Compositing & Style
          </span>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Blend Mode</span>
            <select
              value={selectedTrack.blendMode || 'normal'}
              onChange={(e) => {
                IRStateManager.getInstance().updateTrack(selectedTrack.id, {
                  blendMode: e.target.value as any,
                });
              }}
              className="h-6 text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded px-1.5 text-slate-700 dark:text-slate-200"
            >
              <option value="normal">normal</option>
              <option value="screen">screen</option>
              <option value="multiply">multiply</option>
              <option value="overlay">overlay</option>
              <option value="add">add</option>
              <option value="color_dodge">color_dodge</option>
              <option value="soft_light">soft_light</option>
            </select>
          </div>

          <ParameterSlider
            label="Opacity"
            value={
              typeof selectedTrack.style?.opacity === 'number'
                ? selectedTrack.style.opacity
                : 1.0
            }
            min={0.0}
            max={1.0}
            step={0.05}
            defaultValue={1.0}
            unit=""
            onChange={(v) => {
              IRStateManager.getInstance().updateTrack(selectedTrack.id, {
                style: { ...selectedTrack.style, opacity: v },
              });
            }}
          />
        </div>

        {/* Audio Bus Routing (for audio or mixed tracks) */}
        {(selectedTrack.type === 'audio' || selectedTrack.routeTo !== undefined) && (
          <div className="pt-2 border-t border-slate-200/60 dark:border-white/10 space-y-2">
            <span className="font-semibold text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-rose-500" />
              Audio Bus & Routing
            </span>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Route To Bus</span>
              <select
                value={selectedTrack.routeTo || 'master'}
                onChange={(e) => {
                  IRStateManager.getInstance().updateTrack(selectedTrack.id, {
                    routeTo: e.target.value,
                  });
                }}
                className="h-6 text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded px-1.5 text-slate-700 dark:text-slate-200"
              >
                <option value="master">master</option>
                {irState.doc.tracks
                  .filter((t) => t.id !== selectedTrack.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id}
                    </option>
                  ))}
              </select>
            </div>

            <ParameterSlider
              label="Bus Volume"
              value={
                typeof selectedTrack.style?.volume === 'number'
                  ? (selectedTrack.style.volume as number)
                  : 1.0
              }
              min={0.0}
              max={2.0}
              step={0.05}
              defaultValue={1.0}
              unit="x"
              onChange={(v) => {
                IRStateManager.getInstance().updateTrack(selectedTrack.id, {
                  style: { ...selectedTrack.style, volume: v },
                });
              }}
            />

            <ParameterSlider
              label="Stereo Pan"
              value={
                typeof selectedTrack.style?.pan === 'number'
                  ? (selectedTrack.style.pan as number)
                  : 0.0
              }
              min={-1.0}
              max={1.0}
              step={0.05}
              defaultValue={0.0}
              unit=""
              onChange={(v) => {
                IRStateManager.getInstance().updateTrack(selectedTrack.id, {
                  style: { ...selectedTrack.style, pan: v },
                });
              }}
            />
          </div>
        )}

        {/* Sequences Overview */}
        <div className="pt-2 border-t border-slate-200/60 dark:border-white/10 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Child Sequences</span>
            <Badge variant="outline" className="font-mono text-[10px]">
              {selectedTrack.sequences.length} clips
            </Badge>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
            {selectedTrack.sequences.map((seq: any) => (
              <div
                key={seq.id}
                onClick={() => {
                  IRStateManager.getInstance().setSelectedSequenceId(seq.id);
                  IRStateManager.getInstance().setInspectorMode('sequence');
                }}
                className="px-2 py-1 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-white/10 flex items-center justify-between cursor-pointer hover:border-indigo-400 text-[11px]"
              >
                <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300 truncate">
                  {seq.id}
                </span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};

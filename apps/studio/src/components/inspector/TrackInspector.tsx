import React from 'react';
import { ArrowUp, ArrowDown, Layers, Volume2, ChevronRight, Sparkles, RotateCcw, Trash2 } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '../ui/accordion';
import { ParameterSlider, MODIFIER_PRESENTATION_CATALOG } from './modifierCatalog';
import { DynamicModifierInspector } from './DynamicModifierInspector';
import { IRStateManager } from '../../lib/ir/irState';
import type { StudioSequence, StudioTrack } from '../../lib/ir/studioTypes';
import type { BlendMode, ModifierNode } from '@acc/ir';

export interface TrackInspectorProps {
  selectedTrack: StudioTrack | null | undefined;
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
      <div className="p-3 text-center text-xs text-muted-foreground">
        No track selected.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="p-2.5 glass-card border-glass-border space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <Badge
              variant="outline"
              className="font-mono text-[10px] text-accent-theme bg-accent-theme/10 border-accent-theme/30 truncate"
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
              className="h-5 w-5 text-muted-foreground hover:text-accent-theme border-glass-border disabled:opacity-30 cursor-pointer"
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
              className="h-5 w-5 text-muted-foreground hover:text-accent-theme border-glass-border disabled:opacity-30 cursor-pointer"
              title="Move track down"
            >
              <ArrowDown className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Track Name */}
        <div className="space-y-1 pt-1 border-t border-glass-border">
          <label className="text-[10px] text-muted-foreground font-mono">Track Name</label>
          <Input
            type="text"
            value={selectedTrack.name || selectedTrack.id}
            onChange={(e) => {
              IRStateManager.getInstance().updateTrack(selectedTrack.id, {
                name: e.target.value,
              });
            }}
            className="h-6 text-[11px] font-sans bg-background/60 border-glass-border"
          />
        </div>

        {/* Compositing & Styling */}
        <div className="pt-2 border-t border-glass-border space-y-2">
          <span className="font-semibold text-[11px] text-foreground flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-accent-theme" />
            Compositing & Style
          </span>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Blend Mode</span>
            <select
              value={selectedTrack.blendMode || 'normal'}
              onChange={(e) => {
                IRStateManager.getInstance().updateTrack(selectedTrack.id, {
                  blendMode: e.target.value as BlendMode,
                });
              }}
              className="h-6 text-[10px] font-mono bg-glass-surface border border-glass-border rounded px-1.5 text-foreground focus:outline-none focus:border-accent-theme"
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
          <div className="pt-2 border-t border-glass-border space-y-2">
            <span className="font-semibold text-[11px] text-foreground flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-rose-500" />
              Audio Bus & Routing
            </span>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Route To Bus</span>
              <select
                value={selectedTrack.routeTo || 'master'}
                onChange={(e) => {
                  IRStateManager.getInstance().updateTrack(selectedTrack.id, {
                    routeTo: e.target.value,
                  });
                }}
                className="h-6 text-[10px] font-mono bg-glass-surface border border-glass-border rounded px-1.5 text-foreground focus:outline-none focus:border-accent-theme"
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
        <div className="pt-2 border-t border-glass-border space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Child Sequences</span>
            <Badge variant="outline" className="font-mono text-[10px] border-glass-border">
              {selectedTrack.sequences.length} clips
            </Badge>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
            {selectedTrack.sequences.map((seq: StudioSequence) => (
              <div
                key={seq.id}
                onClick={() => {
                  IRStateManager.getInstance().setSelectedSequenceId(seq.id);
                  IRStateManager.getInstance().setInspectorMode('sequence');
                }}
                className="px-2 py-1 bg-glass-surface rounded border border-glass-border flex items-center justify-between cursor-pointer hover:border-accent-theme text-[11px] transition-colors"
              >
                <span className="font-mono text-[10px] text-foreground truncate">
                  {seq.id}
                </span>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Attached Track Modifiers */}
      {selectedTrack.modifiers && selectedTrack.modifiers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-accent-theme" />
              Track Modifiers ({selectedTrack.modifiers.length})
            </span>
          </div>

          <Accordion
            type="multiple"
            defaultValue={selectedTrack.modifiers.map((m: ModifierNode, i: number) => m.id || `${m.type}_${i}`)}
            className="border-glass-border space-y-2"
          >
            {selectedTrack.modifiers.map((mod: ModifierNode, idx: number) => {
              const modKey = mod.id || `${mod.type}_${idx}`;
              const catalogEntry = MODIFIER_PRESENTATION_CATALOG[mod.type];
              const Icon = catalogEntry?.icon || Sparkles;
              const title = catalogEntry?.name || mod.type.split('/').pop() || mod.type;
              const isEnabled = mod.params?.enabled !== false;

              return (
                <AccordionItem
                  key={modKey}
                  value={modKey}
                  className="rounded-md overflow-hidden glass-card border-glass-border"
                >
                  <AccordionTrigger
                    actions={
                      <div className="flex items-center gap-1">
                        {catalogEntry?.defaultParams && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={() =>
                              IRStateManager.getInstance().updateModifier(selectedTrack.id, mod.type, {
                                ...catalogEntry.defaultParams,
                                enabled: isEnabled,
                              })
                            }
                            title="Reset modifier"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive cursor-pointer"
                          onClick={() => IRStateManager.getInstance().removeModifier(selectedTrack.id, mod.type)}
                          title="Remove modifier"
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) =>
                            IRStateManager.getInstance().updateModifier(selectedTrack.id, mod.type, {
                              ...(mod.params || {}),
                              enabled: checked,
                            })
                          }
                        />
                      </div>
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-accent-theme" />
                      <span className="text-xs font-bold text-foreground">
                        {title}
                      </span>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="p-3 space-y-3">
                    <DynamicModifierInspector
                      modifierType={mod.type}
                      params={mod.params || {}}
                      disabled={!isEnabled}
                      onChange={(nextParams) =>
                        IRStateManager.getInstance().updateModifier(selectedTrack.id, mod.type, nextParams)
                      }
                    />
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { Settings, Clock, Sparkles, RotateCcw, Trash2, Smartphone, Monitor, Film, Square } from 'lucide-react';
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
import { MODIFIER_PRESENTATION_CATALOG } from './modifierCatalog';
import { DynamicModifierInspector } from './DynamicModifierInspector';
import { IRStateManager } from '../../lib/ir/irState';
import {
  ASPECT_RATIO_PRESETS,
  inferAspectRatioFromCanvasSize,
  type StandardAspectRatio,
} from '@acc/ir';

export interface ProjectInspectorProps {
  irState: ReturnType<typeof IRStateManager.prototype.getState>;
}

export const ProjectInspector: React.FC<ProjectInspectorProps> = ({ irState }) => {
  const width = irState.doc.meta?.canvasSize?.w || 1920;
  const height = irState.doc.meta?.canvasSize?.h || 1080;
  const activeRatio: StandardAspectRatio =
    irState.doc.meta?.aspectRatio || inferAspectRatioFromCanvasSize(width, height);
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
              Base aspect ratio & timeline timing
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

        {/* Base Aspect Ratio Standard Grid */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-muted-foreground font-mono">Base Aspect Ratio</label>
            <span className="text-[9px] font-mono text-accent-theme font-semibold">
              {activeRatio} ({width}×{height})
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {ASPECT_RATIO_PRESETS.map((preset) => {
              const isSelected = activeRatio === preset.ratio;
              return (
                <button
                  key={preset.ratio}
                  type="button"
                  onClick={() => {
                    IRStateManager.getInstance().updateProjectMeta({
                      aspectRatio: preset.ratio,
                      canvasSize: { w: preset.canonicalWidth, h: preset.canonicalHeight },
                    });
                  }}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                    isSelected
                      ? 'bg-accent-theme/15 border-accent-theme shadow-accent-glow text-foreground'
                      : 'bg-glass-surface border-glass-border text-foreground/80 hover:border-accent-theme/50 hover:bg-accent-theme/5'
                  }`}
                >
                  {/* Aspect Ratio Miniature Wireframe Silhouette */}
                  <div
                    className="shrink-0 flex items-center justify-center rounded border border-current/40 bg-foreground/5"
                    style={{
                      width: '28px',
                      height: '24px',
                    }}
                  >
                    <div
                      className="border border-current rounded-[1px] bg-current/20"
                      style={{
                        width:
                          preset.numericRatio >= 1
                            ? '20px'
                            : `${Math.round(20 * preset.numericRatio)}px`,
                        height:
                          preset.numericRatio <= 1
                            ? '18px'
                            : `${Math.round(18 / preset.numericRatio)}px`,
                      }}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold font-mono truncate">{preset.ratio}</span>
                      <span className="text-[8px] font-mono uppercase text-muted-foreground">{preset.orientation}</span>
                    </div>
                    <div className="text-[9px] text-muted-foreground truncate">{preset.label}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-[9px] text-muted-foreground font-sans mt-1 leading-tight">
            💡 <strong className="text-foreground">Optimal Quality:</strong> Canvas coordinates are authored in canonical {activeRatio} space. Exact output resolutions (720p, 1080p, 2K, 4K) are chosen at export.
          </p>
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

      {/* Timeline Master Modifiers */}
      {irState.doc.modifiers && irState.doc.modifiers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-accent-theme" />
              Timeline Master Effects ({irState.doc.modifiers.length})
            </span>
          </div>

          <Accordion
            type="multiple"
            defaultValue={irState.doc.modifiers.map((m: ModifierNode, i: number) => m.id || `${m.type}_${i}`)}
            className="border-glass-border space-y-2"
          >
            {irState.doc.modifiers.map((mod: ModifierNode, idx: number) => {
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
                              IRStateManager.getInstance().updateModifier('timeline', mod.type, {
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
                          onClick={() => IRStateManager.getInstance().removeModifier('timeline', mod.type)}
                          title="Remove modifier"
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) =>
                            IRStateManager.getInstance().updateModifier('timeline', mod.type, {
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
                        IRStateManager.getInstance().updateModifier('timeline', mod.type, nextParams)
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

import { Show, For } from 'solid-js';
import { Settings, Clock, Sparkles, RotateCcw, Trash2 } from 'lucide-solid';
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
  type ModifierNode,
} from '@acc/ir';

export interface ProjectInspectorProps {
  irState: ReturnType<typeof IRStateManager.prototype.getState>;
}

export function ProjectInspector(props: ProjectInspectorProps) {
  const width = () => props.irState.doc.meta?.canvasSize?.w || 1920;
  const height = () => props.irState.doc.meta?.canvasSize?.h || 1080;
  const activeRatio = (): StandardAspectRatio =>
    props.irState.doc.meta?.aspectRatio || inferAspectRatioFromCanvasSize(width(), height());
  const fps = () => props.irState.doc.meta?.globalFps || 30;
  const totalDurationFrames = () => props.irState.timeline?.totalFrames || 300;
  const activeSequencesCount = () =>
    props.irState.timeline?.sequences
      ? props.irState.timeline.sequences.size
      : props.irState.doc.tracks.reduce((acc, t) => acc + t.sequences.length, 0);

  return (
    <div class="space-y-3">
      <Card class="p-3 glass-card border-glass-border space-y-3 text-xs">
        <div class="flex items-center gap-2 pb-2 border-b border-glass-border">
          <div class="w-8 h-8 rounded bg-accent-theme/15 text-accent-theme flex items-center justify-center">
            <Settings class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-bold text-foreground text-xs">
              Project Master Settings
            </h3>
            <p class="text-[10px] text-muted-foreground">
              Base aspect ratio & timeline timing
            </p>
          </div>
        </div>

        {/* Content ID */}
        <div class="space-y-1">
          <label class="text-[10px] text-muted-foreground font-mono">
            Content ID / Project Title
          </label>
          <Input
            type="text"
            value={props.irState.doc.meta?.contentId || ''}
            onInput={(e) => {
              IRStateManager.getInstance().updateProjectMeta({
                contentId: e.currentTarget.value,
              });
            }}
            class="h-6 text-[11px] font-sans bg-background/60 border-glass-border"
          />
        </div>

        {/* Base Aspect Ratio Standard Grid */}
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-[10px] text-muted-foreground font-mono">Base Aspect Ratio</label>
            <span class="text-[9px] font-mono text-accent-theme font-semibold">
              {activeRatio()} ({width()}×{height()})
            </span>
          </div>

          <div class="grid grid-cols-2 gap-1.5">
            <For each={ASPECT_RATIO_PRESETS}>
              {(preset) => {
                const isSelected = () => activeRatio() === preset.ratio;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      IRStateManager.getInstance().updateProjectMeta({
                        aspectRatio: preset.ratio,
                        canvasSize: { w: preset.canonicalWidth, h: preset.canonicalHeight },
                      });
                    }}
                    class={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      isSelected()
                        ? 'bg-accent-theme/15 border-accent-theme shadow-accent-glow text-foreground'
                        : 'bg-glass-surface border-glass-border text-foreground/80 hover:border-accent-theme/50 hover:bg-accent-theme/5'
                    }`}
                  >
                    {/* Aspect Ratio Miniature Wireframe Silhouette */}
                    <div
                      class="shrink-0 flex items-center justify-center rounded border border-current/40 bg-foreground/5"
                      style={{
                        width: '28px',
                        height: '24px',
                      }}
                    >
                      <div
                        class="border border-current rounded-[1px] bg-current/20"
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

                    <div class="min-w-0 flex-1">
                      <div class="flex items-center justify-between">
                        <span class="text-[11px] font-bold font-mono truncate">{preset.ratio}</span>
                        <span class="text-[8px] font-mono uppercase text-muted-foreground">{preset.orientation}</span>
                      </div>
                      <div class="text-[9px] text-muted-foreground truncate">{preset.label}</div>
                    </div>
                  </button>
                );
              }}
            </For>
          </div>

          <p class="text-[9px] text-muted-foreground font-sans mt-1 leading-tight">
            💡 <strong class="text-foreground">Optimal Quality:</strong> Canvas coordinates are authored in canonical {activeRatio()} space. Exact output resolutions (720p, 1080p, 2K, 4K) are chosen at export.
          </p>
        </div>

        {/* Global FPS Selector */}
        <div class="flex items-center justify-between pt-1">
          <span class="text-muted-foreground text-[11px] flex items-center gap-1.5">
            <Clock class="w-3.5 h-3.5 text-accent-theme" />
            Timeline Framerate
          </span>
          <select
            value={fps()}
            onChange={(e) => {
              const val = parseInt(e.currentTarget.value) || 30;
              IRStateManager.getInstance().updateProjectMeta({ globalFps: val });
            }}
            class="h-6 text-[10px] font-mono bg-glass-surface border border-glass-border rounded px-1.5 text-foreground focus:outline-none focus:border-accent-theme"
          >
            <option value={24}>24 FPS (Cinematic)</option>
            <option value={30}>30 FPS (Standard)</option>
            <option value={60}>60 FPS (Fluid)</option>
          </select>
        </div>

        {/* Project Stats Summary */}
        <div class="pt-2 border-t border-glass-border space-y-1.5 text-[11px]">
          <div class="flex justify-between items-center">
            <span class="text-muted-foreground">Total Duration:</span>
            <span class="font-mono font-medium text-foreground">
              {totalDurationFrames()}f ({(totalDurationFrames() / Math.max(1, fps())).toFixed(2)}s)
            </span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-muted-foreground">Active Tracks:</span>
            <Badge
              variant="outline"
              class="font-mono text-[10px] text-accent-theme bg-accent-theme/10 border-accent-theme/30"
            >
              {props.irState.doc.tracks.length} Tracks
            </Badge>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-muted-foreground">Total Sequences:</span>
            <span class="font-mono font-medium text-foreground">
              {activeSequencesCount()} items
            </span>
          </div>
        </div>
      </Card>

      {/* Timeline Master Modifiers */}
      <Show when={props.irState.doc.modifiers && props.irState.doc.modifiers.length > 0}>
        <div class="space-y-2">
          <div class="flex items-center justify-between px-1">
            <span class="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles class="w-3.5 h-3.5 text-accent-theme" />
              Timeline Master Effects ({props.irState.doc.modifiers?.length})
            </span>
          </div>

          <Accordion
            multiple
            defaultValue={props.irState.doc.modifiers?.map((m: ModifierNode, i: number) => m.id || `${m.type}_${i}`)}
            class="border-glass-border space-y-2"
          >
            <For each={props.irState.doc.modifiers}>
              {(mod, idx) => {
                const modKey = () => mod.id || `${mod.type}_${idx()}`;
                const catalogEntry = () => MODIFIER_PRESENTATION_CATALOG[mod.type];
                const Icon = () => catalogEntry()?.icon || Sparkles;
                const title = () => catalogEntry()?.name || mod.type.split('/').pop() || mod.type;
                const isEnabled = () => mod.params?.enabled !== false;

                const TriggerIcon = Icon();

                return (
                  <AccordionItem
                    value={modKey()}
                    class="rounded-md overflow-hidden glass-card border-glass-border"
                  >
                    <AccordionTrigger
                      actions={
                        <div class="flex items-center gap-1">
                          <Show when={catalogEntry()?.defaultParams}>
                            <Button
                              variant="ghost"
                              size="icon"
                              class="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                              onClick={() =>
                                IRStateManager.getInstance().updateModifier('timeline', mod.type, {
                                  ...catalogEntry()?.defaultParams,
                                  enabled: isEnabled(),
                                })
                              }
                              title="Reset modifier"
                            >
                              <RotateCcw class="w-3 h-3" />
                            </Button>
                          </Show>
                          <Button
                            variant="ghost"
                            size="icon"
                            class="h-6 w-6 text-muted-foreground hover:text-destructive cursor-pointer"
                            onClick={() => IRStateManager.getInstance().removeModifier('timeline', mod.type)}
                            title="Remove modifier"
                          >
                            <Trash2 class="w-3 h-3 text-destructive" />
                          </Button>
                          <Switch
                            checked={isEnabled()}
                            onChange={(checked: boolean) =>
                              IRStateManager.getInstance().updateModifier('timeline', mod.type, {
                                ...(mod.params || {}),
                                enabled: checked,
                              })
                            }
                          />
                        </div>
                      }
                    >
                      <div class="flex items-center gap-1.5">
                        <TriggerIcon class="w-3.5 h-3.5 text-accent-theme" />
                        <span class="text-xs font-bold text-foreground">
                          {title()}
                        </span>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent class="p-3 space-y-3">
                      <DynamicModifierInspector
                        modifierType={mod.type}
                        params={mod.params || {}}
                        disabled={!isEnabled()}
                        onChange={(nextParams) =>
                          IRStateManager.getInstance().updateModifier('timeline', mod.type, nextParams)
                        }
                      />
                    </AccordionContent>
                  </AccordionItem>
                );
              }}
            </For>
          </Accordion>
        </div>
      </Show>
    </div>
  );
}

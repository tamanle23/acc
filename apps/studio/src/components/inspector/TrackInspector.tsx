import { Show, For } from 'solid-js';
import { ArrowUp, ArrowDown, Layers, Volume2, ChevronRight, Sparkles, RotateCcw, Trash2 } from 'lucide-solid';
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

export function TrackInspector(props: TrackInspectorProps) {
  const trackIndex = () =>
    props.selectedTrack ? props.irState.doc.tracks.findIndex((t) => t.id === props.selectedTrack!.id) : -1;
  const canMoveTrackUp = () => trackIndex() > 0;
  const canMoveTrackDown = () =>
    trackIndex() >= 0 && trackIndex() < props.irState.doc.tracks.length - 1;

  return (
    <Show
      when={props.selectedTrack}
      fallback={
        <div class="p-3 text-center text-xs text-muted-foreground">
          No track selected.
        </div>
      }
    >
      {(track) => (
        <div class="space-y-3">
          <Card class="p-2.5 glass-card border-glass-border space-y-2 text-xs">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5 min-w-0">
                <Badge
                  variant="outline"
                  class="font-mono text-[10px] text-accent-theme bg-accent-theme/10 border-accent-theme/30 truncate"
                >
                  {track().id}
                </Badge>
                <Badge variant="secondary" class="font-mono text-[9px] uppercase">
                  {track().type}
                </Badge>
              </div>

              {/* Track Reordering Controls */}
              <div class="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={!canMoveTrackUp()}
                  onClick={() =>
                    IRStateManager.getInstance().reorderTrack(track().id, 'up')
                  }
                  class="h-5 w-5 text-muted-foreground hover:text-accent-theme border-glass-border disabled:opacity-30 cursor-pointer"
                  title="Move track up"
                >
                  <ArrowUp class="w-3 h-3" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={!canMoveTrackDown()}
                  onClick={() =>
                    IRStateManager.getInstance().reorderTrack(track().id, 'down')
                  }
                  class="h-5 w-5 text-muted-foreground hover:text-accent-theme border-glass-border disabled:opacity-30 cursor-pointer"
                  title="Move track down"
                >
                  <ArrowDown class="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Track Name */}
            <div class="space-y-1 pt-1 border-t border-glass-border">
              <label class="text-[10px] text-muted-foreground font-mono">Track Name</label>
              <Input
                type="text"
                value={track().name || track().id}
                onInput={(e) => {
                  IRStateManager.getInstance().updateTrack(track().id, {
                    name: e.currentTarget.value,
                  });
                }}
                class="h-6 text-[11px] font-sans bg-background/60 border-glass-border"
              />
            </div>

            {/* Compositing & Styling */}
            <div class="pt-2 border-t border-glass-border space-y-2">
              <span class="font-semibold text-[11px] text-foreground flex items-center gap-1.5">
                <Layers class="w-3.5 h-3.5 text-accent-theme" />
                Compositing & Style
              </span>

              <div class="flex items-center justify-between">
                <span class="text-[11px] text-muted-foreground">Blend Mode</span>
                <select
                  value={track().blendMode || 'normal'}
                  onChange={(e) => {
                    IRStateManager.getInstance().updateTrack(track().id, {
                      blendMode: e.currentTarget.value as BlendMode,
                    });
                  }}
                  class="h-6 text-[10px] font-mono bg-glass-surface border border-glass-border rounded px-1.5 text-foreground focus:outline-none focus:border-accent-theme"
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
                  typeof track().style?.opacity === 'number'
                    ? (track().style!.opacity as number)
                    : 1.0
                }
                min={0.0}
                max={1.0}
                step={0.05}
                defaultValue={1.0}
                unit=""
                onChange={(v) => {
                  IRStateManager.getInstance().updateTrack(track().id, {
                    style: { ...track().style, opacity: v },
                  });
                }}
              />
            </div>

            {/* Audio Bus Routing (for audio or mixed tracks) */}
            <Show when={track().type === 'audio' || track().routeTo !== undefined}>
              <div class="pt-2 border-t border-glass-border space-y-2">
                <span class="font-semibold text-[11px] text-foreground flex items-center gap-1.5">
                  <Volume2 class="w-3.5 h-3.5 text-rose-500" />
                  Audio Bus & Routing
                </span>

                <div class="flex items-center justify-between">
                  <span class="text-[11px] text-muted-foreground">Route To Bus</span>
                  <select
                    value={track().routeTo || 'master'}
                    onChange={(e) => {
                      IRStateManager.getInstance().updateTrack(track().id, {
                        routeTo: e.currentTarget.value,
                      });
                    }}
                    class="h-6 text-[10px] font-mono bg-glass-surface border border-glass-border rounded px-1.5 text-foreground focus:outline-none focus:border-accent-theme"
                  >
                    <option value="master">master</option>
                    <For each={props.irState.doc.tracks.filter((t) => t.id !== track().id)}>
                      {(t) => (
                        <option value={t.id}>
                          {t.id}
                        </option>
                      )}
                    </For>
                  </select>
                </div>

                <ParameterSlider
                  label="Bus Volume"
                  value={
                    typeof track().style?.volume === 'number'
                      ? (track().style!.volume as number)
                      : 1.0
                  }
                  min={0.0}
                  max={2.0}
                  step={0.05}
                  defaultValue={1.0}
                  unit="x"
                  onChange={(v) => {
                    IRStateManager.getInstance().updateTrack(track().id, {
                      style: { ...track().style, volume: v },
                    });
                  }}
                />

                <ParameterSlider
                  label="Stereo Pan"
                  value={
                    typeof track().style?.pan === 'number'
                      ? (track().style!.pan as number)
                      : 0.0
                  }
                  min={-1.0}
                  max={1.0}
                  step={0.05}
                  defaultValue={0.0}
                  unit=""
                  onChange={(v) => {
                    IRStateManager.getInstance().updateTrack(track().id, {
                      style: { ...track().style, pan: v },
                    });
                  }}
                />
              </div>
            </Show>

            {/* Sequences Overview */}
            <div class="pt-2 border-t border-glass-border space-y-1.5">
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-muted-foreground">Child Sequences</span>
                <Badge variant="outline" class="font-mono text-[10px] border-glass-border">
                  {track().sequences.length} clips
                </Badge>
              </div>
              <div class="space-y-1 max-h-32 overflow-y-auto pr-0.5">
                <For each={track().sequences}>
                  {(seq: StudioSequence) => (
                    <div
                      onClick={() => {
                        IRStateManager.getInstance().setSelectedSequenceId(seq.id);
                        IRStateManager.getInstance().setInspectorMode('sequence');
                      }}
                      class="px-2 py-1 bg-glass-surface rounded border border-glass-border flex items-center justify-between cursor-pointer hover:border-accent-theme text-[11px] transition-colors"
                    >
                      <span class="font-mono text-[10px] text-foreground truncate">
                        {seq.id}
                      </span>
                      <ChevronRight class="w-3 h-3 text-muted-foreground" />
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Card>

          {/* Attached Track Modifiers */}
          <Show when={track().modifiers && track().modifiers!.length > 0}>
            <div class="space-y-2">
              <div class="flex items-center justify-between px-1">
                <span class="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles class="w-3.5 h-3.5 text-accent-theme" />
                  Track Modifiers ({track().modifiers!.length})
                </span>
              </div>

              <Accordion
                multiple
                defaultValue={track().modifiers!.map((m: ModifierNode, i: number) => m.id || `${m.type}_${i}`)}
                class="border-glass-border space-y-2"
              >
                <For each={track().modifiers}>
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
                                    IRStateManager.getInstance().updateModifier(track().id, mod.type, {
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
                                onClick={() => IRStateManager.getInstance().removeModifier(track().id, mod.type)}
                                title="Remove modifier"
                              >
                                <Trash2 class="w-3 h-3 text-destructive" />
                              </Button>
                              <Switch
                                checked={isEnabled()}
                                onChange={(checked: boolean) =>
                                  IRStateManager.getInstance().updateModifier(track().id, mod.type, {
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
                              IRStateManager.getInstance().updateModifier(track().id, mod.type, nextParams)
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
      )}
    </Show>
  );
}

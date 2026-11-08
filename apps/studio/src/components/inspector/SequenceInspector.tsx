import { createSignal, createMemo, Show, For, Index } from 'solid-js';
import {
  Copy,
  Check,
  Clock,
  Type,
  Trash2,
  CopyPlus,
  Lock,
  Unlock,
  Sliders,
  Sparkles,
  AlertCircle,
  Link2,
  Unlink,
} from 'lucide-solid';
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
import { DynamicModifierInspector } from './DynamicModifierInspector';
import {
  formatTimecode,
  getSectionIdForModifierType,
  MODIFIER_PRESENTATION_CATALOG,
} from './modifierCatalog';
import { IRStateManager } from '../../lib/ir/irState';
import type { StudioSequence, StudioTrack } from '../../lib/ir/studioTypes';
import { ModifierPluginRegistry, type ModifierNode } from '@acc/ir';
import { CueTimelineDialog } from './CueTimelineDialog';
import { ModifierCardHeader } from './ModifierCardHeader';

export interface SequenceInspectorProps {
  selectedSeq: StudioSequence | null | undefined;
  selectedTrack: StudioTrack | null | undefined;
  irState: ReturnType<typeof IRStateManager.prototype.getState>;
  fps: number;
  isLocked?: boolean;
  onToggleLock?: (locked: boolean) => void;
  openSections?: string[];
  onOpenSectionsChange?: (sections: string[]) => void;
  onAddEffectClick?: () => void;
  searchQuery?: string;
  isBypassAll?: boolean;
}

export function SequenceInspector(props: SequenceInspectorProps) {
  const [copiedId, setCopiedId] = createSignal(false);
  const [internalLocked, setInternalLocked] = createSignal(false);
  const [isCueDialogOpen, setIsCueDialogOpen] = createSignal(false);

  const isLocked = () => (props.isLocked !== undefined ? props.isLocked : internalLocked());
  const setIsLocked = (locked: boolean) => {
    if (props.onToggleLock) {
      props.onToggleLock(locked);
    } else {
      setInternalLocked(locked);
    }
  };

  const [internalOpenSections, setInternalOpenSections] = createSignal<string[]>([
    'transform',
    'motion_gsap',
    'relighting',
    'camera',
    'particles',
    'hologram_hud',
    'typography',
    'color',
    'audio',
    'procedural_sfx',
  ]);

  const openSections = () => (props.openSections !== undefined ? props.openSections : internalOpenSections());
  const setOpenSections = (sections: string[]) => {
    if (props.onOpenSectionsChange) {
      props.onOpenSectionsChange(sections);
    } else {
      setInternalOpenSections(sections);
    }
  };

  const effectiveOpenSections = createMemo(() => {
    const set = new Set<string>();
    const q = (props.searchQuery || '').trim();
    const curOpen = openSections();
    (props.selectedSeq?.modifiers || []).forEach((m, idx) => {
      const key = (m as any).id || `${m.type}_${idx}`;
      const secId = getSectionIdForModifierType(m.type);
      if (q !== '') {
        set.add(key);
      } else if (curOpen.includes(key) || curOpen.includes(secId) || curOpen.includes(m.type)) {
        set.add(key);
      }
    });
    return Array.from(set);
  });

  const handleAccordionValueChange = (nextOpenKeys: string[]) => {
    const currentModifiers = (props.selectedSeq?.modifiers || []).map((m, idx) => ({
      key: (m as any).id || `${m.type}_${idx}`,
      type: m.type,
      secId: getSectionIdForModifierType(m.type),
    }));

    // Find which modifiers on this sequence were explicitly closed
    const closedModifiers = currentModifiers.filter((m) => !nextOpenKeys.includes(m.key));
    const closedSet = new Set<string>();
    closedModifiers.forEach((m) => {
      closedSet.add(m.key);
      closedSet.add(m.type);
      closedSet.add(m.secId);
    });

    // Retain all open section IDs that were NOT closed
    const updated = openSections().filter((s) => !closedSet.has(s));

    // Ensure all currently open keys are retained in openSections
    nextOpenKeys.forEach((k) => {
      if (!updated.includes(k)) {
        updated.push(k);
      }
    });

    setOpenSections(updated);
  };

  const selectedSeqId = () => props.selectedSeq?.id || '';
  const modifiers = () => props.selectedSeq?.modifiers || [];
  const standaloneMod = () =>
    modifiers().find((m) => ModifierPluginRegistry.getInstance().get(m.type)?.targetScope === 'standalone');

  const filteredModifiers = createMemo(() => {
    const q = (props.searchQuery || '').toLowerCase().trim();
    const mods = modifiers();
    if (!q) return mods;
    return mods.filter((mod) => {
      const catalogEntry = MODIFIER_PRESENTATION_CATALOG[mod.type];
      const title = catalogEntry?.name || mod.type;
      const matchesTitle = title.toLowerCase().includes(q);
      const matchesType = mod.type.toLowerCase().includes(q);
      const matchesParams = Object.keys(mod.params || {}).some((k) => k.toLowerCase().includes(q));
      return matchesTitle || matchesType || matchesParams;
    });
  });

  const handleCopyId = () => {
    const id = selectedSeqId();
    if (!id) return;
    navigator.clipboard?.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const handleDuplicate = () => {
    const id = selectedSeqId();
    if (!id) return;
    IRStateManager.getInstance().duplicateSequence(id);
  };

  const handleDelete = () => {
    const id = selectedSeqId();
    if (!id) return;
    IRStateManager.getInstance().deleteSequence(id);
  };

  const updateModifierParams = (modType: string, params: Record<string, unknown>) => {
    const id = selectedSeqId();
    if (!id) return;
    IRStateManager.getInstance().updateModifier(id, modType, params);
  };

  const removeModifier = (modType: string) => {
    const id = selectedSeqId();
    if (!id) return;
    IRStateManager.getInstance().removeModifier(id, modType);
  };

  // Resolved timing calculation
  const currentSeq = () => props.selectedSeq;
  const currentSeqTime = () => currentSeq()?.time;
  const timelineSeq = () => props.irState.timeline?.sequences?.get(selectedSeqId());
  const resolvedStartFrame = () =>
    typeof currentSeqTime()?.start === 'number'
      ? (currentSeqTime()!.start as number)
      : (timelineSeq()?.startFrame ?? 0);
  const resolvedDurationFrames = () =>
    typeof currentSeqTime()?.duration === 'number'
      ? (currentSeqTime()!.duration as number)
      : (timelineSeq()?.durationFrames ?? 90);
  const resolvedEndFrame = () => resolvedStartFrame() + resolvedDurationFrames();

  const isStartRelational = () =>
    typeof currentSeqTime()?.start === 'object' && currentSeqTime()?.start !== null;
  const isDurationRelational = () =>
    typeof currentSeqTime()?.duration === 'object' && currentSeqTime()?.duration !== null;

  const currentStartNumber = () =>
    typeof currentSeqTime()?.start === 'number' ? (currentSeqTime()!.start as number) : resolvedStartFrame();
  const currentDurationNumber = () =>
    typeof currentSeqTime()?.duration === 'number' ? (currentSeqTime()!.duration as number) : resolvedDurationFrames();

  const otherSequenceIds = () =>
    props.irState.doc.tracks
      .flatMap((t) => t.sequences)
      .map((s) => s.id)
      .filter((id) => id !== selectedSeqId());

  const relStartObj = () =>
    isStartRelational()
      ? (props.selectedSeq?.time?.start as {
          after?: string;
          syncWith?: string;
          offsetFrames?: number;
          overlapFrames?: number;
        }) || {}
      : {};
  const relStartType = () => (relStartObj().syncWith ? 'syncWith' : 'after');
  const relStartTarget = () =>
    relStartObj().after || relStartObj().syncWith || otherSequenceIds()[0] || '';
  const relStartOffset = () => relStartObj().offsetFrames ?? 0;
  const relStartOverlap = () => relStartObj().overlapFrames ?? 0;

  const relDurObj = () =>
    isDurationRelational()
      ? (props.selectedSeq?.time?.duration as {
          matchAssetDuration?: boolean;
          matchLengthOf?: string;
          paddingFrames?: number;
        }) || {}
      : {};
  const relDurMatchAsset = () => Boolean(relDurObj().matchAssetDuration);
  const relDurTarget = () => relDurObj().matchLengthOf || otherSequenceIds()[0] || '';
  const relDurPadding = () => relDurObj().paddingFrames ?? 0;

  const handleToggleStartRelational = (rel: boolean) => {
    const id = selectedSeqId();
    if (!id || !props.selectedSeq) return;
    if (rel) {
      const target = otherSequenceIds()[0] || '';
      IRStateManager.getInstance().updateSequenceProps(id, {
        time: {
          ...props.selectedSeq.time,
          start: { after: target, offsetFrames: 0 },
        },
      });
    } else {
      IRStateManager.getInstance().updateSequenceProps(id, {
        time: {
          ...props.selectedSeq.time,
          start: resolvedStartFrame(),
        },
      });
    }
  };

  const handleToggleDurationRelational = (rel: boolean) => {
    const id = selectedSeqId();
    if (!id || !props.selectedSeq) return;
    if (rel) {
      const target = otherSequenceIds()[0] || '';
      IRStateManager.getInstance().updateSequenceProps(id, {
        time: {
          ...props.selectedSeq.time,
          duration: { matchLengthOf: target, paddingFrames: 0 },
        },
      });
    } else {
      IRStateManager.getInstance().updateSequenceProps(id, {
        time: {
          ...props.selectedSeq.time,
          duration: resolvedDurationFrames(),
        },
      });
    }
  };

  return (
    <Show
      when={props.selectedSeq}
      fallback={
        <div class="p-3 text-center text-xs text-muted-foreground">
          No sequence selected.
        </div>
      }
    >
      {(seq) => (
        <div class="space-y-3">
          {/* Sequence Meta Card */}
          <Card class="p-2.5 glass-card border-glass-border space-y-2 text-xs">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5 min-w-0">
                <Badge
                  variant="outline"
                  class="font-mono text-[10px] text-accent-theme bg-accent-theme/10 border-accent-theme/30 truncate"
                >
                  {seq().id}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyId}
                  class="h-5 w-5 text-muted-foreground hover:text-accent-theme cursor-pointer"
                  title="Copy Sequence ID"
                  aria-label="Copy sequence ID to clipboard"
                >
                  <Show when={copiedId()} fallback={<Copy class="w-3 h-3" />}>
                    <Check class="w-3 h-3 text-emerald-600" />
                  </Show>
                </Button>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <Show when={standaloneMod()}>
                  <Badge
                    variant="outline"
                    class="font-mono text-[9px] uppercase border-purple-500/40 text-purple-400 bg-purple-500/10"
                  >
                    Standalone Generator
                  </Badge>
                </Show>
                <Badge variant="secondary" class="font-mono text-[9px] uppercase">
                  {seq().type || props.selectedTrack?.type || 'track'}
                </Badge>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-border/40">
              <div>
                <span class="text-muted-foreground">Track: </span>
                <span class="font-mono font-medium text-foreground">
                  {props.selectedTrack?.id}
                </span>
              </div>
              <div>
                <span class="text-muted-foreground">Duration: </span>
                <span class="font-mono font-medium text-foreground">
                  {resolvedDurationFrames()}f ({(resolvedDurationFrames() / props.fps).toFixed(2)}s)
                </span>
              </div>
            </div>

            {/* Sequence Timing Card */}
            <div class="pt-2 border-t border-border/40 space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-semibold text-[11px] text-foreground/90 flex items-center gap-1.5">
                  <Clock class="w-3.5 h-3.5 text-accent-theme" />
                  Sequence Timing
                </span>
                <span class="text-[10px] font-mono text-muted-foreground">
                  {resolvedStartFrame()}f - {resolvedEndFrame()}f ({formatTimecode(resolvedStartFrame(), props.fps)})
                </span>
              </div>

              {/* Start Time Section */}
              <div class="bg-muted/30 p-2 rounded border border-border/40 space-y-1.5">
                <div class="flex items-center justify-between text-[11px]">
                  <span class="font-medium text-muted-foreground">Start Time</span>
                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={isLocked()}
                      onClick={() => handleToggleStartRelational(false)}
                      class={`px-1.5 py-0.5 text-[9px] rounded font-medium transition-colors ${
                        isLocked() ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                      } ${
                        !isStartRelational()
                          ? 'bg-accent-theme text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Absolute
                    </button>
                    <button
                      type="button"
                      disabled={isLocked() || otherSequenceIds().length === 0}
                      onClick={() => handleToggleStartRelational(true)}
                      title={
                        otherSequenceIds().length === 0
                          ? 'Requires ≥2 sequences'
                          : 'Switch to Relational timing'
                      }
                      class={`px-1.5 py-0.5 text-[9px] rounded font-medium transition-colors ${
                        isLocked() || otherSequenceIds().length === 0
                          ? 'cursor-not-allowed opacity-50'
                          : 'cursor-pointer'
                      } ${
                        isStartRelational()
                          ? 'bg-accent-theme text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Relational
                    </button>
                  </div>
                </div>

                <Show
                  when={isStartRelational()}
                  fallback={
                    <div class="flex items-center gap-2">
                      <div class="flex-1">
                        <label class="text-[10px] text-muted-foreground">Frame</label>
                        <Input
                          type="number"
                          min={0}
                          disabled={isLocked()}
                          value={currentStartNumber()}
                          onInput={(e) => {
                            const val = parseInt(e.currentTarget.value) || 0;
                            IRStateManager.getInstance().updateSequenceProps(selectedSeqId(), {
                              time: { ...seq().time, start: val },
                            });
                          }}
                          class="h-6 text-[11px] font-mono bg-background"
                        />
                      </div>
                      <div class="flex-1">
                        <label class="text-[10px] text-muted-foreground">Timecode</label>
                        <div class="h-6 px-2 text-[10px] font-mono flex items-center bg-muted/60 rounded text-foreground border border-border/40">
                          {formatTimecode(currentStartNumber(), props.fps)}
                        </div>
                      </div>
                    </div>
                  }
                >
                  <div class="space-y-1.5 text-[11px]">
                    <div class="grid grid-cols-2 gap-1.5">
                      <div>
                        <label class="text-[10px] text-muted-foreground">Relation</label>
                        <select
                          value={relStartType()}
                          disabled={isLocked()}
                          onChange={(e) => {
                            const mode = e.currentTarget.value as 'after' | 'syncWith';
                            const newRel =
                              mode === 'syncWith'
                                ? { syncWith: relStartTarget(), offsetFrames: relStartOffset() }
                                : {
                                    after: relStartTarget(),
                                    offsetFrames: relStartOffset(),
                                    overlapFrames: relStartOverlap(),
                                  };
                            IRStateManager.getInstance().updateSequenceProps(selectedSeqId(), {
                              time: { ...seq().time, start: newRel },
                            });
                          }}
                          class="w-full h-6 text-[10px] bg-background border border-border/50 rounded px-1 text-foreground disabled:cursor-not-allowed"
                        >
                          <option value="after">after (sequential)</option>
                          <option value="syncWith">syncWith (parallel)</option>
                        </select>
                      </div>
                      <div>
                        <label class="text-[10px] text-muted-foreground">Target Sequence</label>
                        <select
                          value={relStartTarget()}
                          disabled={isLocked()}
                          onChange={(e) => {
                            const target = e.currentTarget.value;
                            const newRel =
                              relStartType() === 'syncWith'
                                ? { syncWith: target, offsetFrames: relStartOffset() }
                                : {
                                    after: target,
                                    offsetFrames: relStartOffset(),
                                    overlapFrames: relStartOverlap(),
                                  };
                            IRStateManager.getInstance().updateSequenceProps(selectedSeqId(), {
                              time: { ...seq().time, start: newRel },
                            });
                          }}
                          class="w-full h-6 text-[10px] bg-background border border-border/50 rounded px-1 font-mono text-foreground disabled:cursor-not-allowed"
                        >
                          <For each={otherSequenceIds()}>
                            {(id) => (
                              <option value={id}>
                                {id}
                              </option>
                            )}
                          </For>
                        </select>
                      </div>
                    </div>

                    <div class="grid grid-cols-2 gap-1.5 pt-1 border-t border-border/30">
                      <div>
                        <label class="text-[10px] text-muted-foreground">Offset (Frames)</label>
                        <Input
                          type="number"
                          disabled={isLocked()}
                          value={relStartOffset()}
                          onInput={(e) => {
                            const offset = parseInt(e.currentTarget.value) || 0;
                            const newRel =
                              relStartType() === 'syncWith'
                                ? { syncWith: relStartTarget(), offsetFrames: offset }
                                : {
                                    after: relStartTarget(),
                                    offsetFrames: offset,
                                    overlapFrames: relStartOverlap(),
                                  };
                            IRStateManager.getInstance().updateSequenceProps(selectedSeqId(), {
                              time: { ...seq().time, start: newRel },
                            });
                          }}
                          class="h-6 text-[10px] font-mono bg-background"
                        />
                      </div>
                      <Show when={relStartType() === 'after'}>
                        <div>
                          <label class="text-[10px] text-muted-foreground">Overlap (Frames)</label>
                          <Input
                            type="number"
                            min={0}
                            disabled={isLocked()}
                            value={relStartOverlap()}
                            onInput={(e) => {
                              const overlap = Math.max(0, parseInt(e.currentTarget.value) || 0);
                              const newRel = {
                                after: relStartTarget(),
                                offsetFrames: relStartOffset(),
                                overlapFrames: overlap,
                              };
                              IRStateManager.getInstance().updateSequenceProps(selectedSeqId(), {
                                time: { ...seq().time, start: newRel },
                              });
                            }}
                            class="h-6 text-[10px] font-mono bg-background"
                          />
                        </div>
                      </Show>
                    </div>
                  </div>
                </Show>
              </div>

              {/* Duration Section */}
              <div class="bg-muted/30 p-2 rounded border border-border/40 space-y-1.5">
                <div class="flex items-center justify-between text-[11px]">
                  <span class="font-medium text-muted-foreground">Duration</span>
                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={isLocked()}
                      onClick={() => handleToggleDurationRelational(false)}
                      class={`px-1.5 py-0.5 text-[9px] rounded font-medium transition-colors ${
                        isLocked() ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                      } ${
                        !isDurationRelational()
                          ? 'bg-accent-theme text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Absolute
                    </button>
                    <button
                      type="button"
                      disabled={isLocked() || otherSequenceIds().length === 0}
                      onClick={() => handleToggleDurationRelational(true)}
                      title={
                        otherSequenceIds().length === 0
                          ? 'Requires ≥2 sequences'
                          : 'Switch to Relational duration'
                      }
                      class={`px-1.5 py-0.5 text-[9px] rounded font-medium transition-colors ${
                        isLocked() || otherSequenceIds().length === 0
                          ? 'cursor-not-allowed opacity-50'
                          : 'cursor-pointer'
                      } ${
                        isDurationRelational()
                          ? 'bg-accent-theme text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Relational
                    </button>
                  </div>
                </div>

                <Show
                  when={isDurationRelational()}
                  fallback={
                    <div class="flex items-center gap-2">
                      <div class="flex-1">
                        <label class="text-[10px] text-muted-foreground">Frames</label>
                        <Input
                          type="number"
                          min={1}
                          disabled={isLocked()}
                          value={currentDurationNumber()}
                          onInput={(e) => {
                            const val = Math.max(1, parseInt(e.currentTarget.value) || 1);
                            IRStateManager.getInstance().updateSequenceProps(selectedSeqId(), {
                              time: { ...seq().time, duration: val },
                            });
                          }}
                          class="h-6 text-[11px] font-mono bg-background"
                        />
                      </div>
                      <div class="flex-1">
                        <label class="text-[10px] text-muted-foreground">Seconds</label>
                        <div class="h-6 px-2 text-[10px] font-mono flex items-center bg-muted/60 rounded text-foreground border border-border/40">
                          {(currentDurationNumber() / props.fps).toFixed(2)}s
                        </div>
                      </div>
                    </div>
                  }
                >
                  <div class="space-y-1.5 text-[11px]">
                    <div class="flex items-center justify-between">
                      <span class="text-[10px] text-muted-foreground">Match Asset Duration</span>
                      <Switch
                        checked={relDurMatchAsset()}
                        disabled={isLocked()}
                        onChange={(checked: boolean) => {
                          const newRel = checked
                            ? { matchAssetDuration: true }
                            : {
                                matchLengthOf:
                                  relDurTarget() || otherSequenceIds()[0] || '',
                                paddingFrames: relDurPadding(),
                              };
                          IRStateManager.getInstance().updateSequenceProps(selectedSeqId(), {
                            time: { ...seq().time, duration: newRel },
                          });
                        }}
                      />
                    </div>

                    <Show when={!relDurMatchAsset()}>
                      <div class="grid grid-cols-2 gap-1.5 pt-1 border-t border-border/30">
                        <div>
                          <label class="text-[10px] text-muted-foreground">Target</label>
                          <select
                            value={relDurTarget()}
                            disabled={isLocked()}
                            onChange={(e) => {
                              const target = e.currentTarget.value;
                              IRStateManager.getInstance().updateSequenceProps(selectedSeqId(), {
                                time: {
                                  ...seq().time,
                                  duration: { matchLengthOf: target, paddingFrames: relDurPadding() },
                                },
                              });
                            }}
                            class="w-full h-6 text-[10px] bg-background border border-border/50 rounded px-1 font-mono text-foreground disabled:cursor-not-allowed"
                          >
                            <For each={otherSequenceIds()}>
                              {(id) => (
                                <option value={id}>
                                  {id}
                                </option>
                              )}
                            </For>
                          </select>
                        </div>
                        <div>
                          <label class="text-[10px] text-muted-foreground">Padding (Frames)</label>
                          <Input
                            type="number"
                            disabled={isLocked()}
                            value={relDurPadding()}
                            onInput={(e) => {
                              const padding = parseInt(e.currentTarget.value) || 0;
                              IRStateManager.getInstance().updateSequenceProps(selectedSeqId(), {
                                time: {
                                  ...seq().time,
                                  duration: {
                                    matchLengthOf: relDurTarget() || otherSequenceIds()[0] || '',
                                    paddingFrames: padding,
                                  },
                                },
                              });
                            }}
                            class="h-6 text-[10px] font-mono bg-background"
                          />
                        </div>
                      </div>
                    </Show>
                  </div>
                </Show>
              </div>
            </div>

            {/* Timed Text Subtitle Cues */}
            <Show when={props.selectedTrack?.type === 'timed_text' || seq().cues !== undefined}>
              <div class="pt-2 border-t border-border/40 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="font-semibold text-[11px] text-foreground/90 flex items-center gap-1.5">
                    <Type class="w-3.5 h-3.5 text-amber-500" />
                    Timed Text Cues ({seq().cues?.length || 0})
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isLocked()}
                    onClick={() => setIsCueDialogOpen(true)}
                    class="h-5 px-1.5 text-[10px] text-accent-theme hover:bg-accent-theme/10 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Manage Cues
                  </Button>
                </div>
                <Show when={seq().cues && seq().cues!.length > 0}>
                  <div class="p-1.5 rounded bg-muted/30 border border-border/30 text-[10px] text-muted-foreground flex items-center justify-between">
                    <span class="truncate max-w-[180px] italic">
                      &ldquo;{seq().cues![0]?.text}&rdquo;
                    </span>
                    <span class="font-mono text-[9px] shrink-0">
                      {seq().cues!.length} cue{seq().cues!.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </Show>
              </div>
            </Show>

            {/* A/V Link Status & Controls */}
            {(() => {
              const avLink = () => modifiers().find((m: ModifierNode) => m.type === 'editorial/av_link');
              const isLinked = () => (avLink()?.params as any)?.enabled !== false;
              const partnerId = () => (avLink()?.params as any)?.linkedSequenceId as string | undefined;
              const partnerTrack = () => (avLink()?.params as any)?.linkedTrackId as string | undefined;

              return (
                <Show when={avLink()}>
                  <div class="pt-2 border-t border-glass-border space-y-1.5">
                    <div class="flex items-center justify-between">
                      <span class="font-semibold text-[11px] text-foreground/90 flex items-center gap-1.5">
                        <Link2 class="w-3.5 h-3.5 text-accent-theme" />
                        Linked Audio / Video
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isLocked()}
                        onClick={() => {
                          const newEnabled = !isLinked();
                          updateModifierParams('editorial/av_link', {
                            ...(avLink()!.params as any),
                            enabled: newEnabled,
                          });
                          const pId = partnerId();
                          if (pId) {
                            IRStateManager.getInstance().updateModifier(pId, 'editorial/av_link', {
                              ...avLink()!.params,
                              linkedSequenceId: selectedSeqId(),
                              linkedTrackId: props.selectedTrack?.id,
                              enabled: newEnabled,
                            });
                          }
                        }}
                        class={`h-5 px-2 text-[10px] gap-1 cursor-pointer transition-colors ${
                          isLinked()
                            ? 'border-accent-theme/50 bg-accent-theme/15 text-accent-theme hover:bg-accent-theme/25'
                            : 'border-glass-border bg-muted/40 text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <Show
                          when={isLinked()}
                          fallback={
                            <>
                              <Unlink class="w-2.5 h-2.5" />
                              Unlinked
                            </>
                          }
                        >
                          <Link2 class="w-2.5 h-2.5" />
                          Linked
                        </Show>
                      </Button>
                    </div>
                    <div class="p-1.5 rounded bg-muted/30 border border-glass-border text-[10px] text-muted-foreground flex items-center justify-between">
                      <span>
                        Partner: <span class="font-mono text-foreground font-medium">{partnerId()}</span>
                      </span>
                      <span class="font-mono text-[9px] uppercase px-1 py-0.5 rounded bg-muted">{partnerTrack()}</span>
                    </div>
                  </div>
                </Show>
              );
            })()}

            {/* Action Bar */}
            <div class="flex items-center gap-1 pt-2 border-t border-glass-border">
              <Button
                variant="outline"
                size="sm"
                disabled={isLocked()}
                onClick={handleDuplicate}
                class="flex-1 h-6 text-[10px] gap-1 text-foreground hover:bg-accent-theme/10 hover:text-accent-theme border-glass-border cursor-pointer disabled:cursor-not-allowed"
                title="Duplicate sequence"
                aria-label="Duplicate this sequence"
              >
                <CopyPlus class="w-3 h-3" />
                Duplicate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsLocked(!isLocked())}
                class={`h-6 px-2 text-[10px] gap-1 border-glass-border cursor-pointer ${
                  isLocked() ? 'bg-amber-500/15 text-amber-500 border-amber-500/40' : 'text-muted-foreground'
                }`}
                title={isLocked() ? 'Locked (Click to unlock)' : 'Unlocked (Click to lock)'}
                aria-label={isLocked() ? 'Unlock sequence' : 'Lock sequence'}
                aria-pressed={isLocked()}
              >
                <Show when={isLocked()} fallback={<Unlock class="w-3 h-3" />}>
                  <Lock class="w-3 h-3" />
                </Show>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isLocked()}
                onClick={handleDelete}
                class="h-6 px-2 text-[10px] text-destructive hover:bg-destructive/15 border-destructive/30 cursor-pointer disabled:cursor-not-allowed"
                title="Delete sequence (undoable)"
                aria-label="Delete this sequence"
              >
                <Trash2 class="w-3 h-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isLocked()}
                onClick={() => {
                  const id = selectedSeqId();
                  if (!id) return;
                  IRStateManager.getInstance().rippleDeleteSequence(id);
                }}
                class="h-6 px-2 text-[10px] text-amber-500 hover:bg-amber-500/15 border-amber-500/30 cursor-pointer disabled:cursor-not-allowed"
                title="Ripple Delete (Closes track gap, undoable)"
              >
                Ripple Del
              </Button>
            </div>
          </Card>

          {/* Pure Attached-Only Empty State */}
          <Show when={modifiers().length === 0}>
            <div class="p-6 border-2 border-dashed border-glass-border rounded-lg text-center space-y-2.5 text-muted-foreground bg-glass-surface/30">
              <Sliders class="w-8 h-8 mx-auto text-muted-foreground/60" />
              <p class="text-xs font-semibold text-foreground/90">
                No Effects Attached
              </p>
              <p class="text-[11px] text-muted-foreground max-w-[220px] mx-auto">
                Click &ldquo;+ Add Effect&rdquo; above to attach visual, audio, or motion modifiers to this sequence.
              </p>
              <Show when={props.onAddEffectClick}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLocked()}
                  onClick={props.onAddEffectClick}
                  class="h-7 text-xs gap-1.5 border-accent-theme/40 text-accent-theme bg-accent-theme/10 hover:bg-accent-theme/20 cursor-pointer disabled:cursor-not-allowed mx-auto"
                >
                  <Sparkles class="w-3.5 h-3.5" />
                  Add First Effect
                </Button>
              </Show>
            </div>
          </Show>

          {/* Dynamic Modifiers Accordion Engine */}
          <Accordion
            multiple
            value={effectiveOpenSections()}
            onChange={handleAccordionValueChange}
            class="border-glass-border space-y-2"
          >
            <Index each={filteredModifiers()}>
              {(mod, idx) => {
                const modKey = () => (mod() as any).id || `${mod().type}_${idx}`;
                const sectionId = () => getSectionIdForModifierType(mod().type);
                const catalogEntry = () => MODIFIER_PRESENTATION_CATALOG[mod().type];
                const Icon = () => catalogEntry()?.icon || Sparkles;
                const title = () => catalogEntry()?.name || mod().type.split('/').pop() || mod().type;
                const isEnabled = () => (mod().params as any)?.enabled !== false && !props.isBypassAll;

                const TriggerIcon = () => {
                  const Comp = Icon();
                  return <Comp class="w-3.5 h-3.5 text-accent-theme" />;
                };

                return (
                  <AccordionItem
                    value={modKey()}
                    class="rounded-md overflow-hidden glass-card border-glass-border"
                  >
                    <AccordionTrigger
                      actions={
                        <div class="flex items-center gap-1">
                          <ModifierCardHeader
                            modifier={mod()}
                            index={idx}
                            totalModifiers={modifiers().length}
                            catalogEntry={catalogEntry() as any}
                            isLocked={isLocked()}
                            onMoveUp={() =>
                              IRStateManager.getInstance().reorderModifier(selectedSeqId(), mod().type, 'up')
                            }
                            onMoveDown={() =>
                              IRStateManager.getInstance().reorderModifier(selectedSeqId(), mod().type, 'down')
                            }
                            onReset={() =>
                              !isLocked() &&
                              catalogEntry()?.defaultParams &&
                              updateModifierParams(mod().type, {
                                ...catalogEntry()!.defaultParams,
                                enabled: isEnabled(),
                              })
                            }
                            onRemove={() => !isLocked() && removeModifier(mod().type)}
                          />
                          <Switch
                            checked={isEnabled()}
                            disabled={isLocked()}
                            onChange={(checked: boolean) =>
                              !isLocked() &&
                              updateModifierParams(mod().type, {
                                ...((mod().params as any) || {}),
                                enabled: checked,
                              })
                            }
                          />
                        </div>
                      }
                    >
                      <div className="flex items-center gap-1.5">
                        <TriggerIcon />
                        <span class="text-xs font-bold text-foreground">
                          {title()}
                        </span>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent class="p-3 space-y-3">
                      <Show when={sectionId() === 'transitions'}>
                        {(() => {
                          const transDur = () => (mod().params as any)?.durationFrames ?? 15;
                          const seqDur = () => props.selectedSeq?.durationFrames ?? 90;
                          const hasInsufficientHead = () => (transDur() as number) > seqDur();
                          return (
                            <Show when={hasInsufficientHead()}>
                              <div class="flex items-start gap-1.5 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[10px]">
                                <AlertCircle class="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span>
                                  <strong>Insufficient Media Handles:</strong> Transition duration ({transDur()}f) exceeds sequence duration ({seqDur()}f). Clip may freeze or clip abruptly.
                                </span>
                              </div>
                            </Show>
                          );
                        })()}
                      </Show>
                      <DynamicModifierInspector
                        modifierType={mod().type}
                        params={(mod().params as any) || {}}
                        disabled={isLocked() || !isEnabled() || props.isBypassAll}
                        onChange={(nextParams) => !isLocked() && updateModifierParams(mod().type, nextParams)}
                      />
                    </AccordionContent>
                  </AccordionItem>
                );
              }}
            </Index>
          </Accordion>

          {/* Subtitle Cue Timeline Management Modal */}
          <CueTimelineDialog
            open={isCueDialogOpen()}
            onOpenChange={setIsCueDialogOpen}
            cues={seq().cues || []}
            disabled={isLocked()}
            onSaveCues={(updatedCues) => {
              const id = selectedSeqId();
              if (!id) return;
              IRStateManager.getInstance().updateSequenceProps(id, { cues: updatedCues });
            }}
          />
        </div>
      )}
    </Show>
  );
}

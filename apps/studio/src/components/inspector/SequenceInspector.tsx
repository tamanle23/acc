import React, { useState } from 'react';
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
  RotateCcw,
  Sparkles,
} from 'lucide-react';
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

export interface SequenceInspectorProps {
  selectedSeq: any;
  selectedTrack: any;
  irState: ReturnType<typeof IRStateManager.prototype.getState>;
  fps: number;
}

export const SequenceInspector: React.FC<SequenceInspectorProps> = ({
  selectedSeq,
  selectedTrack,
  irState,
  fps,
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>([
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

  if (!selectedSeq) {
    return (
      <div className="p-3 text-center text-xs text-slate-400">
        No sequence selected.
      </div>
    );
  }

  const selectedSeqId = selectedSeq.id;
  const modifiers: any[] = selectedSeq.modifiers || [];

  const handleCopyId = () => {
    navigator.clipboard?.writeText(selectedSeqId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const handleDuplicate = () => {
    if (!selectedSeqId) return;
    IRStateManager.getInstance().duplicateSequence(selectedSeqId);
  };

  const handleDelete = () => {
    if (!selectedSeqId) return;
    IRStateManager.getInstance().deleteSequence(selectedSeqId);
  };

  const updateModifierParams = (modType: string, params: Record<string, any>) => {
    if (!selectedSeqId) return;
    IRStateManager.getInstance().updateModifier(selectedSeqId, modType, params);
  };

  const removeModifier = (modType: string) => {
    if (!selectedSeqId) return;
    IRStateManager.getInstance().removeModifier(selectedSeqId, modType);
  };

  // Resolved timing calculation
  const timelineSeq = irState.timeline?.sequences?.get(selectedSeqId);
  const resolvedStartFrame = timelineSeq?.startFrame ?? (typeof selectedSeq.time?.start === 'number' ? selectedSeq.time.start : 0);
  const resolvedDurationFrames = timelineSeq?.durationFrames ?? (typeof selectedSeq.time?.duration === 'number' ? selectedSeq.time.duration : 90);
  const resolvedEndFrame = resolvedStartFrame + resolvedDurationFrames;

  const isStartRelational = typeof selectedSeq.time?.start === 'object' && selectedSeq.time?.start !== null;
  const isDurationRelational = typeof selectedSeq.time?.duration === 'object' && selectedSeq.time?.duration !== null;

  const currentStartNumber = typeof selectedSeq.time?.start === 'number' ? selectedSeq.time.start : resolvedStartFrame;
  const currentDurationNumber = typeof selectedSeq.time?.duration === 'number' ? selectedSeq.time.duration : resolvedDurationFrames;

  const otherSequenceIds = irState.doc.tracks
    .flatMap((t) => t.sequences)
    .map((s) => s.id)
    .filter((id) => id !== selectedSeqId);

  const relStartObj = isStartRelational ? (selectedSeq.time.start as any) : {};
  const relStartType = relStartObj.syncWith ? 'syncWith' : 'after';
  const relStartTarget = relStartObj.after || relStartObj.syncWith || otherSequenceIds[0] || '';
  const relStartOffset = relStartObj.offsetFrames ?? 0;
  const relStartOverlap = relStartObj.overlapFrames ?? 0;

  const relDurObj = isDurationRelational ? (selectedSeq.time.duration as any) : {};
  const relDurMatchAsset = Boolean(relDurObj.matchAssetDuration);
  const relDurTarget = relDurObj.matchLengthOf || otherSequenceIds[0] || '';
  const relDurPadding = relDurObj.paddingFrames ?? 0;

  const handleToggleStartRelational = (rel: boolean) => {
    if (rel) {
      const target = otherSequenceIds[0] || '';
      IRStateManager.getInstance().updateSequenceProps(selectedSeqId, {
        time: {
          ...selectedSeq.time,
          start: { after: target, offsetFrames: 0 },
        },
      });
    } else {
      IRStateManager.getInstance().updateSequenceProps(selectedSeqId, {
        time: {
          ...selectedSeq.time,
          start: resolvedStartFrame,
        },
      });
    }
  };

  const handleToggleDurationRelational = (rel: boolean) => {
    if (rel) {
      const target = otherSequenceIds[0] || '';
      IRStateManager.getInstance().updateSequenceProps(selectedSeqId, {
        time: {
          ...selectedSeq.time,
          duration: { matchLengthOf: target, paddingFrames: 0 },
        },
      });
    } else {
      IRStateManager.getInstance().updateSequenceProps(selectedSeqId, {
        time: {
          ...selectedSeq.time,
          duration: resolvedDurationFrames,
        },
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* Sequence Meta Card */}
      <Card className="p-2.5 bg-card/60 border-border/50 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <Badge
              variant="outline"
              className="font-mono text-[10px] text-accent-theme bg-accent-theme/10 border-accent-theme/30 truncate"
            >
              {selectedSeq.id}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyId}
              className="h-5 w-5 text-muted-foreground hover:text-accent-theme cursor-pointer"
              title="Copy Sequence ID"
            >
              {copiedId ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
          </div>
          <Badge variant="secondary" className="font-mono text-[9px] uppercase">
            {selectedTrack?.type || 'track'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-border/40">
          <div>
            <span className="text-muted-foreground">Track: </span>
            <span className="font-mono font-medium text-foreground">
              {selectedTrack?.id}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Duration: </span>
            <span className="font-mono font-medium text-foreground">
              {resolvedDurationFrames}f ({(resolvedDurationFrames / fps).toFixed(2)}s)
            </span>
          </div>
        </div>

        {/* Sequence Timing Card */}
        <div className="pt-2 border-t border-border/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[11px] text-foreground/90 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-accent-theme" />
              Sequence Timing
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {resolvedStartFrame}f - {resolvedEndFrame}f ({formatTimecode(resolvedStartFrame, fps)})
            </span>
          </div>

          {/* Start Time Section */}
          <div className="bg-muted/30 p-2 rounded border border-border/40 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-muted-foreground">Start Time</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleToggleStartRelational(false)}
                  className={`px-1.5 py-0.5 text-[9px] rounded font-medium transition-colors cursor-pointer ${
                    !isStartRelational
                      ? 'bg-accent-theme text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Absolute
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleStartRelational(true)}
                  className={`px-1.5 py-0.5 text-[9px] rounded font-medium transition-colors cursor-pointer ${
                    isStartRelational
                      ? 'bg-accent-theme text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Relational
                </button>
              </div>
            </div>

            {!isStartRelational ? (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground">Frame</label>
                  <Input
                    type="number"
                    min={0}
                    value={currentStartNumber}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      IRStateManager.getInstance().updateSequenceProps(selectedSeqId, {
                        time: { ...selectedSeq.time, start: val },
                      });
                    }}
                    className="h-6 text-[11px] font-mono bg-background"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground">Timecode</label>
                  <div className="h-6 px-2 text-[10px] font-mono flex items-center bg-muted/60 rounded text-foreground border border-border/40">
                    {formatTimecode(currentStartNumber, fps)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 text-[11px]">
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Relation</label>
                    <select
                      value={relStartType}
                      onChange={(e) => {
                        const mode = e.target.value as 'after' | 'syncWith';
                        const newRel = mode === 'syncWith'
                          ? { syncWith: relStartTarget, offsetFrames: relStartOffset }
                          : { after: relStartTarget, offsetFrames: relStartOffset, overlapFrames: relStartOverlap };
                        IRStateManager.getInstance().updateSequenceProps(selectedSeqId, {
                          time: { ...selectedSeq.time, start: newRel },
                        });
                      }}
                      className="w-full h-6 text-[10px] bg-background border border-border/50 rounded px-1 text-foreground"
                    >
                      <option value="after">after (sequential)</option>
                      <option value="syncWith">syncWith (parallel)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Target Sequence</label>
                    <select
                      value={relStartTarget}
                      onChange={(e) => {
                        const target = e.target.value;
                        const newRel = relStartType === 'syncWith'
                          ? { syncWith: target, offsetFrames: relStartOffset }
                          : { after: target, offsetFrames: relStartOffset, overlapFrames: relStartOverlap };
                        IRStateManager.getInstance().updateSequenceProps(selectedSeqId, {
                          time: { ...selectedSeq.time, start: newRel },
                        });
                      }}
                      className="w-full h-6 text-[10px] bg-background border border-border/50 rounded px-1 font-mono text-foreground"
                    >
                      {otherSequenceIds.map((id) => (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Duration Section */}
          <div className="bg-muted/30 p-2 rounded border border-border/40 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-muted-foreground">Duration</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleToggleDurationRelational(false)}
                  className={`px-1.5 py-0.5 text-[9px] rounded font-medium transition-colors cursor-pointer ${
                    !isDurationRelational
                      ? 'bg-accent-theme text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Absolute
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleDurationRelational(true)}
                  className={`px-1.5 py-0.5 text-[9px] rounded font-medium transition-colors cursor-pointer ${
                    isDurationRelational
                      ? 'bg-accent-theme text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Relational
                </button>
              </div>
            </div>

            {!isDurationRelational ? (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground">Frames</label>
                  <Input
                    type="number"
                    min={1}
                    value={currentDurationNumber}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 1);
                      IRStateManager.getInstance().updateSequenceProps(selectedSeqId, {
                        time: { ...selectedSeq.time, duration: val },
                      });
                    }}
                    className="h-6 text-[11px] font-mono bg-background"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground">Seconds</label>
                  <div className="h-6 px-2 text-[10px] font-mono flex items-center bg-muted/60 rounded text-foreground border border-border/40">
                    {(currentDurationNumber / fps).toFixed(2)}s
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Match Asset Duration</span>
                  <Switch
                    checked={relDurMatchAsset}
                    onCheckedChange={(checked) => {
                      const newRel = checked
                        ? { matchAssetDuration: true }
                        : { matchLengthOf: relDurTarget || otherSequenceIds[0] || '', paddingFrames: relDurPadding };
                      IRStateManager.getInstance().updateSequenceProps(selectedSeqId, {
                        time: { ...selectedSeq.time, duration: newRel },
                      });
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Timed Text Subtitle Cues */}
        {(selectedTrack?.type === 'timed_text' || selectedSeq?.cues !== undefined) && (
          <div className="pt-2 border-t border-border/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[11px] text-foreground/90 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-amber-500" />
                Timed Text Cues ({selectedSeq?.cues?.length || 0})
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const existing = [...(selectedSeq?.cues || [])];
                  const lastEnd = existing.length > 0 && typeof existing[existing.length - 1].endOffsetMs === 'number'
                    ? existing[existing.length - 1].endOffsetMs
                    : 0;
                  existing.push({
                    startOffsetMs: lastEnd,
                    endOffsetMs: lastEnd + 1500,
                    text: 'New subtitle cue...',
                  });
                  IRStateManager.getInstance().updateSequenceProps(selectedSeqId, { cues: existing });
                }}
                className="h-5 px-1.5 text-[10px] text-accent-theme hover:bg-accent-theme/10 cursor-pointer"
              >
                + Add Cue
              </Button>
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center gap-1 pt-2 border-t border-border/40">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDuplicate}
            className="flex-1 h-6 text-[10px] gap-1 text-foreground hover:bg-accent-theme/10 hover:text-accent-theme border-border/50 cursor-pointer"
            title="Duplicate sequence"
          >
            <CopyPlus className="w-3 h-3" />
            Duplicate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLocked(!isLocked)}
            className={`h-6 px-2 text-[10px] gap-1 border-border/50 cursor-pointer ${
              isLocked ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300' : 'text-muted-foreground'
            }`}
            title={isLocked ? 'Locked' : 'Unlocked'}
          >
            {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            className="h-6 px-2 text-[10px] text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200 cursor-pointer"
            title="Delete sequence (undoable)"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </Card>

      {/* Pure Attached-Only Empty State */}
      {modifiers.length === 0 && (
        <div className="p-6 border-2 border-dashed border-border/60 rounded-lg text-center space-y-2 text-muted-foreground bg-muted/20">
          <Sliders className="w-8 h-8 mx-auto text-muted-foreground/60" />
          <p className="text-xs font-semibold text-foreground/90">
            No Effects Attached
          </p>
          <p className="text-[11px] text-muted-foreground max-w-[220px] mx-auto">
            Click <span className="font-semibold text-accent-theme">+ Add Effect</span> above to attach visual, audio, or motion modifiers to this sequence.
          </p>
        </div>
      )}

      {/* Dynamic Modifiers Accordion Engine */}
      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="space-y-2"
      >
        {modifiers.map((mod: any) => {
          const sectionId = getSectionIdForModifierType(mod.type);
          const catalogEntry = MODIFIER_PRESENTATION_CATALOG[mod.type];
          const Icon = catalogEntry?.icon || Sparkles;
          const title = catalogEntry?.name || mod.type.split('/').pop() || mod.type;
          const isEnabled = mod.params?.enabled !== false;

          return (
            <AccordionItem
              key={mod.type}
              value={sectionId}
              className="border border-border/50 rounded-md overflow-hidden bg-card shadow-2xs"
            >
              <AccordionTrigger
                actions={
                  <div className="flex items-center gap-1">
                    {/* Reset button if available */}
                    {catalogEntry?.defaultParams && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        onClick={() =>
                          updateModifierParams(mod.type, {
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
                      className="h-6 w-6 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                      onClick={() => removeModifier(mod.type)}
                      title="Remove modifier"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500" />
                    </Button>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) =>
                        updateModifierParams(mod.type, {
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
                  onChange={(nextParams) => updateModifierParams(mod.type, nextParams)}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};

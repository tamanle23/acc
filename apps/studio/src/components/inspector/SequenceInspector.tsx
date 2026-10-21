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
      <Card className="p-2.5 bg-slate-50/70 dark:bg-slate-900/60 border-slate-200 dark:border-white/10 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <Badge
              variant="outline"
              className="font-mono text-[10px] text-indigo-700 bg-indigo-50 border-indigo-200 truncate"
            >
              {selectedSeq.id}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyId}
              className="h-5 w-5 text-slate-400 hover:text-indigo-600 cursor-pointer"
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

        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/60 dark:border-white/10">
          <div>
            <span className="text-slate-400">Track: </span>
            <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
              {selectedTrack?.id}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Duration: </span>
            <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
              {resolvedDurationFrames}f ({(resolvedDurationFrames / fps).toFixed(2)}s)
            </span>
          </div>
        </div>

        {/* Sequence Timing Card */}
        <div className="pt-2 border-t border-slate-200/60 dark:border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              Sequence Timing
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {resolvedStartFrame}f - {resolvedEndFrame}f ({formatTimecode(resolvedStartFrame, fps)})
            </span>
          </div>

          {/* Start Time Section */}
          <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded border border-slate-200/80 dark:border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-slate-600 dark:text-slate-400">Start Time</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleToggleStartRelational(false)}
                  className={`px-1.5 py-0.5 text-[9px] rounded font-medium transition-colors cursor-pointer ${
                    !isStartRelational
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  Absolute
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleStartRelational(true)}
                  className={`px-1.5 py-0.5 text-[9px] rounded font-medium transition-colors cursor-pointer ${
                    isStartRelational
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  Relational
                </button>
              </div>
            </div>

            {!isStartRelational ? (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400">Frame</label>
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
                    className="h-6 text-[11px] font-mono"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400">Timecode</label>
                  <div className="h-6 px-2 text-[10px] font-mono flex items-center bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300">
                    {formatTimecode(currentStartNumber, fps)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 text-[11px]">
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[10px] text-slate-400">Relation</label>
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
                      className="w-full h-6 text-[10px] bg-background border border-slate-200 dark:border-white/10 rounded px-1"
                    >
                      <option value="after">after (sequential)</option>
                      <option value="syncWith">syncWith (parallel)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Target Sequence</label>
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
                      className="w-full h-6 text-[10px] bg-background border border-slate-200 dark:border-white/10 rounded px-1 font-mono"
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
          <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded border border-slate-200/80 dark:border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-slate-600 dark:text-slate-400">Duration</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleToggleDurationRelational(false)}
                  className={`px-1.5 py-0.5 text-[9px] rounded font-medium transition-colors cursor-pointer ${
                    !isDurationRelational
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  Absolute
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleDurationRelational(true)}
                  className={`px-1.5 py-0.5 text-[9px] rounded font-medium transition-colors cursor-pointer ${
                    isDurationRelational
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  Relational
                </button>
              </div>
            </div>

            {!isDurationRelational ? (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400">Frames</label>
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
                    className="h-6 text-[11px] font-mono"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400">Seconds</label>
                  <div className="h-6 px-2 text-[10px] font-mono flex items-center bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300">
                    {(currentDurationNumber / fps).toFixed(2)}s
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Match Asset Duration</span>
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
          <div className="pt-2 border-t border-slate-200/60 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
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
                className="h-5 px-1.5 text-[10px] text-indigo-600 hover:bg-indigo-50 cursor-pointer"
              >
                + Add Cue
              </Button>
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center gap-1 pt-2 border-t border-slate-200/60 dark:border-white/10">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDuplicate}
            className="flex-1 h-6 text-[10px] gap-1 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 border-slate-200 dark:border-white/10 cursor-pointer"
            title="Duplicate sequence"
          >
            <CopyPlus className="w-3 h-3" />
            Duplicate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLocked(!isLocked)}
            className={`h-6 px-2 text-[10px] gap-1 border-slate-200 dark:border-white/10 cursor-pointer ${
              isLocked ? 'bg-amber-50 text-amber-700 border-amber-300' : 'text-slate-600'
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
        <div className="p-6 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-lg text-center space-y-2 text-slate-400 bg-slate-50/40 dark:bg-slate-900/20">
          <Sliders className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            No Effects Attached
          </p>
          <p className="text-[11px] text-slate-400 max-w-[220px] mx-auto">
            Click <span className="font-semibold text-indigo-500">+ Add Effect</span> above to attach visual, audio, or motion modifiers to this sequence.
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
              className="border border-slate-200 dark:border-white/10 rounded-md overflow-hidden bg-white dark:bg-slate-900/40 shadow-2xs"
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
                  <Icon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
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

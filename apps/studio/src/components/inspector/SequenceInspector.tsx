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
  AlertCircle,
  Link2,
  Unlink,
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
import { CueTimelineDialog } from './CueTimelineDialog';

export interface SequenceInspectorProps {
  selectedSeq: any;
  selectedTrack: any;
  irState: ReturnType<typeof IRStateManager.prototype.getState>;
  fps: number;
  isLocked?: boolean;
  onToggleLock?: (locked: boolean) => void;
  openSections?: string[];
  onOpenSectionsChange?: (sections: string[]) => void;
  onAddEffectClick?: () => void;
}

export const SequenceInspector: React.FC<SequenceInspectorProps> = ({
  selectedSeq,
  selectedTrack,
  irState,
  fps,
  isLocked: externalLocked,
  onToggleLock,
  openSections: externalOpenSections,
  onOpenSectionsChange,
  onAddEffectClick,
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [internalLocked, setInternalLocked] = useState(false);
  const [isCueDialogOpen, setIsCueDialogOpen] = useState(false);

  const isLocked = externalLocked !== undefined ? externalLocked : internalLocked;
  const setIsLocked = (locked: boolean) => {
    if (onToggleLock) {
      onToggleLock(locked);
    } else {
      setInternalLocked(locked);
    }
  };

  const [internalOpenSections, setInternalOpenSections] = useState<string[]>([
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

  const openSections = externalOpenSections !== undefined ? externalOpenSections : internalOpenSections;
  const setOpenSections = (sections: string[]) => {
    if (onOpenSectionsChange) {
      onOpenSectionsChange(sections);
    } else {
      setInternalOpenSections(sections);
    }
  };

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
            {selectedSeq?.type || selectedTrack?.type || 'track'}
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
                  disabled={isLocked}
                  onClick={() => handleToggleStartRelational(false)}
                  className={`px-1.5 py-0.5 text-[9px] rounded font-medium transition-colors ${isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    } ${!isStartRelational
                      ? 'bg-accent-theme text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  Absolute
                </button>
                <button
                  type="button"
                  disabled={isLocked || otherSequenceIds.length === 0}
                  onClick={() => handleToggleStartRelational(true)}
                  title={otherSequenceIds.length === 0 ? "Requires ≥2 sequences" : "Switch to Relational timing"}
                  className={`px-1.5 py-0.5 text-[9px] rounded font-medium transition-colors ${isLocked || otherSequenceIds.length === 0 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    } ${isStartRelational
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
                    disabled={isLocked}
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
                      disabled={isLocked}
                      onChange={(e) => {
                        const mode = e.target.value as 'after' | 'syncWith';
                        const newRel = mode === 'syncWith'
                          ? { syncWith: relStartTarget, offsetFrames: relStartOffset }
                          : { after: relStartTarget, offsetFrames: relStartOffset, overlapFrames: relStartOverlap };
                        IRStateManager.getInstance().updateSequenceProps(selectedSeqId, {
                          time: { ...selectedSeq.time, start: newRel },
                        });
                      }}
                      className="w-full h-6 text-[10px] bg-background border border-border/50 rounded px-1 text-foreground disabled:cursor-not-allowed"
                    >
                      <option value="after">after (sequential)</option>
                      <option value="syncWith">syncWith (parallel)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Target Sequence</label>
                    <select
                      value={relStartTarget}
                      disabled={isLocked}
                      onChange={(e) => {
                        const target = e.target.value;
                        const newRel = relStartType === 'syncWith'
                          ? { syncWith: target, offsetFrames: relStartOffset }
                          : { after: target, offsetFrames: relStartOffset, overlapFrames: relStartOverlap };
                        IRStateManager.getInstance().updateSequenceProps(selectedSeqId, {
                          time: { ...selectedSeq.time, start: newRel },
                        });
                      }}
                      className="w-full h-6 text-[10px] bg-background border border-border/50 rounded px-1 font-mono text-foreground disabled:cursor-not-allowed"
                    >
                      {otherSequenceIds.map((id) => (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-border/30">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Offset (Frames)</label>
                    <Input
                      type="number"
                      disabled={isLocked}
                      value={relStartOffset}
                      onChange={(e) => {
                        const offset = parseInt(e.target.value) || 0;
                        const newRel = relStartType === 'syncWith'
                          ? { syncWith: relStartTarget, offsetFrames: offset }
                          : { after: relStartTarget, offsetFrames: offset, overlapFrames: relStartOverlap };
                        IRStateManager.getInstance().updateSequenceProps(selectedSeqId, {
                          time: { ...selectedSeq.time, start: newRel },
                        });
                      }}
                      className="h-6 text-[10px] font-mono bg-background"
                    />
                  </div>
                  {relStartType === 'after' && (
                    <div>
                      <label className="text-[10px] text-muted-foreground">Overlap (Frames)</label>
                      <Input
                        type="number"
                        min={0}
                        disabled={isLocked}
                        value={relStartOverlap}
                        onChange={(e) => {
                          const overlap = Math.max(0, parseInt(e.target.value) || 0);
                          const newRel = {
                            after: relStartTarget,
                            offsetFrames: relStartOffset,
                            overlapFrames: overlap,
                          };
                          IRStateManager.getInstance().updateSequenceProps(selectedSeqId, {
                            time: { ...selectedSeq.time, start: newRel },
                          });
                        }}
                        className="h-6 text-[10px] font-mono bg-background"
                      />
                    </div>
                  )}
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
                  disabled={isLocked}
                  onClick={() => handleToggleDurationRelational(false)}
                  className={`px-1.5 py-0.5 text-[9px] rounded font-medium transition-colors ${isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    } ${!isDurationRelational
                      ? 'bg-accent-theme text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  Absolute
                </button>
                <button
                  type="button"
                  disabled={isLocked || otherSequenceIds.length === 0}
                  onClick={() => handleToggleDurationRelational(true)}
                  title={otherSequenceIds.length === 0 ? "Requires ≥2 sequences" : "Switch to Relational duration"}
                  className={`px-1.5 py-0.5 text-[9px] rounded font-medium transition-colors ${isLocked || otherSequenceIds.length === 0 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    } ${isDurationRelational
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
                    disabled={isLocked}
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
                    disabled={isLocked}
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

                {!relDurMatchAsset && (
                  <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-border/30">
                    <div>
                      <label className="text-[10px] text-muted-foreground">Target</label>
                      <select
                        value={relDurTarget}
                        disabled={isLocked}
                        onChange={(e) => {
                          const target = e.target.value;
                          IRStateManager.getInstance().updateSequenceProps(selectedSeqId, {
                            time: {
                              ...selectedSeq.time,
                              duration: { matchLengthOf: target, paddingFrames: relDurPadding },
                            },
                          });
                        }}
                        className="w-full h-6 text-[10px] bg-background border border-border/50 rounded px-1 font-mono text-foreground disabled:cursor-not-allowed"
                      >
                        {otherSequenceIds.map((id) => (
                          <option key={id} value={id}>
                            {id}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Padding (Frames)</label>
                      <Input
                        type="number"
                        disabled={isLocked}
                        value={relDurPadding}
                        onChange={(e) => {
                          const padding = parseInt(e.target.value) || 0;
                          IRStateManager.getInstance().updateSequenceProps(selectedSeqId, {
                            time: {
                              ...selectedSeq.time,
                              duration: { matchLengthOf: relDurTarget || otherSequenceIds[0] || '', paddingFrames: padding },
                            },
                          });
                        }}
                        className="h-6 text-[10px] font-mono bg-background"
                      />
                    </div>
                  </div>
                )}
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
                disabled={isLocked}
                onClick={() => setIsCueDialogOpen(true)}
                className="h-5 px-1.5 text-[10px] text-accent-theme hover:bg-accent-theme/10 cursor-pointer disabled:cursor-not-allowed"
              >
                Manage Cues
              </Button>
            </div>
            {selectedSeq?.cues && selectedSeq.cues.length > 0 && (
              <div className="p-1.5 rounded bg-muted/30 border border-border/30 text-[10px] text-muted-foreground flex items-center justify-between">
                <span className="truncate max-w-[180px] italic">
                  &ldquo;{selectedSeq.cues[0]?.text}&rdquo;
                </span>
                <span className="font-mono text-[9px] shrink-0">
                  {selectedSeq.cues.length} cue{selectedSeq.cues.length > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {/* A/V Link Status & Controls */}
        {(() => {
          const avLink = modifiers.find((m: any) => m.type === 'editorial/av_link');
          if (!avLink) return null;
          const isLinked = avLink.params?.enabled !== false;
          const partnerId = avLink.params?.linkedSequenceId;
          const partnerTrack = avLink.params?.linkedTrackId;
          return (
            <div className="pt-2 border-t border-border/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[11px] text-foreground/90 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                  Linked Audio / Video
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLocked}
                  onClick={() => {
                    const newEnabled = !isLinked;
                    updateModifierParams('editorial/av_link', {
                      ...avLink.params,
                      enabled: newEnabled,
                    });
                    if (partnerId) {
                      IRStateManager.getInstance().updateModifier(partnerId, 'editorial/av_link', {
                        ...avLink.params,
                        linkedSequenceId: selectedSeqId,
                        linkedTrackId: selectedTrack?.id,
                        enabled: newEnabled,
                      });
                    }
                  }}
                  className={`h-5 px-2 text-[10px] gap-1 cursor-pointer transition-colors ${isLinked
                    ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/60'
                    : 'border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted'
                    }`}
                >
                  {isLinked ? (
                    <>
                      <Link2 className="w-2.5 h-2.5" />
                      Linked
                    </>
                  ) : (
                    <>
                      <Unlink className="w-2.5 h-2.5" />
                      Unlinked
                    </>
                  )}
                </Button>
              </div>
              <div className="p-1.5 rounded bg-muted/30 border border-border/30 text-[10px] text-muted-foreground flex items-center justify-between">
                <span>Partner: <span className="font-mono text-foreground font-medium">{partnerId}</span></span>
                <span className="font-mono text-[9px] uppercase px-1 py-0.5 rounded bg-muted">{partnerTrack}</span>
              </div>
            </div>
          );
        })()}

        {/* Action Bar */}
        <div className="flex items-center gap-1 pt-2 border-t border-border/40">
          <Button
            variant="outline"
            size="sm"
            disabled={isLocked}
            onClick={handleDuplicate}
            className="flex-1 h-6 text-[10px] gap-1 text-foreground hover:bg-accent-theme/10 hover:text-accent-theme border-border/50 cursor-pointer disabled:cursor-not-allowed"
            title="Duplicate sequence"
          >
            <CopyPlus className="w-3 h-3" />
            Duplicate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLocked(!isLocked)}
            className={`h-6 px-2 text-[10px] gap-1 border-border/50 cursor-pointer ${isLocked ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300' : 'text-muted-foreground'
              }`}
            title={isLocked ? 'Locked (Click to unlock)' : 'Unlocked (Click to lock)'}
          >
            {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isLocked}
            onClick={handleDelete}
            className="h-6 px-2 text-[10px] text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200 cursor-pointer disabled:cursor-not-allowed"
            title="Delete sequence (undoable)"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isLocked}
            onClick={() => {
              if (!selectedSeqId) return;
              IRStateManager.getInstance().rippleDeleteSequence(selectedSeqId);
            }}
            className="h-6 px-2 text-[10px] text-amber-600 hover:bg-amber-50 hover:text-amber-700 border-amber-200 cursor-pointer disabled:cursor-not-allowed"
            title="Ripple Delete (Closes track gap, undoable)"
          >
            Ripple Del
          </Button>
        </div>
      </Card>

      {/* Pure Attached-Only Empty State */}
      {modifiers.length === 0 && (
        <div className="p-6 border-2 border-dashed border-border/60 rounded-lg text-center space-y-2.5 text-muted-foreground bg-muted/20">
          <Sliders className="w-8 h-8 mx-auto text-muted-foreground/60" />
          <p className="text-xs font-semibold text-foreground/90">
            No Effects Attached
          </p>
          <p className="text-[11px] text-muted-foreground max-w-[220px] mx-auto">
            Click &ldquo;+ Add Effect&rdquo; above to attach visual, audio, or motion modifiers to this sequence.
          </p>
          {onAddEffectClick && (
            <Button
              variant="outline"
              size="sm"
              disabled={isLocked}
              onClick={onAddEffectClick}
              className="h-7 text-xs gap-1.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950/40 cursor-pointer disabled:cursor-not-allowed mx-auto"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Add First Effect
            </Button>
          )}
        </div>
      )}

      {/* Dynamic Modifiers Accordion Engine */}
      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="border-[var(--glass-border)] space-y-2"
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
              className="rounded-md overflow-hidden bg-card shadow-2xs border-[var(--glass-border)]"
            >
              <AccordionTrigger
                actions={
                  <div className="flex items-center gap-1">
                    {/* Reset button if available */}
                    {catalogEntry?.defaultParams && (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isLocked}
                        className="h-6 w-6 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer disabled:cursor-not-allowed"
                        onClick={() =>
                          !isLocked &&
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
                      disabled={isLocked}
                      className="h-6 w-6 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer disabled:cursor-not-allowed"
                      onClick={() => !isLocked && removeModifier(mod.type)}
                      title="Remove modifier"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500" />
                    </Button>
                    <Switch
                      checked={isEnabled}
                      disabled={isLocked}
                      onCheckedChange={(checked) =>
                        !isLocked &&
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
                {sectionId === 'transitions' && (() => {
                  const transDur = mod.params?.durationFrames ?? 15;
                  const seqDur = selectedSeq?.durationFrames ?? 90;
                  const hasInsufficientHead = transDur > seqDur;
                  if (hasInsufficientHead) {
                    return (
                      <div className="flex items-start gap-1.5 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[10px]">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          <strong>Insufficient Media Handles:</strong> Transition duration ({transDur}f) exceeds sequence duration ({seqDur}f). Clip may freeze or clip abruptly.
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
                <DynamicModifierInspector
                  modifierType={mod.type}
                  params={mod.params || {}}
                  disabled={isLocked || !isEnabled}
                  onChange={(nextParams) => !isLocked && updateModifierParams(mod.type, nextParams)}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Subtitle Cue Timeline Management Modal */}
      <CueTimelineDialog
        open={isCueDialogOpen}
        onOpenChange={setIsCueDialogOpen}
        cues={selectedSeq?.cues || []}
        disabled={isLocked}
        onSaveCues={(updatedCues) => {
          if (!selectedSeqId) return;
          IRStateManager.getInstance().updateSequenceProps(selectedSeqId, { cues: updatedCues });
        }}
      />
    </div>
  );
};

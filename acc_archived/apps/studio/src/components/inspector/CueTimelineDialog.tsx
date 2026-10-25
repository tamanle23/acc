import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Plus, Trash2, Copy, Type, Clock } from 'lucide-react';
import type { TimedTextCue } from '@acc/ir';

export interface CueTimelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cues: TimedTextCue[];
  onSaveCues: (updatedCues: TimedTextCue[]) => void;
  disabled?: boolean;
}

export const CueTimelineDialog: React.FC<CueTimelineDialogProps> = ({
  open,
  onOpenChange,
  cues,
  onSaveCues,
  disabled = false,
}) => {
  const [localCues, setLocalCues] = useState<TimedTextCue[]>(cues);

  // Sync with prop when dialog opens
  React.useEffect(() => {
    if (open) {
      setLocalCues(cues ? [...cues] : []);
    }
  }, [open, cues]);

  const handleCueTextChange = (index: number, text: string) => {
    setLocalCues((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], text };
      return next;
    });
  };

  const handleCueTimingChange = (
    index: number,
    field: 'startOffsetMs' | 'endOffsetMs',
    valueStr: string
  ) => {
    const val = parseInt(valueStr, 10);
    setLocalCues((prev) => {
      const next = [...prev];
      if (field === 'startOffsetMs') {
        next[index] = { ...next[index], startOffsetMs: Number.isNaN(val) ? 0 : Math.max(0, val) };
      } else {
        next[index] = { ...next[index], endOffsetMs: Number.isNaN(val) ? 0 : Math.max(0, val) };
      }
      return next;
    });
  };

  const handleAddCue = () => {
    setLocalCues((prev) => {
      const lastEnd =
        prev.length > 0 && typeof prev[prev.length - 1].endOffsetMs === 'number'
          ? (prev[prev.length - 1].endOffsetMs as number)
          : 0;
      return [
        ...prev,
        {
          startOffsetMs: lastEnd,
          endOffsetMs: lastEnd + 1500,
          text: `New subtitle cue ${prev.length + 1}...`,
        },
      ];
    });
  };

  const handleDuplicateCue = (index: number) => {
    setLocalCues((prev) => {
      const target = prev[index];
      const cueDuration =
        typeof target.endOffsetMs === 'number'
          ? Math.max(500, target.endOffsetMs - target.startOffsetMs)
          : 1500;
      const newStart = typeof target.endOffsetMs === 'number' ? target.endOffsetMs : target.startOffsetMs;
      const duplicated: TimedTextCue = {
        startOffsetMs: newStart,
        endOffsetMs: newStart + cueDuration,
        text: `${target.text} (Copy)`,
      };
      const next = [...prev];
      next.splice(index + 1, 0, duplicated);
      return next;
    });
  };

  const handleDeleteCue = (index: number) => {
    setLocalCues((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveAndClose = () => {
    // Sort cues chronologically by startOffsetMs
    const sorted = [...localCues].sort((a, b) => a.startOffsetMs - b.startOffsetMs);
    onSaveCues(sorted);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl glass-panel border-glass-border text-foreground shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Type className="w-4 h-4 text-accent-theme" />
            Manage Timed Text Subtitle Cues
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure phrase text, start offset, and end offset in milliseconds for this sequence.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-glass-border">
            <span className="text-xs font-medium text-foreground">
              Total Cues: {localCues.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={handleAddCue}
              className="h-7 text-xs gap-1 cursor-pointer border-accent-theme/40 text-accent-theme bg-accent-theme/10 hover:bg-accent-theme/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Cue
            </Button>
          </div>

          <ScrollArea className="max-h-[360px] pr-2">
            {localCues.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-glass-border rounded-lg space-y-2 bg-muted/20">
                <Clock className="w-8 h-8 mx-auto text-muted-foreground/60" />
                <p className="text-xs font-semibold text-foreground">No Subtitle Cues</p>
                <p className="text-[11px] text-muted-foreground">
                  Click "+ Add Cue" above to insert your first timed subtitle cue.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {localCues.map((cue, idx) => {
                  const durationMs =
                    typeof cue.endOffsetMs === 'number'
                      ? cue.endOffsetMs - cue.startOffsetMs
                      : 0;

                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded-md border border-glass-border bg-glass-surface hover:bg-muted/40 transition-colors space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                          #{idx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground">
                            Duration: {durationMs > 0 ? `${durationMs}ms` : 'end'}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={disabled}
                            onClick={() => handleDuplicateCue(idx)}
                            className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Duplicate Cue"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={disabled}
                            onClick={() => handleDeleteCue(idx)}
                            className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                            title="Delete Cue"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-7">
                          <label className="text-[10px] text-muted-foreground block mb-0.5">
                            Subtitle Text
                          </label>
                          <Input
                            type="text"
                            value={cue.text}
                            disabled={disabled}
                            onChange={(e) => handleCueTextChange(idx, e.target.value)}
                            placeholder="Subtitle text..."
                            className="h-7 text-xs bg-background border-glass-border"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] text-muted-foreground block mb-0.5">
                            Start (ms)
                          </label>
                          <Input
                            type="number"
                            min={0}
                            step={100}
                            value={cue.startOffsetMs}
                            disabled={disabled}
                            onChange={(e) => handleCueTimingChange(idx, 'startOffsetMs', e.target.value)}
                            className="h-7 text-xs font-mono bg-background border-glass-border"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="text-[10px] text-muted-foreground block mb-0.5">
                            End (ms)
                          </label>
                          <Input
                            type="number"
                            min={0}
                            step={100}
                            value={typeof cue.endOffsetMs === 'number' ? cue.endOffsetMs : 0}
                            disabled={disabled}
                            onChange={(e) => handleCueTimingChange(idx, 'endOffsetMs', e.target.value)}
                            className="h-7 text-xs font-mono bg-background border-glass-border"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 border-t border-glass-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={disabled}
            onClick={handleSaveAndClose}
            className="h-8 text-xs cursor-pointer bg-accent-theme text-primary-foreground hover:bg-accent-theme/90"
          >
            Save Cues
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

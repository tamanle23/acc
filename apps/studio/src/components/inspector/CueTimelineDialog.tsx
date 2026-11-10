import { createSignal, createEffect, Show, For } from 'solid-js';
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
import { Plus, Trash2, Copy, Type, Clock } from 'lucide-solid';
import type { TimedTextCue } from '@acc/ir';

export interface CueTimelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cues: TimedTextCue[];
  onSaveCues: (updatedCues: TimedTextCue[]) => void;
  disabled?: boolean;
}

export function CueTimelineDialog(props: CueTimelineDialogProps) {
  const [localCues, setLocalCues] = createSignal<TimedTextCue[]>(props.cues ? [...props.cues] : []);

  // Sync with prop when dialog opens
  createEffect(() => {
    if (props.open) {
      setLocalCues(props.cues ? [...props.cues] : []);
    }
  });

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
    const sorted = [...localCues()].sort((a, b) => a.startOffsetMs - b.startOffsetMs);
    props.onSaveCues(sorted);
    props.onOpenChange(false);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent class="max-w-2xl glass-panel border-glass-border text-foreground shadow-2xl">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2 text-sm font-bold text-foreground">
            <Type class="w-4 h-4 text-accent-theme" />
            Manage Timed Text Subtitle Cues
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            Configure phrase text, start offset, and end offset in milliseconds for this sequence.
          </DialogDescription>
        </DialogHeader>

        <div class="py-2 space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-glass-border">
            <span class="text-xs font-medium text-foreground">
              Total Cues: {localCues().length}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={props.disabled}
              onClick={handleAddCue}
              class="h-7 text-xs gap-1 cursor-pointer border-accent-theme/40 text-accent-theme bg-accent-theme/10 hover:bg-accent-theme/20"
            >
              <Plus class="w-3.5 h-3.5" />
              Add Cue
            </Button>
          </div>

          <ScrollArea class="max-h-[360px] pr-2">
            <Show
              when={localCues().length > 0}
              fallback={
                <div class="p-8 text-center border-2 border-dashed border-glass-border rounded-lg space-y-2 bg-muted/20">
                  <Clock class="w-8 h-8 mx-auto text-muted-foreground/60" />
                  <p class="text-xs font-semibold text-foreground">No Subtitle Cues</p>
                  <p class="text-[11px] text-muted-foreground">
                    Click "+ Add Cue" above to insert your first timed subtitle cue.
                  </p>
                </div>
              }
            >
              <div class="space-y-2.5">
                <For each={localCues()}>
                  {(cue, idx) => {
                    const durationMs = () =>
                      typeof cue.endOffsetMs === 'number'
                        ? cue.endOffsetMs - cue.startOffsetMs
                        : 0;

                    return (
                      <div
                        class="p-2.5 rounded-md border border-glass-border bg-glass-surface hover:bg-muted/40 transition-colors space-y-2 text-xs"
                      >
                        <div class="flex items-center justify-between gap-2">
                          <span class="font-mono text-[10px] text-muted-foreground font-semibold">
                            #{idx() + 1}
                          </span>
                          <div class="flex items-center gap-2">
                            <span class="text-[10px] font-mono text-muted-foreground">
                              Duration: {durationMs() > 0 ? `${durationMs()}ms` : 'end'}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={props.disabled}
                              onClick={() => handleDuplicateCue(idx())}
                              class="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                              title="Duplicate Cue"
                            >
                              <Copy class="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={props.disabled}
                              onClick={() => handleDeleteCue(idx())}
                              class="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                              title="Delete Cue"
                            >
                              <Trash2 class="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        <div class="grid grid-cols-12 gap-2 items-center">
                          <div class="col-span-7">
                            <label class="text-[10px] text-muted-foreground block mb-0.5">
                              Subtitle Text
                            </label>
                            <Input
                              type="text"
                              value={cue.text}
                              disabled={props.disabled}
                              onInput={(e) => handleCueTextChange(idx(), e.currentTarget.value)}
                              placeholder="Subtitle text..."
                              class="h-7 text-xs bg-background border-glass-border"
                            />
                          </div>
                          <div class="col-span-2">
                            <label class="text-[10px] text-muted-foreground block mb-0.5">
                              Start (ms)
                            </label>
                            <Input
                              type="number"
                              min={0}
                              step={100}
                              value={cue.startOffsetMs}
                              disabled={props.disabled}
                              onInput={(e) => handleCueTimingChange(idx(), 'startOffsetMs', e.currentTarget.value)}
                              class="h-7 text-xs font-mono bg-background border-glass-border"
                            />
                          </div>
                          <div class="col-span-3">
                            <label class="text-[10px] text-muted-foreground block mb-0.5">
                              End (ms)
                            </label>
                            <Input
                              type="number"
                              min={0}
                              step={100}
                              value={typeof cue.endOffsetMs === 'number' ? cue.endOffsetMs : 0}
                              disabled={props.disabled}
                              onInput={(e) => handleCueTimingChange(idx(), 'endOffsetMs', e.currentTarget.value)}
                              class="h-7 text-xs font-mono bg-background border-glass-border"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>
          </ScrollArea>
        </div>

        <DialogFooter class="flex items-center justify-between sm:justify-between pt-2 border-t border-glass-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => props.onOpenChange(false)}
            class="h-8 text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={props.disabled}
            onClick={handleSaveAndClose}
            class="h-8 text-xs cursor-pointer bg-accent-theme text-primary-foreground hover:bg-accent-theme/90"
          >
            Save Cues
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

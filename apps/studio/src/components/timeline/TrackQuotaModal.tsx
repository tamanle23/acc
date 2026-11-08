import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { AlertTriangle, Layers } from 'lucide-solid';
import type { SemanticTrackRole } from '@acc/ir';

export interface TrackQuotaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmOverride: () => void;
  role: SemanticTrackRole;
  currentCount: number;
  hardCap: number;
  softCap: number;
}

export function TrackQuotaModal(props: TrackQuotaModalProps) {
  const roleName = () => props.role.charAt(0).toUpperCase() + props.role.slice(1);

  return (
    <Dialog open={props.isOpen} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent class="sm:max-w-md glass-panel text-foreground border-[var(--glass-border)] p-6 rounded-2xl shadow-2xl backdrop-blur-2xl">
        <DialogHeader class="pb-3 border-b border-[var(--glass-border)]">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-xs">
              <AlertTriangle class="w-5 h-5" />
            </div>
            <div>
              <DialogTitle class="text-base font-semibold text-foreground flex items-center gap-2">
                High Compositing Load Detected
              </DialogTitle>
              <DialogDescription class="text-xs text-muted-foreground mt-0.5">
                Hardware resource warning for {roleName()} tracks
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div class="py-4 space-y-3">
          <p class="text-xs text-foreground/90 leading-relaxed">
            The timeline currently contains{' '}
            <strong class="text-amber-300 font-semibold">{props.currentCount}</strong> {roleName().toLowerCase()}{' '}
            tracks. The recommended hard cap is{' '}
            <strong class="text-foreground font-semibold">{props.hardCap}</strong> (soft cap: {props.softCap}).
          </p>

          <div class="rounded-xl p-3 bg-black/20 border border-white/5 space-y-2">
            <div class="flex items-center gap-2 text-[11px] font-medium text-amber-300/90">
              <Layers class="w-3.5 h-3.5 shrink-0" />
              <span>Performance Impact</span>
            </div>
            <p class="text-[11px] text-muted-foreground leading-normal">
              Spawning excessive tracks increases GPU texture allocation, risks WebGL context loss, and may
              cause dropped frames during live canvas compositing.
            </p>
          </div>

          <p class="text-[11px] text-muted-foreground/80 italic">
            You can proceed by using whitespace on existing tracks or manually override this guardrail if your
            hardware can handle the load.
          </p>
        </div>

        <DialogFooter class="pt-3 border-t border-[var(--glass-border)] flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={props.onClose}
            class="text-xs h-8 px-3 text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={() => {
              props.onConfirmOverride();
              props.onClose();
            }}
            class="text-xs h-8 px-3.5 bg-amber-500/25 border border-amber-500/40 text-amber-200 hover:bg-amber-500/40 hover:text-amber-100 font-medium transition-all shadow-xs"
          >
            Add Track Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

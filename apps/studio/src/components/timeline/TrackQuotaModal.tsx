import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { AlertTriangle, Layers } from 'lucide-react';
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

export function TrackQuotaModal({
  isOpen,
  onClose,
  onConfirmOverride,
  role,
  currentCount,
  hardCap,
  softCap,
}: TrackQuotaModalProps) {
  const roleName = role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md glass-panel text-foreground border-[var(--glass-border)] p-6 rounded-2xl shadow-2xl backdrop-blur-2xl">
        <DialogHeader className="pb-3 border-b border-[var(--glass-border)]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                High Compositing Load Detected
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Hardware resource warning for {roleName} tracks
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <p className="text-xs text-foreground/90 leading-relaxed">
            The timeline currently contains{' '}
            <strong className="text-amber-300 font-semibold">{currentCount}</strong> {roleName.toLowerCase()}{' '}
            tracks. The recommended hard cap is{' '}
            <strong className="text-foreground font-semibold">{hardCap}</strong> (soft cap: {softCap}).
          </p>

          <div className="rounded-xl p-3 bg-black/20 border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-medium text-amber-300/90">
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>Performance Impact</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              Spawning excessive tracks increases GPU texture allocation, risks WebGL context loss, and may
              cause dropped frames during live canvas compositing.
            </p>
          </div>

          <p className="text-[11px] text-muted-foreground/80 italic">
            You can proceed by using whitespace on existing tracks or manually override this guardrail if your
            hardware can handle the load.
          </p>
        </div>

        <DialogFooter className="pt-3 border-t border-[var(--glass-border)] flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-xs h-8 px-3 text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={() => {
              onConfirmOverride();
              onClose();
            }}
            className="text-xs h-8 px-3.5 bg-amber-500/25 border border-amber-500/40 text-amber-200 hover:bg-amber-500/40 hover:text-amber-100 font-medium transition-all shadow-xs"
          >
            Add Track Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Component, For, Show } from "solid-js";
import {
  AlertTriangle,
  PowerOff,
  Zap,
  X,
  ShieldCheck,
  Clock,
} from "lucide-solid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface EvictionCandidate {
  engine_id: string;
  model_id: string;
  vram_mb: number;
  pinned: boolean;
  idle_seconds: number;
}

export interface VramEvictionRequest {
  engineId: string;
  modelId?: string;
  requiredVramMb: number;
  currentVramMb: number;
  budgetCeilingMb: number;
  candidates: EvictionCandidate[];
}

export interface VramEvictionModalProps {
  isOpen: boolean;
  evictionRequest: VramEvictionRequest | null;
  isSubmitting: boolean;
  onConfirmEvictAndMount: (engineId: string) => Promise<void>;
  onFallbackToHostRam: (engineId: string) => Promise<void>;
  onClose: () => void;
}

export const VramEvictionModal: Component<VramEvictionModalProps> = (props) => {
  const req = () => props.evictionRequest;

  const totalReclaimedMb = () =>
    req()?.candidates.reduce((acc, c) => acc + c.vram_mb, 0) ?? 0;

  const projectedAfterEvictionMb = () => {
    const r = req();
    if (!r) return 0;
    return Math.max(0, r.currentVramMb - totalReclaimedMb() + r.requiredVramMb);
  };

  const ceilingPct = () => {
    const r = req();
    if (!r) return 0;
    return Math.round(
      ((r.currentVramMb + r.requiredVramMb) / Math.max(1, r.budgetCeilingMb)) * 100
    );
  };

  const projectedPct = () => {
    const r = req();
    if (!r) return 0;
    return Math.round(
      (projectedAfterEvictionMb() / Math.max(1, r.budgetCeilingMb)) * 100
    );
  };

  return (
    <Show when={props.isOpen && props.evictionRequest}>
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div class="relative w-full max-w-2xl rounded-2xl border border-warning/40 bg-card p-6 shadow-2xl text-card-foreground ring-1 ring-warning/20">
          {/* Header */}
          <div class="flex items-start justify-between border-b border-border pb-4">
            <div class="flex items-center gap-3">
              <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/20 text-warning ring-1 ring-warning/40">
                <AlertTriangle class="h-6 w-6" />
              </div>
              <div>
                <h3 class="text-lg font-bold text-foreground flex items-center gap-2">
                  VRAM Budget Ceiling Approaching
                  <Badge
                    variant="outline"
                    class="border-warning/40 bg-warning/15 text-warning font-mono text-xs font-semibold"
                  >
                    {ceilingPct()}% Projected
                  </Badge>
                </h3>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Physical GPU Allocation Budget Guard (RTX 4070 Ti • 85% Safety Ceiling)
                </p>
              </div>
            </div>
            <button
              onClick={props.onClose}
              disabled={props.isSubmitting}
              class="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          {/* Target Request Info */}
          <div class="mt-4 rounded-xl border border-border bg-surface p-4">
            <div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Target Model to Mount
            </div>
            <div class="flex items-center justify-between">
              <div>
                <div class="font-mono text-sm font-bold text-warning">
                  {req()?.engineId}
                </div>
                <div class="text-xs text-muted-foreground">
                  {req()?.modelId || req()?.engineId}
                </div>
              </div>
              <div class="text-right">
                <div class="text-sm font-bold text-warning font-mono">
                  +{req()?.requiredVramMb} MB
                </div>
                <div class="text-[11px] text-muted-foreground">
                  GPU VRAM Only Mode
                </div>
              </div>
            </div>
          </div>

          {/* VRAM Pressure Comparison */}
          <div class="mt-4 space-y-2">
            <div class="flex justify-between text-xs">
              <span class="text-muted-foreground">Current VRAM Allocated:</span>
              <span class="font-mono text-foreground font-semibold">
                {req()?.currentVramMb} MB / {req()?.budgetCeilingMb} MB
              </span>
            </div>
            {/* Progress Bar with projected overload */}
            <div class="h-2.5 w-full rounded-full bg-secondary overflow-hidden relative border border-border/50">
              <div
                class="h-full bg-success transition-all duration-300"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      ((req()?.currentVramMb ?? 0) /
                        Math.max(1, req()?.budgetCeilingMb ?? 1)) *
                        100
                    )
                  )}%`,
                }}
              />
              <Show when={ceilingPct() > 100}>
                <div
                  class="absolute top-0 right-0 h-full bg-destructive animate-pulse"
                  style={{ width: `${Math.min(100, ceilingPct() - 100)}%` }}
                />
              </Show>
            </div>
          </div>

          {/* Candidates Table */}
          <div class="mt-5">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <PowerOff class="h-3.5 w-3.5 text-warning" />
                Eligible Idle Candidate(s) to Evict to Disk
              </span>
              <span class="text-xs font-mono text-success font-semibold">
                Reclaims {totalReclaimedMb()} MB VRAM
              </span>
            </div>

            <div class="rounded-xl border border-border bg-surface divide-y divide-border overflow-hidden">
              <For each={req()?.candidates}>
                {(cand) => (
                  <div class="flex items-center justify-between p-3 text-xs hover:bg-secondary/40 transition-colors">
                    <div class="space-y-0.5">
                      <div class="font-mono font-semibold text-foreground">
                        {cand.engine_id}
                      </div>
                      <div class="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span class="flex items-center gap-1">
                          <Clock class="h-3 w-3 text-muted-foreground/80" />
                          Idle for{" "}
                          {Math.floor(cand.idle_seconds / 60) > 0
                            ? `${Math.floor(cand.idle_seconds / 60)}m `
                            : ""}
                          {Math.floor(cand.idle_seconds % 60)}s
                        </span>
                        <span>•</span>
                        <span class="flex items-center gap-1 text-success font-medium">
                          <ShieldCheck class="h-3 w-3" />
                          Unpinned (Safe to evict)
                        </span>
                      </div>
                    </div>
                    <div class="text-right">
                      <Badge
                        variant="outline"
                        class="border-destructive/40 bg-destructive/10 text-destructive font-mono text-xs"
                      >
                        -{cand.vram_mb} MB VRAM
                      </Badge>
                      <div class="text-[10px] text-muted-foreground mt-0.5">
                        Preserved on Disk Cache
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>

          {/* Projection summary */}
          <div class="mt-4 flex items-center justify-between rounded-xl bg-success/10 border border-success/30 px-3.5 py-2.5 text-xs">
            <span class="text-foreground">Projected VRAM with Eviction:</span>
            <span class="font-mono font-bold text-success flex items-center gap-1">
              {projectedAfterEvictionMb()} MB ({projectedPct()}% of Ceiling)
              <ShieldCheck class="h-4 w-4" />
            </span>
          </div>

          {/* Action Buttons */}
          <div class="mt-6 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-border pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={props.onClose}
              disabled={props.isSubmitting}
              class="w-full sm:w-auto text-xs text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const r = req();
                if (r) props.onFallbackToHostRam(r.engineId);
              }}
              disabled={props.isSubmitting}
              class="w-full sm:w-auto text-xs border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1.5"
            >
              <Zap class="h-3.5 w-3.5 text-primary" />
              Mount to Host RAM Instead (0 MB VRAM)
            </Button>

            <Button
              type="button"
              onClick={() => {
                const r = req();
                if (r) props.onConfirmEvictAndMount(r.engineId);
              }}
              disabled={props.isSubmitting}
              class="w-full sm:w-auto text-xs bg-warning hover:bg-warning/90 text-warning-foreground font-bold shadow-lg shadow-warning/20 flex items-center gap-1.5"
            >
              <PowerOff class="h-3.5 w-3.5" />
              Evict Idle & Mount VRAM
            </Button>
          </div>
        </div>
      </div>
    </Show>
  );
};

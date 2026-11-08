import { Sparkles, CheckCircle2, XCircle, AlertTriangle, Layers, Film, Box } from 'lucide-solid';
import { Show, For } from 'solid-js';
import type { IRDiagnosticsReport } from '../types';

export interface DiagnosticTelemetryCardProps {
  diagnostics: IRDiagnosticsReport;
  isFullyValid: boolean;
  onQuickRepairDanglingAnchors?: () => void;
}

export function DiagnosticTelemetryCard(props: DiagnosticTelemetryCardProps) {
  return (
    <div class="w-80 border-l border-[var(--glass-border)] bg-[var(--glass-bg)]/40 p-3.5 overflow-y-auto space-y-3.5 shrink-0 font-mono text-xs backdrop-blur-xs">
      <div class="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
        <Sparkles class="w-3.5 h-3.5 text-[var(--accent-primary)]" />
        Live AST Telemetry
      </div>

      {/* Grid of Key Metrics */}
      <div class="grid grid-cols-2 gap-2">
        <div class="p-2 rounded-lg glass-card border border-[var(--glass-border)]">
          <div class="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
            <Layers class="w-3 h-3 text-muted-foreground" />
            Tracks
          </div>
          <div class="text-sm font-bold font-mono text-foreground mt-0.5">
            {props.diagnostics.trackCount}
          </div>
        </div>

        <div class="p-2 rounded-lg glass-card border border-[var(--glass-border)]">
          <div class="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
            <Film class="w-3 h-3 text-[var(--accent-primary)]" />
            Sequences
          </div>
          <div class="text-sm font-bold font-mono text-foreground mt-0.5">
            {props.diagnostics.sequenceCount}
          </div>
        </div>

        <div class="p-2 rounded-lg glass-card border border-[var(--glass-border)]">
          <div class="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
            <Sparkles class="w-3 h-3 text-purple-400" />
            Modifiers
          </div>
          <div class="text-sm font-bold font-mono text-purple-400 mt-0.5">
            {props.diagnostics.modifierCount}
          </div>
        </div>

        <div class="p-2 rounded-lg glass-card border border-[var(--glass-border)]">
          <div class="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
            <Box class="w-3 h-3 text-emerald-400" />
            Assets
          </div>
          <div class="text-sm font-bold font-mono text-emerald-400 mt-0.5">
            {props.diagnostics.assetCount}
          </div>
        </div>
      </div>

      {/* Validation Status Notice */}
      <Show
        when={props.isFullyValid}
        fallback={
          <div class="space-y-2">
            {/* Schema Errors */}
            <Show when={props.diagnostics.schemaValidation.errors.length > 0}>
              <div class="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 space-y-1.5">
                <div class="text-[11px] font-bold text-rose-300 flex items-center gap-1.5 font-mono">
                  <XCircle class="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  Schema Violations ({props.diagnostics.schemaValidation.errors.length})
                </div>
                <ul class="space-y-1 text-[10px] font-mono text-rose-200/90 list-disc pl-4 max-h-36 overflow-y-auto">
                  <For each={props.diagnostics.schemaValidation.errors}>
                    {(err) => (
                      <li class="break-words">
                        {err}
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            </Show>

            {/* Dangling Relational Anchors */}
            <Show when={props.diagnostics.danglingAnchors.length > 0}>
              <div class="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/40 space-y-1.5">
                <div class="text-[11px] font-bold text-amber-300 flex items-center justify-between font-mono">
                  <span class="flex items-center gap-1.5">
                    <AlertTriangle class="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    Dangling Anchors ({props.diagnostics.danglingAnchors.length})
                  </span>
                  <Show when={props.onQuickRepairDanglingAnchors}>
                    <button
                      type="button"
                      onClick={props.onQuickRepairDanglingAnchors}
                      class="text-[9px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 px-1.5 py-0.5 rounded border border-amber-500/40 cursor-pointer"
                    >
                      Auto Fix
                    </button>
                  </Show>
                </div>
                <ul class="space-y-1 text-[10px] font-mono text-amber-200/90 list-disc pl-4">
                  <For each={props.diagnostics.danglingAnchors}>
                    {(d) => (
                      <li>
                        <code>{d.sequenceId}</code> references missing <code>{d.referenceId}</code>
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            </Show>
          </div>
        }
      >
        <div class="p-2.5 rounded-lg bg-[var(--glass-bg)] border-[var(--glass-border)] focus-visible:ring-[var(--accent-primary)] text-[11px] font-mono flex items-start gap-2">
          <CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <div class="font-semibold text-foreground">Schema & DAG Verified</div>
            <p class="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
              VideoIR Document is 100% compliant with Draft-07 schema and ready to apply.
            </p>
          </div>
        </div>
      </Show>
    </div>
  );
}

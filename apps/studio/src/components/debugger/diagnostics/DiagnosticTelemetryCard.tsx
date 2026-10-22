import React from 'react';
import { Sparkles, CheckCircle2, XCircle, AlertTriangle, Layers, Film, Box } from 'lucide-react';
import { type IRDiagnosticsReport } from '../VisualIRJsonDebuggerModal';

export interface DiagnosticTelemetryCardProps {
  diagnostics: IRDiagnosticsReport;
  isFullyValid: boolean;
  onQuickRepairDanglingAnchors?: () => void;
}

export function DiagnosticTelemetryCard({
  diagnostics,
  isFullyValid,
  onQuickRepairDanglingAnchors,
}: DiagnosticTelemetryCardProps) {
  return (
    <div className="w-80 border-l border-slate-800 bg-slate-900/50 p-3.5 overflow-y-auto space-y-3.5 shrink-0 font-mono text-xs">
      <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
        Live AST Telemetry
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
            <Layers className="w-3 h-3 text-slate-400" />
            Tracks
          </div>
          <div className="text-sm font-bold font-mono text-foreground mt-0.5">
            {diagnostics.trackCount}
          </div>
        </div>

        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
            <Film className="w-3 h-3 text-cyan-400" />
            Sequences
          </div>
          <div className="text-sm font-bold font-mono text-cyan-400 mt-0.5">
            {diagnostics.sequenceCount}
          </div>
        </div>

        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            Modifiers
          </div>
          <div className="text-sm font-bold font-mono text-indigo-400 mt-0.5">
            {diagnostics.modifierCount}
          </div>
        </div>

        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
            <Box className="w-3 h-3 text-emerald-400" />
            Assets
          </div>
          <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
            {diagnostics.assetCount}
          </div>
        </div>
      </div>

      {/* Validation Status Notice */}
      {isFullyValid ? (
        <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-[11px] font-mono text-emerald-300 flex items-start gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-emerald-300">Schema & DAG Verified</div>
            <p className="text-[10px] text-emerald-400/80 mt-0.5 leading-relaxed">
              VideoIR Document is 100% compliant with Draft-07 schema and ready to apply.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Schema Errors */}
          {diagnostics.schemaValidation.errors.length > 0 && (
            <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 space-y-1.5">
              <div className="text-[11px] font-bold text-rose-300 flex items-center gap-1.5 font-mono">
                <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                Schema Violations ({diagnostics.schemaValidation.errors.length})
              </div>
              <ul className="space-y-1 text-[10px] font-mono text-rose-200/90 list-disc pl-4 max-h-36 overflow-y-auto">
                {diagnostics.schemaValidation.errors.map((err, i) => (
                  <li key={i} className="break-words">
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Dangling Relational Anchors */}
          {diagnostics.danglingAnchors.length > 0 && (
            <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/40 space-y-1.5">
              <div className="text-[11px] font-bold text-amber-300 flex items-center justify-between font-mono">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  Dangling Anchors ({diagnostics.danglingAnchors.length})
                </span>
                {onQuickRepairDanglingAnchors && (
                  <button
                    type="button"
                    onClick={onQuickRepairDanglingAnchors}
                    className="text-[9px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 px-1.5 py-0.5 rounded border border-amber-500/40"
                  >
                    Auto Fix
                  </button>
                )}
              </div>
              <ul className="space-y-1 text-[10px] font-mono text-amber-200/90 list-disc pl-4">
                {diagnostics.danglingAnchors.map((d, idx) => (
                  <li key={idx}>
                    <code>{d.sequenceId}</code> references missing <code>{d.referenceId}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

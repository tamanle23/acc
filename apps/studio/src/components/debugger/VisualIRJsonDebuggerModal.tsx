import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Code2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  RotateCcw,
  Sparkles,
  X,
  Columns,
  ListTree,
  FileCode,
  GitBranch,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  VideoIRSchemaValidator,
  type ValidationResult,
  type VideoIRDocument,
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
} from '@acc/ir';
import { IRStateManager } from '../../lib/ir/irState';
import { VisualJsonTreeEditor } from './visual-editor/VisualJsonTreeEditor';
import { ShikiCodeViewer } from './code-editor/ShikiCodeViewer';
import { CodeEditorToolbar } from './code-editor/CodeEditorToolbar';
import { DiagnosticTelemetryCard } from './diagnostics/DiagnosticTelemetryCard';
import type { DebuggerViewMode } from './types';

export interface VisualIRJsonDebuggerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface IRDiagnosticsReport {
  parseError: string | null;
  schemaValidation: ValidationResult;
  trackCount: number;
  sequenceCount: number;
  assetCount: number;
  modifierCount: number;
  unregisteredModifiers: string[];
  danglingAnchors: Array<{ sequenceId: string; referenceId: string }>;
  missingAssets: Array<{ sequenceId: string; assetId: string }>;
}

/**
 * Pure diagnostic analyzer for a raw VideoIR JSON string.
 * Exported for unit and round-trip testing.
 */
export function analyzeVideoIRJson(rawJson: string): {
  parsedDoc: VideoIRDocument | null;
  diagnostics: IRDiagnosticsReport;
} {
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(rawJson) as Record<string, unknown>;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Syntax error in JSON payload';
    return {
      parsedDoc: null,
      diagnostics: {
        parseError: msg || 'Syntax error in JSON payload',
        schemaValidation: { valid: false, errors: [`Syntax Error: ${msg || 'Invalid JSON'}`] },
        trackCount: 0,
        sequenceCount: 0,
        assetCount: 0,
        modifierCount: 0,
        unregisteredModifiers: [],
        danglingAnchors: [],
        missingAssets: [],
      },
    };
  }

  const schemaValidation = VideoIRSchemaValidator.validate(parsed);
  const tracks = Array.isArray(parsed?.tracks) ? (parsed.tracks as Array<Record<string, unknown>>) : [];
  const assetsObj = parsed?.assets && typeof parsed.assets === 'object' ? (parsed.assets as Record<string, unknown>) : {};
  const assetIds = new Set(Object.keys(assetsObj));

  const sequenceIds = new Set<string>();
  let sequenceCount = 0;
  let modifierCount = 0;
  const unregisteredSet = new Set<string>();
  const danglingAnchors: Array<{ sequenceId: string; referenceId: string }> = [];
  const missingAssets: Array<{ sequenceId: string; assetId: string }> = [];

  const registry = ModifierPluginRegistry.getInstance();
  if (registry.listTypes().length === 0) {
    registerCoreModifierPlugins(registry);
  }

  for (const track of tracks) {
    if (Array.isArray(track?.modifiers)) {
      for (const mod of track.modifiers as Array<{ type?: string }>) {
        modifierCount++;
        if (mod?.type && !registry.get(mod.type)) {
          unregisteredSet.add(mod.type);
        }
      }
    }
    const seqs = Array.isArray(track?.sequences) ? (track.sequences as Array<Record<string, unknown>>) : [];
    for (const seq of seqs) {
      sequenceCount++;
      if (typeof seq?.id === 'string') {
        sequenceIds.add(seq.id);
      }
    }
  }

  for (const track of tracks) {
    const seqs = Array.isArray(track?.sequences) ? (track.sequences as Array<Record<string, unknown>>) : [];
    for (const seq of seqs) {
      const seqId = typeof seq?.id === 'string' ? seq.id : 'unknown';
      const timeObj = seq?.time as { start?: { referenceId?: string } } | undefined;
      const refId = timeObj?.start?.referenceId;
      if (typeof refId === 'string' && refId.length > 0 && !sequenceIds.has(refId)) {
        danglingAnchors.push({ sequenceId: seqId, referenceId: refId });
      }
      if (typeof seq?.assetId === 'string' && seq.assetId.length > 0 && !assetIds.has(seq.assetId)) {
        missingAssets.push({ sequenceId: seqId, assetId: seq.assetId });
      }
      if (Array.isArray(seq?.modifiers)) {
        for (const mod of seq.modifiers as Array<{ type?: string }>) {
          modifierCount++;
          if (mod?.type && !registry.get(mod.type)) {
            unregisteredSet.add(mod.type);
          }
        }
      }
    }
  }

  return {
    parsedDoc: parsed as unknown as VideoIRDocument,
    diagnostics: {
      parseError: null,
      schemaValidation,
      trackCount: tracks.length,
      sequenceCount,
      assetCount: assetIds.size,
      modifierCount,
      unregisteredModifiers: Array.from(unregisteredSet),
      danglingAnchors,
      missingAssets,
    },
  };
}

export function VisualIRJsonDebuggerModal({
  open,
  onOpenChange,
}: VisualIRJsonDebuggerModalProps) {
  const manager = IRStateManager.getInstance();
  const [rawJson, setRawJson] = useState<string>(() => manager.exportJSON());
  const [viewMode, setViewMode] = useState<DebuggerViewMode>('split');
  const [copied, setCopied] = useState(false);
  const [applyFeedback, setApplyFeedback] = useState<string | null>(null);

  // Sync with live IR document whenever modal opens
  useEffect(() => {
    if (open) {
      setRawJson(manager.exportJSON());
      setApplyFeedback(null);
    }
  }, [open]);

  const { parsedDoc, diagnostics } = useMemo(() => analyzeVideoIRJson(rawJson), [rawJson]);

  const isFullyValid =
    !diagnostics.parseError &&
    diagnostics.schemaValidation.valid &&
    diagnostics.danglingAnchors.length === 0;

  // Visual Editor mutator callback
  const handleVisualTreeChange = useCallback((newData: unknown) => {
    try {
      const formatted = JSON.stringify(newData, null, 2);
      setRawJson(formatted);
    } catch {
      // Ignore serialization errors
    }
  }, []);

  const handlePrettify = () => {
    if (!parsedDoc) return;
    setRawJson(JSON.stringify(parsedDoc, null, 2));
  };

  const handleMinify = () => {
    if (!parsedDoc) return;
    setRawJson(JSON.stringify(parsedDoc));
  };

  const handleResetToLive = () => {
    setRawJson(manager.exportJSON());
    setApplyFeedback(null);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback
    }
  };

  const handleApplyToStudio = () => {
    const res = manager.applyJSONEdit(rawJson);
    if (res.valid) {
      setApplyFeedback('Applied to live Studio timeline (Undoable via Ctrl+Z)');
      setTimeout(() => setApplyFeedback(null), 3000);
    }
  };

  const handleSelectSequenceAndClose = (seqId: string) => {
    manager.setSelectedSequenceId(seqId);
    onOpenChange(false);
  };

  const handleQuickRepairDanglingAnchors = () => {
    if (!parsedDoc) return;
    const docCopy = JSON.parse(JSON.stringify(parsedDoc));
    // Repair dangling anchors by converting 'after' references with missing IDs to start: 0
    if (Array.isArray(docCopy.tracks)) {
      for (const track of docCopy.tracks) {
        if (Array.isArray(track.sequences)) {
          for (const seq of track.sequences) {
            const refId = seq?.time?.start?.referenceId;
            if (refId && diagnostics.danglingAnchors.some((d) => d.referenceId === refId)) {
              seq.time.start = 0;
            }
          }
        }
      }
    }
    setRawJson(JSON.stringify(docCopy, null, 2));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="visual-ir-json-debugger-modal"
        className="sm:max-w-none max-w-6xl w-[94vw] h-[88vh] flex flex-col glass-panel border border-[var(--glass-border)] border-t-[var(--glass-border-highlight)] p-0 rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Modal Header */}
        <DialogHeader className="flex flex-row items-center justify-between px-5 py-3 border-b border-glass-border shrink-0 bg-glass-surface/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-theme/15 text-accent-theme border border-accent-theme/30 flex items-center justify-center shadow-accent-glow">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-bold text-foreground">
                  Visual VideoIR JSON Editor & Live Debugger
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] border-accent-theme/30 text-accent-theme bg-accent-theme/10"
                >
                  Draft-07 Schema + DAG Verifier
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                Interactive two-way visual JSON editing & Shiki source synchronization
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Validation Status Pill */}
            {isFullyValid ? (
              <Badge
                data-testid="debugger-status-valid"
                variant="outline"
                className="font-mono text-[10px] gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-500 dark:text-emerald-300 px-2.5 py-1"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Valid VideoIR ({diagnostics.trackCount}T / {diagnostics.sequenceCount}S /{' '}
                {diagnostics.modifierCount}M)
              </Badge>
            ) : (
              <Badge
                data-testid="debugger-status-invalid"
                variant="outline"
                className="font-mono text-[10px] gap-1 border-rose-500/40 bg-rose-500/10 text-rose-500 dark:text-rose-300 px-2.5 py-1"
              >
                <XCircle className="w-3 h-3 text-rose-400" />
                {diagnostics.parseError
                  ? 'JSON Syntax Error'
                  : `${diagnostics.schemaValidation.errors.length + diagnostics.danglingAnchors.length} Issue(s)`}
              </Badge>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* View Mode Switcher Toolbar */}
        <div className="flex items-center justify-between px-5 py-1.5 border-b border-glass-border shrink-0 bg-glass-surface/40 backdrop-blur-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              data-testid="debugger-tab-split"
              className={`h-7 px-3 text-xs font-mono rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'split'
                  ? 'glass-button-primary text-primary-foreground shadow-accent-glow'
                  : 'glass-pill'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              Split Visual & Code
            </button>

            <button
              type="button"
              onClick={() => setViewMode('tree')}
              data-testid="debugger-tab-tree"
              className={`h-7 px-3 text-xs font-mono rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'tree'
                  ? 'glass-button-primary text-primary-foreground shadow-accent-glow'
                  : 'glass-pill'
              }`}
            >
              <ListTree className="w-3.5 h-3.5" />
              Visual Tree Only
            </button>

            <button
              type="button"
              onClick={() => setViewMode('code')}
              data-testid="debugger-tab-editor"
              className={`h-7 px-3 text-xs font-mono rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'code'
                  ? 'glass-button-primary text-primary-foreground shadow-accent-glow'
                  : 'glass-pill'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              Raw Code Only
            </button>

            <button
              type="button"
              onClick={() => setViewMode('diagnostics')}
              data-testid="debugger-tab-diagnostics"
              className={`h-7 px-3 text-xs font-mono rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'diagnostics'
                  ? 'glass-button-primary text-primary-foreground shadow-accent-glow'
                  : 'glass-pill'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              Diagnostics & Health
              {(!isFullyValid || diagnostics.unregisteredModifiers.length > 0) && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {diagnostics.schemaValidation.errors.length +
                    diagnostics.danglingAnchors.length +
                    diagnostics.unregisteredModifiers.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground">
              {parsedDoc ? 'Dual-way synchronized' : 'Syntax error in source'}
            </span>
          </div>
        </div>

        {/* Main Body Workspace */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Split Mode: Tree (left) + Code (right) + Telemetry (far right) */}
          {viewMode === 'split' && (
            <div className="flex-1 flex min-h-0 overflow-hidden">
              <div className="w-[52%] h-full flex flex-col min-h-0 border-r border-[var(--glass-border)]">
                <VisualJsonTreeEditor
                  data={parsedDoc}
                  onChange={handleVisualTreeChange}
                  onSelectSequence={handleSelectSequenceAndClose}
                />
              </div>

              <div className="flex-1 h-full flex flex-col min-h-0 border-r border-[var(--glass-border)]">
                <CodeEditorToolbar
                  onPrettify={handlePrettify}
                  onMinify={handleMinify}
                  onCopy={handleCopy}
                  onReset={handleResetToLive}
                  copied={copied}
                  canFormat={!!parsedDoc}
                />
                <ShikiCodeViewer
                  code={rawJson}
                  onChange={setRawJson}
                />
              </div>

              <DiagnosticTelemetryCard
                diagnostics={diagnostics}
                isFullyValid={isFullyValid}
                onQuickRepairDanglingAnchors={handleQuickRepairDanglingAnchors}
              />
            </div>
          )}

          {/* Visual Tree Only Mode */}
          {viewMode === 'tree' && (
            <div className="flex-1 flex min-h-0 overflow-hidden">
              <div className="flex-1 h-full flex flex-col min-h-0">
                <VisualJsonTreeEditor
                  data={parsedDoc}
                  onChange={handleVisualTreeChange}
                  onSelectSequence={handleSelectSequenceAndClose}
                />
              </div>

              <DiagnosticTelemetryCard
                diagnostics={diagnostics}
                isFullyValid={isFullyValid}
                onQuickRepairDanglingAnchors={handleQuickRepairDanglingAnchors}
              />
            </div>
          )}

          {/* Code Only Mode */}
          {viewMode === 'code' && (
            <div className="flex-1 flex min-h-0 overflow-hidden">
              <div className="flex-1 h-full flex flex-col min-h-0">
                <CodeEditorToolbar
                  onPrettify={handlePrettify}
                  onMinify={handleMinify}
                  onCopy={handleCopy}
                  onReset={handleResetToLive}
                  copied={copied}
                  canFormat={!!parsedDoc}
                />
                <ShikiCodeViewer
                  code={rawJson}
                  onChange={setRawJson}
                />
              </div>

              <DiagnosticTelemetryCard
                diagnostics={diagnostics}
                isFullyValid={isFullyValid}
                onQuickRepairDanglingAnchors={handleQuickRepairDanglingAnchors}
              />
            </div>
          )}

          {/* Diagnostics Mode */}
          {viewMode === 'diagnostics' && (
            <div className="flex-1 p-6 overflow-y-auto space-y-4 font-mono">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-xl glass-card border border-[var(--glass-border)]">
                  <div className="text-xs text-muted-foreground">JSON Schema Draft-07</div>
                  <div className="text-sm font-bold mt-1.5 flex items-center gap-1.5">
                    {diagnostics.schemaValidation.valid ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-300">100% Compliant</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-rose-400" />
                        <span className="text-rose-300">
                          {diagnostics.schemaValidation.errors.length} Violation(s)
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-xl glass-card border border-[var(--glass-border)]">
                  <div className="text-xs text-muted-foreground">Relational DAG Anchors</div>
                  <div className="text-sm font-bold mt-1.5 flex items-center gap-1.5">
                    {diagnostics.danglingAnchors.length === 0 ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-300">All Anchors Resolved</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span className="text-amber-300">
                          {diagnostics.danglingAnchors.length} Dangling Ref(s)
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-xl glass-card border border-[var(--glass-border)]">
                  <div className="text-xs text-muted-foreground">ModifierPluginRegistry Coverage</div>
                  <div className="text-sm font-bold mt-1.5 flex items-center gap-1.5">
                    {diagnostics.unregisteredModifiers.length === 0 ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-300">All Plugins Registered</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span className="text-amber-300">
                          {diagnostics.unregisteredModifiers.length} Custom / Unregistered
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {diagnostics.missingAssets.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-1.5">
                  <div className="text-xs font-bold text-amber-300">
                    Unresolved Asset IDs ({diagnostics.missingAssets.length})
                  </div>
                  <ul className="text-xs text-amber-200/80 list-disc pl-4">
                    {diagnostics.missingAssets.map((m, i) => (
                      <li key={i}>
                        Sequence <code>{m.sequenceId}</code> references undeclared asset{' '}
                        <code>{m.assetId}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-[var(--glass-border)] shrink-0 bg-[var(--glass-bg)]/80 backdrop-blur-md">
          <div className="text-xs font-mono text-muted-foreground flex items-center gap-2">
            {applyFeedback ? (
              <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {applyFeedback}
              </span>
            ) : (
              <span>Shortcut: Ctrl+Shift+J • Edits support full Undo/Redo (Ctrl+Z) in Studio</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs font-mono glass-pill"
            >
              Close
            </Button>
            <button
              type="button"
              disabled={!diagnostics.schemaValidation.valid || !!diagnostics.parseError}
              onClick={handleApplyToStudio}
              data-testid="debugger-apply-btn"
              className="h-8 px-3.5 rounded-lg text-xs font-mono flex items-center gap-1.5 glass-button-primary disabled:opacity-40 disabled:cursor-not-allowed font-bold cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              Apply to Studio
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import {
  Code2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  RotateCcw,
  Copy,
  Check,
  Wand2,
  Minimize2,
  GitBranch,
  FileJson,
  ListTree,
  ChevronRight,
  ChevronDown,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import {
  VideoIRSchemaValidator,
  type ValidationResult,
  type VideoIRDocument,
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
} from '@acc/ir';
import { IRStateManager } from '../../lib/ir/irState';

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
  let parsed: any = null;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err: any) {
    return {
      parsedDoc: null,
      diagnostics: {
        parseError: err.message || 'Syntax error in JSON payload',
        schemaValidation: { valid: false, errors: [`Syntax Error: ${err.message || 'Invalid JSON'}`] },
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
  const tracks = Array.isArray(parsed?.tracks) ? parsed.tracks : [];
  const assetsObj = parsed?.assets && typeof parsed.assets === 'object' ? parsed.assets : {};
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
      for (const mod of track.modifiers) {
        modifierCount++;
        if (mod?.type && !registry.get(mod.type)) {
          unregisteredSet.add(mod.type);
        }
      }
    }
    const seqs = Array.isArray(track?.sequences) ? track.sequences : [];
    for (const seq of seqs) {
      sequenceCount++;
      if (typeof seq?.id === 'string') {
        sequenceIds.add(seq.id);
      }
    }
  }

  for (const track of tracks) {
    const seqs = Array.isArray(track?.sequences) ? track.sequences : [];
    for (const seq of seqs) {
      const seqId = seq?.id || 'unknown';
      const refId = seq?.time?.start?.referenceId;
      if (typeof refId === 'string' && refId.length > 0 && !sequenceIds.has(refId)) {
        danglingAnchors.push({ sequenceId: seqId, referenceId: refId });
      }
      if (typeof seq?.assetId === 'string' && seq.assetId.length > 0 && !assetIds.has(seq.assetId)) {
        missingAssets.push({ sequenceId: seqId, assetId: seq.assetId });
      }
      if (Array.isArray(seq?.modifiers)) {
        for (const mod of seq.modifiers) {
          modifierCount++;
          if (mod?.type && !registry.get(mod.type)) {
            unregisteredSet.add(mod.type);
          }
        }
      }
    }
  }

  return {
    parsedDoc: parsed as VideoIRDocument,
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

interface JsonTreeNodeProps {
  label: string;
  value: unknown;
  depth?: number;
  searchQuery?: string;
  onSelectSequence?: (seqId: string) => void;
}

function JsonTreeNode({
  label,
  value,
  depth = 0,
  searchQuery = '',
  onSelectSequence,
}: JsonTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);

  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);

  const matchesSearch =
    searchQuery.trim().length > 0 &&
    (label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (!isObject && String(value).toLowerCase().includes(searchQuery.toLowerCase())));

  if (!isObject) {
    const valStr = typeof value === 'string' ? `"${value}"` : String(value);
    const valColor =
      typeof value === 'number'
        ? 'text-amber-400'
        : typeof value === 'boolean'
          ? 'text-emerald-400'
          : 'text-cyan-300';

    return (
      <div
        className={`flex items-center gap-1.5 py-0.5 px-1.5 rounded text-[11px] font-mono ${matchesSearch ? 'bg-indigo-500/25 ring-1 ring-indigo-400' : 'hover:bg-white/5'
          }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        <span className="text-slate-400">{label}:</span>
        <span className={`truncate ${valColor}`}>{valStr}</span>
      </div>
    );
  }

  const entries = isArray
    ? (value as unknown[]).map((v, idx) => [String(idx), v] as const)
    : Object.entries(value as Record<string, unknown>);

  const objId =
    !isArray && value && typeof (value as any).id === 'string' ? ((value as any).id as string) : null;
  const objType =
    !isArray && value && typeof (value as any).type === 'string' ? ((value as any).type as string) : null;

  return (
    <div>
      <div
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center justify-between py-0.5 px-1.5 rounded cursor-pointer text-[11px] font-mono select-none ${matchesSearch ? 'bg-indigo-500/25 ring-1 ring-indigo-400' : 'hover:bg-white/5'
          }`}
        style={{ paddingLeft: `${depth * 14}px` }}
      >
        <div className="flex items-center gap-1">
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
          )}
          <span className="text-indigo-300 font-semibold">{label}</span>
          {objId && (
            <Badge
              variant="outline"
              className="ml-1 text-[9px] py-0 px-1 font-mono border-cyan-500/30 text-cyan-300 bg-cyan-500/10"
            >
              #{objId}
            </Badge>
          )}
          {objType && (
            <Badge
              variant="outline"
              className="ml-1 text-[9px] py-0 px-1 font-mono border-purple-500/30 text-purple-300 bg-purple-500/10"
            >
              {objType}
            </Badge>
          )}
          <span className="text-[10px] text-slate-500 ml-1">
            {isArray ? `[${entries.length}]` : `{${entries.length}}`}
          </span>
        </div>

        {objId && objId.startsWith('seq-') && onSelectSequence && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSelectSequence(objId);
            }}
            className="h-5 px-1.5 text-[9px] font-mono text-cyan-400 hover:text-cyan-200"
          >
            Inspect Clip
          </Button>
        )}
      </div>

      {expanded && (
        <div>
          {entries.map(([k, v]) => (
            <JsonTreeNode
              key={k}
              label={k}
              value={v}
              depth={depth + 1}
              searchQuery={searchQuery}
              onSelectSequence={onSelectSequence}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function VisualIRJsonDebuggerModal({
  open,
  onOpenChange,
}: VisualIRJsonDebuggerModalProps) {
  const manager = IRStateManager.getInstance();
  const [rawJson, setRawJson] = useState<string>(() => manager.exportJSON());
  const [activeTab, setActiveTab] = useState<'editor' | 'tree' | 'diagnostics'>('editor');
  const [searchQuery, setSearchQuery] = useState('');
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

  const lineCount = useMemo(() => rawJson.split('\n').length, [rawJson]);

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
      // Fallback ignored in headless environments
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="visual-ir-json-debugger-modal"
        className="sm:max-w-none max-w-5xl w-[92vw] h-[85vh] flex flex-col glass-panel border border-[var(--glass-border)] p-0 rounded-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <DialogHeader className="flex flex-row items-center justify-between px-5 py-3.5 border-b border-[var(--glass-border) shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 flex items-center justify-center">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-bold text-foreground">
                  Visual VideoIR JSON Editor & Live Debugger
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] border-indigo-500/30 text-indigo-300 bg-indigo-500/10"
                >
                  Draft-07 Schema + DAG Verifier
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                Inspect, lint, and hot-swap Universal VideoIR AST with full Command undo/redo safety
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Validation Status Pill */}
            {isFullyValid ? (
              <Badge
                data-testid="debugger-status-valid"
                variant="outline"
                className="font-mono text-[10px] gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-2.5 py-1"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Valid VideoIR ({diagnostics.trackCount}T / {diagnostics.sequenceCount}S /{' '}
                {diagnostics.modifierCount}M)
              </Badge>
            ) : (
              <Badge
                data-testid="debugger-status-invalid"
                variant="outline"
                className="font-mono text-[10px] gap-1 border-rose-500/40 bg-rose-500/10 text-rose-300 px-2.5 py-1"
              >
                <XCircle className="w-3 h-3 text-rose-400" />
                {diagnostics.parseError
                  ? 'JSON Syntax Error'
                  : `${diagnostics.schemaValidation.errors.length + diagnostics.danglingAnchors.length} Validation Issue(s)`}
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

        {/* Sub-Toolbar: Mode Switcher + Formatting Utilities */}
        <div className="flex items-center justify-between px-5 py-2 border-b border-[var(--glass-border)] shrink-0">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={activeTab === 'editor' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('editor')}
              data-testid="debugger-tab-editor"
              className="h-7 text-xs font-mono gap-1.5"
            >
              <FileJson className="w-3.5 h-3.5" />
              Raw JSON Editor
            </Button>
            <Button
              type="button"
              variant={activeTab === 'tree' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('tree')}
              data-testid="debugger-tab-tree"
              className="h-7 text-xs font-mono gap-1.5"
            >
              <ListTree className="w-3.5 h-3.5" />
              AST Tree Navigator
            </Button>
            <Button
              type="button"
              variant={activeTab === 'diagnostics' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('diagnostics')}
              data-testid="debugger-tab-diagnostics"
              className="h-7 text-xs font-mono gap-1.5"
            >
              <GitBranch className="w-3.5 h-3.5" />
              DAG & Schema Diagnostics
              {(!isFullyValid || diagnostics.unregisteredModifiers.length > 0) && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {diagnostics.schemaValidation.errors.length +
                    diagnostics.danglingAnchors.length +
                    diagnostics.unregisteredModifiers.length}
                </span>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            {activeTab === 'tree' && (
              <div className="relative w-48 mr-2">
                <Search className="w-3 h-3  absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Filter keys or values..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7 pl-7 text-[11px] font-mono  "
                />
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrettify}
              disabled={!parsedDoc}
              title="Format JSON (2-space indent)"
              className="h-7 text-[11px] font-mono gap-1 border-slate-700"
            >
              <Wand2 className="w-3 h-3" />
              Format
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleMinify}
              disabled={!parsedDoc}
              title="Minify JSON"
              className="h-7 text-[11px] font-mono gap-1 border-slate-700"
            >
              <Minimize2 className="w-3 h-3" />
              Minify
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-7 text-[11px] font-mono gap-1 border-slate-700"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetToLive}
              title="Revert editor buffer to active Studio state"
              className="h-7 text-[11px] font-mono gap-1 border-slate-700"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
          </div>
        </div>

        {/* Main Workspace Body */}
        <div className="flex-1 min-h-0 flex overflow-hidde">
          {activeTab === 'editor' && (
            <div className="flex-1 flex min-h-0 overflow-auto">
              {/* Line-Numbered Monospace Code Editor */}
              <div className="flex-1 flex min-h-0 overflow-auto relative font-mono text-balance">
                <div
                  aria-hidden="true"
                  className="select-none py-3 px-2.5 text-right border-r font-mono text-[11px] leading-[1.5rem] shrink-0"
                >
                  {Array.from({ length: Math.max(1, lineCount) }).map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <textarea
                  data-testid="debugger-json-textarea"
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}

                  className="flex-1 w-full min-h-full p-3 spellCheck={false} font-mono leading-[1.5rem] focus:outline-none resize-none overflow-hidden"
                />
              </div>

              {/* Right-Side Live Validation & Quick Summary Sidebar */}
              <div className="w-80 border-l border-slate-800/80 bg-slate-900/40 p-3.5 overflow-y-auto space-y-3 shrink-0">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  Live AST Telemetry
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 font-mono">Tracks</div>
                    <div className="text-sm font-bold font-mono text-foreground">
                      {diagnostics.trackCount}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 font-mono">Sequences</div>
                    <div className="text-sm font-bold font-mono text-cyan-400">
                      {diagnostics.sequenceCount}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 font-mono">Modifiers</div>
                    <div className="text-sm font-bold font-mono text-indigo-400">
                      {diagnostics.modifierCount}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 font-mono">Assets</div>
                    <div className="text-sm font-bold font-mono text-emerald-400">
                      {diagnostics.assetCount}
                    </div>
                  </div>
                </div>

                {/* Validation Errors List */}
                {diagnostics.schemaValidation.errors.length > 0 && (
                  <div
                    data-testid="debugger-error-list"
                    className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 space-y-1.5"
                  >
                    <div className="text-[11px] font-bold text-rose-300 flex items-center gap-1.5 font-mono">
                      <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      Schema / Syntax Errors ({diagnostics.schemaValidation.errors.length})
                    </div>
                    <ul className="space-y-1 text-[10px] font-mono text-rose-200/90 list-disc pl-4">
                      {diagnostics.schemaValidation.errors.map((err, i) => (
                        <li key={i} className="break-words">
                          {err}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {diagnostics.danglingAnchors.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/40 space-y-1.5">
                    <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5 font-mono">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      Dangling Relational Anchors
                    </div>
                    <ul className="space-y-1 text-[10px] font-mono text-amber-200/90">
                      {diagnostics.danglingAnchors.map((d, idx) => (
                        <li key={idx}>
                          <code>{d.sequenceId}</code> references missing <code>{d.referenceId}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {isFullyValid && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-[11px] font-mono text-emerald-300 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">Schema & Topology Verified</div>
                      <p className="text-[10px] text-emerald-400/80 mt-0.5">
                        Ready to hot-swap into Studio state. Undoable with Ctrl+Z.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'tree' && (
            <div className="flex-1 p-4 overflow-y-auto">
              {parsedDoc ? (
                <JsonTreeNode
                  label="VideoIRDocument"
                  value={parsedDoc}
                  depth={0}
                  searchQuery={searchQuery}
                  onSelectSequence={handleSelectSequenceAndClose}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-rose-400 font-mono text-xs">
                  Fix JSON syntax errors in the Raw JSON Editor to inspect the AST tree.
                </div>
              )}
            </div>
          )}

          {activeTab === 'diagnostics' && (
            <div className="flex-1 p-5 overflow-y-auto space-y-4 font-mono">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                  <div className="text-xs text-slate-400">JSON Schema Draft-07</div>
                  <div className="text-sm font-bold mt-1 flex items-center gap-1.5">
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

                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                  <div className="text-xs text-slate-400">Relational DAG Anchors</div>
                  <div className="text-sm font-bold mt-1 flex items-center gap-1.5">
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

                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                  <div className="text-xs text-slate-400">ModifierPluginRegistry Coverage</div>
                  <div className="text-sm font-bold mt-1 flex items-center gap-1.5">
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
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-1">
                  <div className="text-xs font-bold text-amber-300">
                    Unresolved Asset IDs ({diagnostics.missingAssets.length})
                  </div>
                  <ul className="text-[11px] text-amber-200/80 list-disc pl-4">
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
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--glass-border)]  shrink-0">
          <div className="text-xs font-mono text-muted-foreground flex items-center gap-2">
            {applyFeedback ? (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {applyFeedback}
              </span>
            ) : (
              <span>Shortcut: Ctrl+Shift+J • Changes are validated before dispatch</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs font-mono"
            >
              Close
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={!diagnostics.schemaValidation.valid || !!diagnostics.parseError}
              onClick={handleApplyToStudio}
              data-testid="debugger-apply-btn"
              className="h-8 text-xs font-mono gap-1.5 bg-[var(--accent-primary)] text-slate-950 hover:brightness-110 disabled:opacity-40"
            >
              <Play className="w-3.5 h-3.5" />
              Apply to Studio
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

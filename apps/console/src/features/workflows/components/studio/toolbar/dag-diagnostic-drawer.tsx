import React, { useState } from 'react';
import { type DagDiagnosticIssue, type DiagnosticSeverity } from '../utils/validation/dag-semantic-linter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  X,
  Crosshair,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DagDiagnosticDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  issues: DagDiagnosticIssue[];
  onSelectNode?: (nodeId: string) => void;
}

export const DagDiagnosticDrawer: React.FC<DagDiagnosticDrawerProps> = ({
  isOpen,
  onClose,
  issues,
  onSelectNode,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<'all' | DiagnosticSeverity>('all');

  if (!isOpen) return null;

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const infos = issues.filter((i) => i.severity === 'info');

  const filteredIssues =
    filterSeverity === 'all'
      ? issues
      : issues.filter((i) => i.severity === filterSeverity);

  return (
    <div
      role="dialog"
      aria-label="DAG Semantic Diagnostics"
      data-testid="dag-diagnostic-drawer"
      className="absolute top-16 right-4 z-40 w-96 max-h-[80vh] flex flex-col rounded-2xl backdrop-blur-2xl bg-white/90 dark:bg-slate-900/90 border border-white/40 dark:border-white/10 shadow-2xl transition-all animate-in fade-in slide-in-from-right-4 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-border/40">
        <div className="flex items-center gap-2">
          {errors.length > 0 ? (
            <AlertCircle className="w-4 h-4 text-rose-500" />
          ) : warnings.length > 0 ? (
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          )}
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            DAG Diagnostics ({issues.length})
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 rounded-full"
          onClick={onClose}
          aria-label="Close diagnostics"
          data-testid="dag-diagnostic-close-btn"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-2 bg-muted/40 border-b border-border/30 text-[10px]">
        <button
          type="button"
          onClick={() => setFilterSeverity('all')}
          className={cn(
            'px-2 py-1 rounded-md font-medium transition-colors',
            filterSeverity === 'all'
              ? 'bg-primary text-primary-foreground font-bold shadow-sm'
              : 'hover:bg-muted text-muted-foreground'
          )}
          data-testid="dag-diagnostic-tab-all"
        >
          All ({issues.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterSeverity('error')}
          className={cn(
            'px-2 py-1 rounded-md font-medium transition-colors flex items-center gap-1',
            filterSeverity === 'error'
              ? 'bg-rose-500 text-white font-bold shadow-sm'
              : 'hover:bg-rose-500/10 text-rose-600 dark:text-rose-400'
          )}
          data-testid="dag-diagnostic-tab-errors"
        >
          <span>Errors</span>
          <Badge variant="outline" className="h-4 px-1 text-[9px] border-current">
            {errors.length}
          </Badge>
        </button>
        <button
          type="button"
          onClick={() => setFilterSeverity('warning')}
          className={cn(
            'px-2 py-1 rounded-md font-medium transition-colors flex items-center gap-1',
            filterSeverity === 'warning'
              ? 'bg-amber-500 text-white font-bold shadow-sm'
              : 'hover:bg-amber-500/10 text-amber-600 dark:text-amber-400'
          )}
          data-testid="dag-diagnostic-tab-warnings"
        >
          <span>Warnings</span>
          <Badge variant="outline" className="h-4 px-1 text-[9px] border-current">
            {warnings.length}
          </Badge>
        </button>
      </div>

      {/* Issues List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[480px]">
        {filteredIssues.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-80" />
            <p className="font-medium text-foreground">No issues detected</p>
            <p className="text-[11px] mt-0.5">Topological causality and data bindings are valid.</p>
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <div
              key={issue.id}
              data-testid={`dag-diagnostic-item-${issue.id}`}
              className={cn(
                'p-2.5 rounded-xl border text-xs space-y-1.5 transition-all',
                issue.severity === 'error' && 'border-rose-500/30 bg-rose-500/5',
                issue.severity === 'warning' && 'border-amber-500/30 bg-amber-500/5',
                issue.severity === 'info' && 'border-sky-500/30 bg-sky-500/5'
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold">
                  {issue.severity === 'error' ? (
                    <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400 uppercase">
                      Error
                    </span>
                  ) : issue.severity === 'warning' ? (
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 uppercase">
                      Warning
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-600 dark:text-sky-400 uppercase">
                      Info
                    </span>
                  )}
                  <span className="text-foreground truncate max-w-[130px]" title={issue.taskReferenceName}>
                    {issue.taskReferenceName}
                  </span>
                </div>

                {onSelectNode && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 px-1.5 text-[9px] gap-1 text-primary hover:bg-primary/10"
                    onClick={() => onSelectNode(issue.nodeId)}
                    title="Jump to node on canvas"
                    data-testid={`dag-diagnostic-jump-btn-${issue.id}`}
                  >
                    <Crosshair className="w-2.5 h-2.5" />
                    <span>Focus</span>
                  </Button>
                )}
              </div>

              <div className="text-[11px] leading-relaxed text-foreground/90 font-sans">
                {issue.message}
              </div>

              {issue.expression && (
                <div className="font-mono text-[9px] bg-muted/60 p-1 rounded text-foreground/80 break-all">
                  {issue.expression}
                </div>
              )}

              {issue.suggestion && (
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <span className="font-semibold text-primary">Fix:</span>
                  <span>{issue.suggestion}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

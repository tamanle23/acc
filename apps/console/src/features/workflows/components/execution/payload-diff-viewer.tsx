import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileDiff,
  Plus,
  Minus,
  RefreshCw,
  Search,
  CheckCircle2,
  Filter,
  Eye,
} from 'lucide-react';

export interface PayloadDiffViewerProps {
  currentPayload: Record<string, any>;
  previousPayload?: Record<string, any> | null;
  stepIndex?: number;
  className?: string;
}

interface DiffEntry {
  key: string;
  type: 'ADDED' | 'MODIFIED' | 'REMOVED' | 'UNCHANGED';
  oldValue?: any;
  newValue?: any;
}

export const PayloadDiffViewer: React.FC<PayloadDiffViewerProps> = ({
  currentPayload = {},
  previousPayload = {},
  stepIndex,
  className,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [showOnlyChanges, setShowOnlyChanges] = useState(true);

  // Compute diff entries
  const diffEntries = useMemo(() => {
    const prev = previousPayload || {};
    const curr = currentPayload || {};
    const allKeys = Array.from(new Set([...Object.keys(prev), ...Object.keys(curr)])).sort();

    return allKeys.map((key): DiffEntry => {
      const hasPrev = Object.prototype.hasOwnProperty.call(prev, key);
      const hasCurr = Object.prototype.hasOwnProperty.call(curr, key);

      if (!hasPrev && hasCurr) {
        return { key, type: 'ADDED', newValue: curr[key] };
      }
      if (hasPrev && !hasCurr) {
        return { key, type: 'REMOVED', oldValue: prev[key] };
      }

      const prevStr = JSON.stringify(prev[key]);
      const currStr = JSON.stringify(curr[key]);

      if (prevStr !== currStr) {
        return { key, type: 'MODIFIED', oldValue: prev[key], newValue: curr[key] };
      }

      return { key, type: 'UNCHANGED', oldValue: prev[key], newValue: curr[key] };
    });
  }, [currentPayload, previousPayload]);

  const stats = useMemo(() => {
    let added = 0;
    let modified = 0;
    let removed = 0;
    let unchanged = 0;
    for (const d of diffEntries) {
      if (d.type === 'ADDED') added++;
      else if (d.type === 'MODIFIED') modified++;
      else if (d.type === 'REMOVED') removed++;
      else unchanged++;
    }
    return { added, modified, removed, unchanged, total: diffEntries.length };
  }, [diffEntries]);

  const filteredEntries = useMemo(() => {
    return diffEntries.filter((entry) => {
      if (showOnlyChanges && entry.type === 'UNCHANGED') return false;
      if (!filterQuery) return true;
      return (
        entry.key.toLowerCase().includes(filterQuery.toLowerCase()) ||
        JSON.stringify(entry.oldValue || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
        JSON.stringify(entry.newValue || '').toLowerCase().includes(filterQuery.toLowerCase())
      );
    });
  }, [diffEntries, showOnlyChanges, filterQuery]);

  const formatValue = (val: any) => {
    if (val === undefined) return <span className="text-muted-foreground italic">undefined</span>;
    if (val === null) return <span className="text-muted-foreground italic font-mono">null</span>;
    if (typeof val === 'object') {
      return (
        <pre className="font-mono text-[11px] whitespace-pre-wrap break-all leading-tight">
          {JSON.stringify(val, null, 2)}
        </pre>
      );
    }
    return <span className="font-mono text-xs break-all">{String(val)}</span>;
  };

  return (
    <div
      data-testid="payload-diff-viewer"
      aria-label="Payload and Variable Diff Viewer"
      className={cn('flex flex-col gap-3 h-full', className)}
    >
      {/* Header Bar with Stats and Filters */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-black/5 dark:bg-white/5 p-2 rounded-xl border border-white/20 dark:border-white/5">
        <div className="flex items-center gap-2">
          <FileDiff className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Variable State Diff
          </span>
          {stepIndex !== undefined && (
            <Badge variant="outline" className="text-[10px] font-mono">
              Step {stepIndex} vs {Math.max(0, stepIndex - 1)}
            </Badge>
          )}
        </div>

        {/* Change Counts */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] px-1.5 py-0.5">
            +{stats.added} Added
          </Badge>
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] px-1.5 py-0.5">
            ~{stats.modified} Modified
          </Badge>
          {stats.removed > 0 && (
            <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10px] px-1.5 py-0.5">
              -{stats.removed} Removed
            </Badge>
          )}
        </div>

        {/* Controls: Search & Toggle */}
        <div className="flex items-center gap-2">
          <div className="relative w-40 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Filter keys/values..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="h-8 pl-7 text-xs bg-white/50 dark:bg-slate-900/50"
            />
          </div>

          <Button
            size="sm"
            variant={showOnlyChanges ? 'secondary' : 'outline'}
            className="h-8 text-xs px-2.5"
            onClick={() => setShowOnlyChanges(!showOnlyChanges)}
          >
            {showOnlyChanges ? (
              <>
                <Filter className="w-3.5 h-3.5 mr-1 text-primary" />
                Only Changes
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 mr-1" />
                Full Snapshot
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Diff Table / List View */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-white/20 dark:border-white/5 bg-white/40 dark:bg-slate-950/40 backdrop-blur-md p-1 space-y-1.5 max-h-64">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-1" />
            <span className="text-xs font-medium">No variable changes detected at this step.</span>
            {showOnlyChanges && stats.unchanged > 0 && (
              <span className="text-[11px] text-muted-foreground mt-0.5">
                {stats.unchanged} unchanged variables hidden. Toggle &quot;Full Snapshot&quot; to inspect all.
              </span>
            )}
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div
              key={entry.key}
              className={cn(
                'p-2.5 rounded-lg border text-xs transition-colors',
                entry.type === 'ADDED' &&
                  'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100',
                entry.type === 'MODIFIED' &&
                  'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100',
                entry.type === 'REMOVED' &&
                  'bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-100',
                entry.type === 'UNCHANGED' &&
                  'bg-black/5 dark:bg-white/5 border-transparent text-muted-foreground'
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  {entry.type === 'ADDED' && (
                    <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 font-bold" />
                  )}
                  {entry.type === 'MODIFIED' && (
                    <RefreshCw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 font-bold" />
                  )}
                  {entry.type === 'REMOVED' && (
                    <Minus className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 font-bold" />
                  )}
                  <span className="font-mono font-semibold text-foreground">{entry.key}</span>
                </div>

                <Badge
                  variant="outline"
                  className={cn(
                    'text-[9px] uppercase font-mono px-1.5 py-0',
                    entry.type === 'ADDED' && 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
                    entry.type === 'MODIFIED' && 'border-amber-500/40 text-amber-600 dark:text-amber-400',
                    entry.type === 'REMOVED' && 'border-rose-500/40 text-rose-600 dark:text-rose-400',
                    entry.type === 'UNCHANGED' && 'border-muted text-muted-foreground'
                  )}
                >
                  {entry.type}
                </Badge>
              </div>

              {/* Diff Values Grid */}
              {entry.type === 'MODIFIED' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20">
                    <span className="text-[10px] uppercase font-semibold text-rose-700 dark:text-rose-300 block mb-0.5">
                      Previous Value:
                    </span>
                    {formatValue(entry.oldValue)}
                  </div>
                  <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[10px] uppercase font-semibold text-emerald-700 dark:text-emerald-300 block mb-0.5">
                      New Value:
                    </span>
                    {formatValue(entry.newValue)}
                  </div>
                </div>
              ) : entry.type === 'ADDED' ? (
                <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 mt-1">
                  {formatValue(entry.newValue)}
                </div>
              ) : entry.type === 'REMOVED' ? (
                <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 mt-1">
                  {formatValue(entry.oldValue)}
                </div>
              ) : (
                <div className="p-1.5 rounded bg-black/5 dark:bg-white/5 mt-0.5">
                  {formatValue(entry.newValue)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

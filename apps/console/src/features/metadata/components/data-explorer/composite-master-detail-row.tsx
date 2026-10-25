import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
} from '@tanstack/react-table';
import type { CompositeSpec, CompositeRecordResponse, EntityRecord } from '../../api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/data-table/data-table';
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  ArrowRightLeft,
  KeyRound,
  Sparkles,
  Search,
  Sigma,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CompositeMasterDetailRowProps {
  record: CompositeRecordResponse | EntityRecord;
  compositeSpec: CompositeSpec;
  onChildPageChange?: (alias: string, newOffset: number, newLimit: number) => void;
  className?: string;
}

export const CompositeMasterDetailRow: React.FC<CompositeMasterDetailRowProps> = ({
  record,
  compositeSpec,
  onChildPageChange,
  className,
}) => {
  const children = compositeSpec.children || [];
  const [activeTabAlias, setActiveTabAlias] = useState<string>(
    children.length > 0 ? children[0].alias : ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);

  const compositeRecord = record as Partial<CompositeRecordResponse>;
  const attributes = (record.attributes || {}) as Record<string, unknown>;
  const childPaginationMap = compositeRecord.childPagination || {};
  const engineUsed = compositeRecord.engineUsed || 'dynamic-sql-pushdown';
  const rollups = compositeSpec.rollups || [];

  const activeChildNode = children.find((c) => c.alias === activeTabAlias) || children[0];

  const handleTabChange = (alias: string) => {
    setActiveTabAlias(alias);
    setSearchQuery('');
    setSorting([]);
  };

  if (!activeChildNode) {
    return (
      <div className="p-4 text-xs text-muted-foreground italic text-center">
        No child collections configured in CompositeSpec.
      </div>
    );
  }

  const rawChildData = attributes[activeChildNode.alias];
  const childItems: Array<Record<string, unknown>> = Array.isArray(rawChildData)
    ? (rawChildData as Array<Record<string, unknown>>)
    : rawChildData && typeof rawChildData === 'object'
    ? [rawChildData as Record<string, unknown>]
    : [];

  const paginationMeta = childPaginationMap[activeChildNode.alias] || {
    totalElements: childItems.length,
    limit: 50,
    offset: 0,
    hasMore: false,
  };

  const fields = activeChildNode.fields || [];

  const displayedItems = useMemo(() => {
    let items = [...childItems];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter((item) =>
        Object.values(item).some((val) => String(val ?? '').toLowerCase().includes(q))
      );
    }
    return items;
  }, [childItems, searchQuery]);

  const handlePrevPage = () => {
    if (!onChildPageChange || paginationMeta.offset <= 0) return;
    const newOffset = Math.max(0, paginationMeta.offset - paginationMeta.limit);
    onChildPageChange(activeChildNode.alias, newOffset, paginationMeta.limit);
  };

  const handleNextPage = () => {
    if (!onChildPageChange || !paginationMeta.hasMore) return;
    const newOffset = paginationMeta.offset + paginationMeta.limit;
    onChildPageChange(activeChildNode.alias, newOffset, paginationMeta.limit);
  };

  // Build TanStack column definitions dynamically for child items
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const cols: ColumnDef<Record<string, unknown>>[] = [
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground font-semibold text-xs">
            {String(row.original.id ?? '—')}
          </span>
        ),
      },
    ];

    if (fields.length > 0) {
      fields.forEach((f) => {
        const colKey = f.alias || f.source_attribute;
        cols.push({
          id: colKey,
          accessorFn: (row) => row[colKey],
          header: colKey,
          cell: ({ getValue }) => {
            const cellVal = getValue();
            return (
              <span className="text-foreground text-xs">
                {cellVal !== undefined && cellVal !== null
                  ? typeof cellVal === 'object'
                    ? JSON.stringify(cellVal)
                    : String(cellVal)
                  : '—'}
              </span>
            );
          },
        });
      });
    } else {
      const firstItem = childItems[0] || {};
      Object.keys(firstItem)
        .filter((k) => k !== 'id')
        .forEach((k) => {
          cols.push({
            id: k,
            accessorFn: (row) => row[k],
            header: k,
            cell: ({ getValue }) => {
              const cellVal = getValue();
              return (
                <span className="text-foreground text-xs">
                  {cellVal !== undefined && cellVal !== null
                    ? typeof cellVal === 'object'
                      ? JSON.stringify(cellVal)
                      : String(cellVal)
                    : '—'}
                </span>
              );
            },
          });
        });
    }

    return cols;
  }, [fields, childItems]);

  const table = useReactTable({
    data: displayedItems,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div
      data-testid="composite-master-detail-container"
      className={cn(
        'relative overflow-hidden rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-inner p-4 my-2 transition-all',
        className
      )}
    >
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <span>Synthesized Child Sub-Collections</span>
              <Sparkles className="h-3 w-3 text-amber-500 animate-pulse" />
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Direct SQL pushdown projection across composite relationship bounds
            </p>
          </div>
        </div>

        {/* Engine Badge Indicator */}
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-white/20 bg-background/50 text-muted-foreground"
          >
            {engineUsed}
          </Badge>
          <Badge
            variant="secondary"
            className="text-[10px] font-mono bg-primary/10 text-primary border-primary/20"
          >
            Spec: {compositeSpec.root_entity_system_name}
          </Badge>
        </div>
      </div>

      {/* Real-Time Synthesized Aggregate Rollups */}
      {rollups.length > 0 && (
        <div
          data-testid="composite-rollups-bar"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 mt-3 p-2.5 rounded-xl bg-white/40 dark:bg-white/5 border border-white/10"
        >
          {rollups.map((r) => {
            const val = attributes[r.alias];
            const displayVal =
              val !== undefined && val !== null ? String(val) : '—';
            return (
              <div
                key={r.alias}
                data-testid={`rollup-chip-${r.alias}`}
                className="flex items-center gap-2 p-2 rounded-lg bg-white/60 dark:bg-black/20 border border-white/20 text-xs"
              >
                <div className="h-4 w-4 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Sigma className="h-2.5 w-2.5" />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {r.alias.replace(/_/g, ' ')}:
                </span>
                <span className="font-mono font-bold text-foreground">
                  {displayVal}
                </span>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1 py-0 h-3.5 font-mono text-indigo-500 dark:text-indigo-400 border-indigo-400/30"
                >
                  {r.aggregate_function}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      {/* Child Tabs Navigation */}
      {children.length > 1 && (
        <div className="flex items-center gap-1.5 pt-3 overflow-x-auto pb-1">
          {children.map((child) => {
            const isActive = child.alias === activeTabAlias;
            const meta = childPaginationMap[child.alias];
            const count = meta
              ? meta.totalElements
              : Array.isArray(attributes[child.alias])
              ? (attributes[child.alias] as any[]).length
              : 0;
            return (
              <button
                key={child.alias}
                type="button"
                onClick={() => handleTabChange(child.alias)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 border',
                  isActive
                    ? 'bg-white/80 dark:bg-white/15 text-foreground border-white/30 dark:border-white/20 shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/30 dark:hover:bg-white/5 border-transparent'
                )}
              >
                <span>{child.alias}</span>
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                    isActive
                      ? 'bg-primary/15 text-primary font-bold'
                      : 'bg-muted/80 text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Active Child Node Metadata Ribbon & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-white/10 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-foreground flex items-center gap-1">
            <span className="capitalize">{activeChildNode.alias}</span>
            <span className="text-[10px] text-muted-foreground">({activeChildNode.target_entity_system_name})</span>
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/60 text-[10px] font-mono">
            {activeChildNode.join_pattern === 'PATTERN_B_FOREIGN_KEY' ? (
              <>
                <KeyRound className="h-2.5 w-2.5 text-sky-500" />
                <span>Pattern B (FK: {activeChildNode.foreign_key_attribute})</span>
              </>
            ) : (
              <>
                <ArrowRightLeft className="h-2.5 w-2.5 text-purple-500" />
                <span>Pattern C (Rel #{activeChildNode.relationship_type_id})</span>
              </>
            )}
          </span>
          <span className="text-[10px] uppercase font-mono px-1 rounded bg-muted/40">
            {activeChildNode.cardinality}
          </span>
        </div>

        {/* Search Filter & Micro-Pagination Stats */}
        <div className="flex items-center gap-2">
          {/* Quick Filter */}
          <div className="relative">
            <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Filter ${activeChildNode.alias}...`}
              aria-label={`Filter ${activeChildNode.alias}`}
              className="h-6 w-36 pl-6 text-[10px] bg-white/60 dark:bg-slate-900/60 border-border/40 rounded-md"
            />
          </div>

          <span>
            {paginationMeta.totalElements > 0 ? (
              <>
                Showing{' '}
                <strong className="text-foreground">
                  {paginationMeta.offset + 1}–
                  {Math.min(paginationMeta.offset + paginationMeta.limit, paginationMeta.totalElements)}
                </strong>{' '}
                of <strong className="text-foreground">{paginationMeta.totalElements}</strong>
              </>
            ) : (
              '0 records'
            )}
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-6 w-6 rounded-md p-0 border-white/20 bg-white/20 dark:bg-white/5"
              disabled={paginationMeta.offset <= 0}
              onClick={handlePrevPage}
              aria-label="Previous child page"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-6 w-6 rounded-md p-0 border-white/20 bg-white/20 dark:bg-white/5"
              disabled={!paginationMeta.hasMore}
              onClick={handleNextPage}
              aria-label="Next child page"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Standardized DataTable for Child Records */}
      <div className="mt-2 rounded-lg border border-white/10 dark:border-white/5 overflow-hidden bg-white/20 dark:bg-slate-900/30">
        <DataTable
          table={table}
          noResultsMessage={
            searchQuery
              ? `No ${activeChildNode.alias} match "${searchQuery}".`
              : `No related ${activeChildNode.alias} found for this record.`
          }
        />
      </div>
    </div>
  );
};

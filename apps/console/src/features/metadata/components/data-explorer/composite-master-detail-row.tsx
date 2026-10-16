import React, { useState } from 'react';
import type { CompositeSpec, CompositeRecordResponse, EntityRecord } from '../../api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Layers,
  ArrowRightLeft,
  KeyRound,
  Sparkles,
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

  const compositeRecord = record as Partial<CompositeRecordResponse>;
  const attributes = (record.attributes || {}) as Record<string, unknown>;
  const childPaginationMap = compositeRecord.childPagination || {};
  const engineUsed = compositeRecord.engineUsed || 'dynamic-sql-pushdown';

  const activeChildNode = children.find((c) => c.alias === activeTabAlias) || children[0];

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
            className={cn(
              'text-[10px] font-mono px-2 py-0.5 uppercase tracking-wider font-semibold rounded-md flex items-center gap-1',
              engineUsed.includes('pushdown')
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
            )}
          >
            <Database className="h-3 w-3" />
            <span>{engineUsed}</span>
          </Badge>
        </div>
      </div>

      {/* Child Tabs Navigation */}
      {children.length > 1 && (
        <div className="flex items-center gap-1.5 pt-3 overflow-x-auto pb-1">
          {children.map((child) => {
            const isActive = child.alias === activeTabAlias;
            const meta = childPaginationMap[child.alias];
            const count = meta ? meta.totalElements : Array.isArray(attributes[child.alias]) ? (attributes[child.alias] as any[]).length : 0;
            return (
              <button
                key={child.alias}
                type="button"
                onClick={() => setActiveTabAlias(child.alias)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 border',
                  isActive
                    ? 'bg-white/80 dark:bg-white/15 text-foreground border-white/30 dark:border-white/20 shadow-sm font-semibold'
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

      {/* Active Child Node Metadata Ribbon */}
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

        {/* Micro-Pagination Stats */}
        <div className="flex items-center gap-2">
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

      {/* Child Table or Key-Value View */}
      <div className="mt-2 rounded-lg border border-white/10 dark:border-white/5 overflow-hidden bg-white/20 dark:bg-slate-900/30">
        {childItems.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            No related {activeChildNode.alias} found for this record.
          </div>
        ) : (
          <Table className="text-xs">
            <TableHeader className="bg-muted/40 dark:bg-white/5">
              <TableRow className="border-b border-white/10 hover:bg-transparent">
                <TableHead className="w-16 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  ID
                </TableHead>
                {fields.length > 0 ? (
                  fields.map((f) => (
                    <TableHead
                      key={f.alias || f.source_attribute}
                      className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider"
                    >
                      {f.alias || f.source_attribute}
                    </TableHead>
                  ))
                ) : (
                  Object.keys(childItems[0] || {})
                    .filter((k) => k !== 'id')
                    .map((k) => (
                      <TableHead
                        key={k}
                        className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider"
                      >
                        {k}
                      </TableHead>
                    ))
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {childItems.map((item, idx) => {
                const itemId = String(item.id ?? idx);
                return (
                  <TableRow
                    key={itemId}
                    className="border-b border-white/5 hover:bg-white/30 dark:hover:bg-white/5 transition-colors"
                  >
                    <TableCell className="font-mono text-muted-foreground font-semibold">
                      {String(item.id ?? '—')}
                    </TableCell>
                    {fields.length > 0 ? (
                      fields.map((f) => {
                        const colKey = f.alias || f.source_attribute;
                        const cellVal = item[colKey];
                        return (
                          <TableCell key={colKey} className="text-foreground">
                            {cellVal !== undefined && cellVal !== null
                              ? typeof cellVal === 'object'
                                ? JSON.stringify(cellVal)
                                : String(cellVal)
                              : '—'}
                          </TableCell>
                        );
                      })
                    ) : (
                      Object.keys(childItems[0] || {})
                        .filter((k) => k !== 'id')
                        .map((k) => {
                          const cellVal = item[k];
                          return (
                            <TableCell key={k} className="text-foreground">
                              {cellVal !== undefined && cellVal !== null
                                ? typeof cellVal === 'object'
                                ? JSON.stringify(cellVal)
                                : String(cellVal)
                                : '—'}
                            </TableCell>
                          );
                        })
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

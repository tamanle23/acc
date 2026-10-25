import React, { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { RecordAuditLog } from '@acc/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Hash, User, Clock, FileText, CheckCircle2 } from 'lucide-react';

interface AuditColumnsOptions {
  onInspectRecord?: (record: RecordAuditLog) => void;
}

export function getAuditStudioColumns({
  onInspectRecord,
}: AuditColumnsOptions = {}): ColumnDef<RecordAuditLog>[] {
  return [
    {
      accessorKey: 'id',
      header: 'Block / ID',
      size: 90,
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold text-foreground/90">
          #{row.original.id}
        </span>
      ),
    },
    {
      accessorKey: 'tenantId',
      header: 'Tenant Scoping',
      size: 130,
      cell: ({ row }) => {
        const tid = row.original.tenantId || 'SYSTEM';
        const isSystem = tid === 'SYSTEM';
        return (
          <Badge
            variant="outline"
            className={
              isSystem
                ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25 font-mono text-[10px]'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 font-mono text-[10px]'
            }
          >
            {tid}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'operation',
      header: 'Operation',
      size: 110,
      cell: ({ row }) => {
        const op = row.original.operation;
        let color = 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
        if (op === 'CREATE') {
          color = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
        } else if (op === 'SOFT_DELETE' || op === 'DELETE') {
          color = 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';
        } else if (op === 'RESTORE') {
          color = 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
        }
        return (
          <Badge variant="outline" className={`font-semibold text-[10px] ${color}`}>
            {op}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'recordId',
      header: 'Target Entity',
      size: 140,
      cell: ({ row }) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium text-foreground">
            Type #{row.original.entityTypeId}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            Rec #{row.original.recordId} (v{row.original.version})
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'actor',
      header: 'Actor / Signer',
      size: 140,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-xs text-foreground/90">
          <User className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="truncate">{row.original.actor || row.original.changedBy || 'system'}</span>
        </div>
      ),
    },
    {
      accessorKey: 'currentHash',
      header: 'Cryptographic SHA-256 Hash Chain',
      size: 260,
      cell: ({ row }) => {
        const hash = row.original.currentHash;
        const prev = row.original.prevHash;
        if (!hash) {
          return <span className="text-[11px] text-muted-foreground italic">Unchained</span>;
        }
        return (
          <div className="flex flex-col gap-0.5 max-w-xs">
            <div className="flex items-center gap-1">
              <Hash className="h-3 w-3 text-primary shrink-0" />
              <span className="font-mono text-[10px] text-foreground font-medium truncate" title={hash}>
                {hash.slice(0, 16)}...{hash.slice(-8)}
              </span>
            </div>
            {prev && (
              <span className="font-mono text-[10px] text-foreground/80 dark:text-muted-foreground font-medium truncate pl-4" title={`Anchored to: ${prev}`}>
                prev: {prev.slice(0, 10)}...
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Timestamp',
      size: 150,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <Clock className="h-3 w-3 shrink-0" />
          <span>{row.original.createdAt ? new Date(row.original.createdAt).toLocaleString() : 'N/A'}</span>
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Inspection',
      size: 90,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onInspectRecord?.(row.original)}
          className="h-7 px-2 text-xs gap-1 hover:bg-white/40 dark:hover:bg-white/10"
        >
          <FileText className="h-3.5 w-3.5 text-primary" />
          <span>Diff</span>
        </Button>
      ),
    },
  ];
}

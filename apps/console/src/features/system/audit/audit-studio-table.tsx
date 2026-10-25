import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
} from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Download,
  RotateCcw,
  RefreshCw,
  Loader2,
  FileCheck2,
  AlertTriangle,
} from 'lucide-react';
import {
  useSystemAuditRecords,
  useVerifyAuditChain,
  useExportCompliancePackage,
} from '../api/use-system-audit';
import { getAuditStudioColumns } from './audit-studio-columns';
import type { RecordAuditLog } from '@unipost/client';

export function AuditStudioTable() {
  const [tenantFilter, setTenantFilter] = useState('SYSTEM');
  const [operationFilter, setOperationFilter] = useState<string>('ALL');
  const [actorSearch, setActorSearch] = useState('');
  const [inspectRecord, setInspectRecord] = useState<RecordAuditLog | null>(null);

  // Queries & Mutations
  const {
    data: auditData,
    isLoading,
    refetch,
  } = useSystemAuditRecords({
    tenantId: tenantFilter,
    operation: operationFilter !== 'ALL' ? operationFilter : undefined,
    actor: actorSearch.trim() || undefined,
  });

  const verifyMutation = useVerifyAuditChain();
  const exportMutation = useExportCompliancePackage();

  const records = useMemo(() => auditData?.content || [], [auditData]);

  // Columns definition
  const columns = useMemo(
    () =>
      getAuditStudioColumns({
        onInspectRecord: (rec) => setInspectRecord(rec),
      }),
    []
  );

  const table = useReactTable({
    data: records,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const handleVerify = () => {
    verifyMutation.mutate({ tenantId: tenantFilter });
  };

  const handleExport = () => {
    exportMutation.mutate(tenantFilter);
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar & Integrity Status Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl backdrop-blur-xl bg-white/65 dark:bg-slate-900/65 border border-white/30 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/20">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Cryptographic Forward-Hash Ledger
              </h2>
              <Badge variant="outline" className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-semibold gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
                Active SHA-256 Ledger
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Append-only immutable record mutations anchored by forward-hash blockchain links.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exportMutation.isPending}
            className="h-9 gap-1.5 text-xs bg-white/40 dark:bg-white/5 border-white/20 hover:bg-white/80"
          >
            {exportMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>Export Evidence (.json)</span>
          </Button>

          <Button
            size="sm"
            onClick={handleVerify}
            disabled={verifyMutation.isPending}
            className="h-9 gap-1.5 text-xs shadow-md shadow-primary/20"
          >
            {verifyMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileCheck2 className="h-4 w-4" />
            )}
            <span>Verify Chain Integrity</span>
          </Button>
        </div>
      </div>

      {/* Verification Result Toast/Banner if triggered */}
      {verifyMutation.data && (
        <div
          className={`flex items-center justify-between p-3 rounded-lg border text-xs transition-all ${
            verifyMutation.data.intact
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {verifyMutation.data.intact ? (
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="font-medium">{verifyMutation.data.message}</span>
          </div>
          <span className="font-mono text-[11px] font-semibold text-emerald-900 dark:text-emerald-200">
            Verified {verifyMutation.data.verifiedCount} blocks
          </span>
        </div>
      )}

      {/* Filter Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl backdrop-blur-md bg-white/40 dark:bg-slate-900/40 border border-white/20 dark:border-white/10">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tenant Selector (Sovereign Custody) */}
          <Select value={tenantFilter} onValueChange={setTenantFilter}>
            <SelectTrigger aria-label="Filter audit logs by tenant" className="h-8 w-44 text-xs font-mono bg-white/50 dark:bg-slate-950/50">
              <SelectValue placeholder="Scope Tenant" />
            </SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem value="SYSTEM">SYSTEM (Fleet-Wide)</SelectItem>
              <SelectItem value="tenant-us-east-1">tenant-us-east-1</SelectItem>
              <SelectItem value="tenant-eu-central-1">tenant-eu-central-1</SelectItem>
              <SelectItem value="tenant-us-west-2">tenant-us-west-2</SelectItem>
            </SelectContent>
          </Select>

          {/* Operation Filter */}
          <Select value={operationFilter} onValueChange={setOperationFilter}>
            <SelectTrigger aria-label="Filter audit logs by operation type" className="h-8 w-36 text-xs bg-white/50 dark:bg-slate-950/50">
              <SelectValue placeholder="All Operations" />
            </SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem value="ALL">All Operations</SelectItem>
              <SelectItem value="CREATE">CREATE</SelectItem>
              <SelectItem value="UPDATE">UPDATE</SelectItem>
              <SelectItem value="PATCH">PATCH</SelectItem>
              <SelectItem value="SOFT_DELETE">SOFT_DELETE</SelectItem>
              <SelectItem value="RESTORE">RESTORE</SelectItem>
            </SelectContent>
          </Select>

          {/* Actor Search Input */}
          <div className="relative w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={actorSearch}
              onChange={(e) => setActorSearch(e.target.value)}
              placeholder="Filter by actor..."
              className="h-8 pl-8 text-xs bg-white/50 dark:bg-slate-950/50"
            />
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Main Standardized DataTable */}
      <div className="rounded-xl overflow-hidden border border-white/20 dark:border-white/10 shadow-sm bg-white/50 dark:bg-slate-950/50 backdrop-blur-md">
        <DataTable
          table={table}
          showRowIndex
          emptyState={
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <ShieldCheck className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium">No audit mutations found</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                No ledger records match the selected tenant or operation criteria.
              </p>
            </div>
          }
        />
        <div className="p-3 border-t border-white/10">
          <DataTablePagination table={table} />
        </div>
      </div>

      {/* Detail Diff Inspection Dialog */}
      <Dialog open={Boolean(inspectRecord)} onOpenChange={(open) => !open && setInspectRecord(null)}>
        <DialogContent className="max-w-2xl text-xs max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <span>Audit Block #{inspectRecord?.id} Inspection</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                {inspectRecord?.operation}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-black dark:text-white font-medium">
              Cryptographic state diff and forward-hash anchoring details.
            </DialogDescription>
          </DialogHeader>

          {inspectRecord && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-950 font-mono text-[11px]">
                <div>
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">Current Hash:</span>
                  <p className="break-all font-semibold text-primary">{inspectRecord.currentHash || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">Previous Hash:</span>
                  <p className="break-all text-slate-700 dark:text-slate-300">{inspectRecord.prevHash || 'Genesis'}</p>
                </div>
              </div>

              <div>
                <span className="font-bold text-black dark:text-white text-xs block mb-1.5">Attribute Delta (JSON Diff):</span>
                <pre className="p-3 rounded-lg bg-slate-950 text-slate-100 font-mono text-[11px] overflow-x-auto border border-white/10">
                  {JSON.stringify(inspectRecord.delta || {}, null, 2)}
                </pre>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="font-bold text-black dark:text-white text-xs block mb-1">State Snapshot (New Attributes):</span>
                  <pre className="p-2.5 rounded-lg bg-slate-950 text-slate-100 font-mono text-[10px] overflow-x-auto max-h-40 border border-white/10">
                    {JSON.stringify(inspectRecord.newAttributes || {}, null, 2)}
                  </pre>
                </div>
                <div>
                  <span className="font-bold text-black dark:text-white text-xs block mb-1">Previous Snapshot (Old Attributes):</span>
                  <pre className="p-2.5 rounded-lg bg-slate-950 text-slate-100 font-mono text-[10px] overflow-x-auto max-h-40 border border-white/10">
                    {JSON.stringify(inspectRecord.oldAttributes || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

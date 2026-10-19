import React, { useState, useMemo } from 'react';
import type { EntityRecord, RecordAuditLog, RestorePreviewResponse } from '../../api/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  History,
  RotateCcw,
  Clock,
  User,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  FileDiff,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useRecordAuditLogs,
  usePreviewRestoreRecord,
  useRestoreRecordVersion,
} from '../../api/metadata-api';
import { useAuthStore } from '@/stores/auth-store';
import { useSandboxStore } from '@/core/sandbox/store/sandbox-store';

interface Props {
  record: EntityRecord | null;
  entityTypeId: string | number;
  open: boolean;
  onClose: () => void;
}

export const RecordAuditHistoryDrawer: React.FC<Props> = ({
  record,
  entityTypeId,
  open,
  onClose,
}) => {
  const recordId = record?.id ?? null;
  const currentVersion = record?.version ?? 1;

  // Audit Logs query
  const { data: auditLogs = [], isLoading, isError } = useRecordAuditLogs(
    entityTypeId,
    recordId
  );

  // Auth / Sovereign check
  const authUser = useAuthStore((s) => s.auth.user);
  const sandboxPersonaId = useSandboxStore((s) => s.activePersonaId);
  const isSovereign = useMemo(() => {
    if (authUser?.role?.includes('ROLE_SYSTEM_CUSTODIAN') || authUser?.role?.includes('ROLE_SOVEREIGN_ADMIN')) {
      return true;
    }
    if (import.meta.env.DEV && sandboxPersonaId === 'system') {
      return true;
    }
    return false;
  }, [authUser, sandboxPersonaId]);

  // Selected audit log for restore preview
  const [selectedAuditLog, setSelectedAuditLog] = useState<RecordAuditLog | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState<boolean>(false);

  // Restore preview query
  const { data: previewData, isLoading: isPreviewLoading } = usePreviewRestoreRecord(
    entityTypeId,
    recordId,
    selectedAuditLog?.id ?? null
  );

  // Restore mutation
  const restoreMutation = useRestoreRecordVersion(entityTypeId);

  const handleOpenRestorePreview = (log: RecordAuditLog) => {
    setSelectedAuditLog(log);
    setIsPreviewDialogOpen(true);
  };

  const handleConfirmRestore = async () => {
    if (!recordId || !selectedAuditLog) return;
    try {
      await restoreMutation.mutateAsync({
        recordId,
        auditLogId: selectedAuditLog.id,
      });
      toast.success(
        `Record #${recordId} successfully restored to target state of v${selectedAuditLog.version} (now at v${currentVersion + 1})`
      );
      setIsPreviewDialogOpen(false);
      setSelectedAuditLog(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to restore record version');
    }
  };

  const getOperationBadge = (operation: string) => {
    switch (operation) {
      case 'CREATE':
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold"
          >
            CREATE
          </Badge>
        );
      case 'UPDATE':
        return (
          <Badge
            variant="outline"
            className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 font-semibold"
          >
            UPDATE
          </Badge>
        );
      case 'PATCH':
        return (
          <Badge
            variant="outline"
            className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 font-semibold"
          >
            PATCH
          </Badge>
        );
      case 'SOFT_DELETE':
        return (
          <Badge
            variant="outline"
            className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-semibold"
          >
            SOFT_DELETE
          </Badge>
        );
      case 'RESTORE':
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold"
          >
            RESTORE
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="font-semibold">
            {operation}
          </Badge>
        );
    }
  };

  const formatTimestamp = (ts?: string) => {
    if (!ts) return 'Unknown';
    try {
      return new Date(ts).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl md:max-w-2xl flex flex-col p-0 bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border-l border-white/30 dark:border-white/10 shadow-2xl shadow-black/10 overflow-hidden"
        >
          {/* Header */}
          <SheetHeader className="p-6 border-b border-white/20 dark:border-white/10 shrink-0 bg-white/40 dark:bg-slate-900/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <SheetTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    Record Audit Ledger
                    <Badge variant="outline" className="font-mono text-xs">
                      #{recordId}
                    </Badge>
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                    Range-partitioned chronological immutable audit trail & OCC ledger
                  </SheetDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="font-mono text-xs px-2.5 py-1 bg-white/60 dark:bg-slate-800/60 border border-white/20"
                >
                  Current: v{currentVersion}
                </Badge>
              </div>
            </div>

            {/* Sovereign status badge */}
            <div className="mt-3 flex items-center justify-between px-3 py-2 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-white/20 dark:border-white/10 text-xs">
              <div className="flex items-center gap-2">
                {isSovereign ? (
                  <>
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                      Sovereign Root Custodian Session Active
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                    <span className="text-muted-foreground">
                      Standard Session (Rollback requires Sovereign Custodian)
                    </span>
                  </>
                )}
              </div>
              {isSovereign && (
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold uppercase">
                  Restore Unlocked
                </span>
              )}
            </div>
          </SheetHeader>

          {/* Timeline Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm">Fetching partitioned audit logs...</span>
              </div>
            )}

            {isError && (
              <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-3 text-sm">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>Failed to load audit records for this entity record.</span>
              </div>
            )}

            {!isLoading && !isError && auditLogs.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No audit log entries recorded for this entity record.
              </div>
            )}

            {!isLoading && !isError && auditLogs.length > 0 && (
              <div className="relative pl-6 border-l-2 border-primary/20 space-y-6">
                {auditLogs.map((log) => {
                  const isCurrent = Number(log.version) === Number(currentVersion);
                  const canRestore = isSovereign && Number(log.version) < Number(currentVersion);

                  return (
                    <div
                      key={log.id}
                      className="relative flex flex-col gap-3 p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-white/30 dark:border-white/10 shadow-lg shadow-black/5 backdrop-blur-xl transition hover:border-primary/40"
                    >
                      {/* Timeline dot */}
                      <div className="absolute -left-[31px] top-5 h-3.5 w-3.5 rounded-full bg-primary border-4 border-background" />

                      {/* Log Header */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs font-bold">
                            v{log.version}
                          </Badge>
                          {getOperationBadge(log.operation)}
                          {isCurrent && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] bg-primary/10 text-primary border-primary/20 font-semibold"
                            >
                              HEAD
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {log.changedBy || 'system'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatTimestamp(log.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Structured Field Changes / Delta */}
                      <div className="mt-1">
                        {log.delta && Object.keys(log.delta).length > 0 ? (
                          <div className="space-y-2">
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                              Attribute Mutations ({Object.keys(log.delta).length})
                            </span>
                            <div className="divide-y divide-white/15 dark:divide-white/5 rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-950/40 p-2.5 text-xs font-mono">
                              {Object.entries(log.delta).map(([key, diff]) => (
                                <div
                                  key={key}
                                  className="py-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                                >
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {key}:
                                  </span>
                                  <div className="flex items-center gap-2 text-xs overflow-x-auto">
                                    <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 line-through">
                                      {diff.old === null || diff.old === undefined
                                        ? 'null'
                                        : typeof diff.old === 'object'
                                        ? JSON.stringify(diff.old)
                                        : String(diff.old)}
                                    </span>
                                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold">
                                      {diff.new === null || diff.new === undefined
                                        ? 'null'
                                        : typeof diff.new === 'object'
                                        ? JSON.stringify(diff.new)
                                        : String(diff.new)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : log.operation === 'CREATE' ? (
                          <div className="text-xs text-muted-foreground italic">
                            Initial record created with{' '}
                            {Object.keys(log.newAttributes || {}).length} attribute(s).
                          </div>
                        ) : log.operation === 'SOFT_DELETE' ? (
                          <div className="text-xs text-rose-500 font-medium">
                            Record marked deleted via cascade or direct deletion.
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground italic">
                            No discrete attribute differences recorded.
                          </div>
                        )}
                      </div>

                      {/* Restore Action */}
                      <div className="mt-2 flex items-center justify-between pt-2 border-t border-white/15 dark:border-white/5">
                        <span className="text-[11px] text-muted-foreground">
                          ID: <span className="font-mono">{log.id}</span>
                        </span>

                        {Number(log.version) < Number(currentVersion) && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!isSovereign || restoreMutation.isPending}
                            onClick={() => handleOpenRestorePreview(log)}
                            title={
                              isSovereign
                                ? 'Preview dry-run restore to this version'
                                : 'Sovereign Root Custodian required to restore record versions'
                            }
                            className={`gap-1.5 text-xs h-7 rounded-lg ${
                              isSovereign
                                ? 'border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10'
                                : 'opacity-50 cursor-not-allowed'
                            }`}
                          >
                            <RotateCcw className="h-3 w-3" />
                            {isSovereign ? 'Preview Restore' : 'Restore (Locked)'}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Sovereign Restore Preview Confirmation Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <RotateCcw className="h-5 w-5" />
              <DialogTitle className="text-lg font-bold">
                Confirm Sovereign Record Version Restore
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Restoring rolls back attributes to the snapshot of Target Version{' '}
              <strong className="text-foreground">v{selectedAuditLog?.version}</strong> while executing a{' '}
              <strong className="text-foreground">monotonic version bump</strong> to preserve OCC integrity and append an audit ledger entry.
            </DialogDescription>
          </DialogHeader>

          {isPreviewLoading && (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Computing dry-run diff against active schema...</span>
            </div>
          )}

          {!isPreviewLoading && previewData && (
            <div className="space-y-4 my-2 text-xs">
              {/* Version transition banner */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-2xl bg-white/50 dark:bg-slate-800/50 border border-white/20 text-center">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Current Version</div>
                  <div className="font-mono font-bold text-base text-foreground">
                    v{previewData.currentVersion}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Target Version</div>
                  <div className="font-mono font-bold text-base text-amber-600 dark:text-amber-400">
                    v{previewData.targetVersion}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Next Version</div>
                  <div className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-400">
                    v{previewData.nextVersion}
                  </div>
                </div>
              </div>

              {/* Computed Delta Preview */}
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  <FileDiff className="h-4 w-4 text-primary" />
                  <span>Computed Field Diffs ({Object.keys(previewData.delta || {}).length})</span>
                </div>

                {Object.keys(previewData.delta || {}).length > 0 ? (
                  <div className="max-h-56 overflow-y-auto divide-y divide-white/10 rounded-xl border border-white/20 dark:border-white/10 bg-black/5 dark:bg-black/30 p-2 font-mono">
                    {Object.entries(previewData.delta).map(([field, diff]) => (
                      <div
                        key={field}
                        className="py-1.5 flex items-center justify-between gap-2"
                      >
                        <span className="font-semibold text-foreground">{field}:</span>
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 line-through">
                            {diff.old === null || diff.old === undefined
                              ? 'null'
                              : typeof diff.old === 'object'
                              ? JSON.stringify(diff.old)
                              : String(diff.old)}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold">
                            {diff.new === null || diff.new === undefined
                              ? 'null'
                              : typeof diff.new === 'object'
                              ? JSON.stringify(diff.new)
                              : String(diff.new)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-center text-muted-foreground italic rounded-xl border border-dashed border-white/20">
                    No field differences. Target version matches current record attributes.
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPreviewDialogOpen(false)}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={restoreMutation.isPending || isPreviewLoading}
              onClick={handleConfirmRestore}
              className="text-xs rounded-xl bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-lg shadow-amber-600/20"
            >
              {restoreMutation.isPending ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Restoring...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Execute Sovereign Restore (to v{previewData?.nextVersion ?? currentVersion + 1})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

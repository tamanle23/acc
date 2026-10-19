import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  GitCompare,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  XCircle,
  ChevronRight,
  Info,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  useWorkflowVersions,
  useFleetMigrationPreview,
  useFleetBatchMigrate,
  type FleetExecutionPreviewItem,
  type MigrationTier,
} from '@/features/workflows/api/workflow-api';
import { toast } from 'sonner';

interface FleetMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowKey: string;
  workflowName?: string;
  currentVersion: number;
}

export const FleetMigrationModal: React.FC<FleetMigrationModalProps> = ({
  isOpen,
  onClose,
  workflowKey,
  workflowName,
  currentVersion,
}) => {
  const { data: versions = [] } = useWorkflowVersions(workflowKey);
  const [selectedTargetVersion, setSelectedTargetVersion] = useState<number>(currentVersion + 1);
  const [tierFilter, setTierFilter] = useState<'ALL' | MigrationTier>('ALL');
  const [selectedExecutionIds, setSelectedExecutionIds] = useState<Set<string>>(new Set());
  const [inspectingExecution, setInspectingExecution] = useState<FleetExecutionPreviewItem | null>(null);
  const [showConfirmReaffirm, setShowConfirmReaffirm] = useState(false);

  const { data: previewData, isLoading: isPreviewLoading, refetch: refetchPreview } = useFleetMigrationPreview(
    workflowKey,
    selectedTargetVersion
  );

  const batchMigrateMutation = useFleetBatchMigrate();

  const previewItems = previewData?.items;
  const filteredItems = useMemo(() => {
    if (!previewItems) return [];
    if (tierFilter === 'ALL') return previewItems;
    return previewItems.filter((item) => item.tier === tierFilter);
  }, [previewItems, tierFilter]);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allSelectable = (previewData?.items || [])
        .filter((it) => it.compatible)
        .map((it) => it.workflowId);
      setSelectedExecutionIds(new Set(allSelectable));
    } else {
      setSelectedExecutionIds(new Set());
    }
  };

  const toggleSelectRow = (workflowId: string) => {
    setSelectedExecutionIds((prev) => {
      const next = new Set(prev);
      if (next.has(workflowId)) {
        next.delete(workflowId);
      } else {
        next.add(workflowId);
      }
      return next;
    });
  };

  const handleMigrateSelected = async () => {
    if (selectedExecutionIds.size === 0) {
      toast.error('Select at least one execution to migrate');
      return;
    }
    await batchMigrateMutation.mutateAsync({
      workflowKey,
      targetVersion: selectedTargetVersion,
      executionIds: Array.from(selectedExecutionIds),
    });
    setSelectedExecutionIds(new Set());
    refetchPreview();
  };

  const handleMigrateAllCompatible = async () => {
    setShowConfirmReaffirm(false);
    await batchMigrateMutation.mutateAsync({
      workflowKey,
      targetVersion: selectedTargetVersion,
      autoMigrateCompatibleOnly: true,
    });
    setSelectedExecutionIds(new Set());
    refetchPreview();
  };

  const summary = previewData?.summary || { total: 0, fullyCompatible: 0, requiresReview: 0, incompatible: 0 };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[850px] p-0 overflow-hidden border border-white/30 dark:border-white/10 shadow-2xl bg-background/80 backdrop-blur-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-border/40 bg-card/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
                <GitCompare className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight">
                  Fleet In-Flight Hot Migration
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-mono">
                  {workflowName || workflowKey} ({workflowKey})
                </DialogDescription>
              </div>
            </div>

            <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-widest bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 gap-1">
              <ShieldCheck className="w-3 h-3" />
              Quiescence Guard
            </Badge>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Target Version Selector */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-border/60 bg-muted/30">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Active Catalog Version
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-sm px-2.5 py-1">
                  v{currentVersion}
                </Badge>
                <span className="text-xs text-muted-foreground">Standard Baseline</span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-primary/30 bg-primary/5">
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wider block mb-1">
                Target Migration Version
              </span>
              <select
                aria-label="Target Migration Version"
                value={selectedTargetVersion}
                onChange={(e) => {
                  setSelectedTargetVersion(Number(e.target.value));
                  setSelectedExecutionIds(new Set());
                }}
                className="w-full text-xs bg-background/80 border border-input rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary font-medium"
              >
                {versions.length === 0 ? (
                  <option value={currentVersion + 1}>v{currentVersion + 1} (NextGen Target)</option>
                ) : (
                  versions.map((ver) => (
                    <option key={ver.version} value={ver.version}>
                      v{ver.version} - {ver.name} ({ver.status})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* 3-Tier Heuristic Bento Metric Filters */}
          <div className="grid grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => setTierFilter('ALL')}
              className={`p-3 rounded-xl border text-left transition-all ${
                tierFilter === 'ALL'
                  ? 'border-primary bg-primary/10 shadow-sm'
                  : 'border-border/60 bg-muted/20 hover:bg-muted/40'
              }`}
            >
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Total In-Flight
              </span>
              <span className="text-xl font-bold tracking-tight text-foreground">
                {summary.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTierFilter('FULLY_COMPATIBLE')}
              className={`p-3 rounded-xl border text-left transition-all ${
                tierFilter === 'FULLY_COMPATIBLE'
                  ? 'border-emerald-500 bg-emerald-500/15 shadow-sm'
                  : 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                  Compatible
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <span className="text-xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
                {summary.fullyCompatible}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTierFilter('CONDITIONAL_REQUIRES_MANUAL_REVIEW')}
              className={`p-3 rounded-xl border text-left transition-all ${
                tierFilter === 'CONDITIONAL_REQUIRES_MANUAL_REVIEW'
                  ? 'border-amber-500 bg-amber-500/15 shadow-sm'
                  : 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider block">
                  Requires Review
                </span>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <span className="text-xl font-bold tracking-tight text-amber-700 dark:text-amber-300">
                {summary.requiresReview}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTierFilter('INCOMPATIBLE_BLOCK')}
              className={`p-3 rounded-xl border text-left transition-all ${
                tierFilter === 'INCOMPATIBLE_BLOCK'
                  ? 'border-rose-500 bg-rose-500/15 shadow-sm'
                  : 'border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider block">
                  Incompatible
                </span>
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
              </div>
              <span className="text-xl font-bold tracking-tight text-rose-700 dark:text-rose-300">
                {summary.incompatible}
              </span>
            </button>
          </div>

          {/* Executions Table */}
          <div className="rounded-xl border border-border/70 overflow-hidden bg-background/50">
            <div className="p-2.5 bg-muted/40 border-b border-border/40 flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={
                    filteredItems.length > 0 &&
                    filteredItems.every((it) => selectedExecutionIds.has(it.workflowId))
                  }
                  onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                  aria-label="Select all executions"
                />
                <span className="text-muted-foreground uppercase text-[11px] tracking-wider">
                  Select Compatible Executions ({selectedExecutionIds.size} selected)
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Showing {filteredItems.length} of {summary.total}
              </span>
            </div>

            <div className="divide-y divide-border/30 max-h-[220px] overflow-y-auto">
              {isPreviewLoading ? (
                <div className="p-8 text-center text-xs text-muted-foreground italic">
                  Running heuristic topological compatibility analysis...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No active executions in this tier category.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selectedExecutionIds.has(item.workflowId);
                  return (
                    <div
                      key={item.workflowId}
                      className={`p-2.5 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Checkbox
                          checked={isSelected}
                          disabled={!item.compatible}
                          onCheckedChange={() => toggleSelectRow(item.workflowId)}
                          aria-label={`Select ${item.workflowId}`}
                        />
                        <div className="flex flex-col">
                          <span className="font-mono font-medium text-foreground">{item.workflowId}</span>
                          <span className="text-[10px] text-muted-foreground">
                            Active v{item.currentVersion} • Completed {item.completedTasks.length} nodes
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.tier === 'FULLY_COMPATIBLE' && (
                          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Compatible
                          </Badge>
                        )}
                        {item.tier === 'CONDITIONAL_REQUIRES_MANUAL_REVIEW' && (
                          <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Requires Review
                          </Badge>
                        )}
                        {item.tier === 'INCOMPATIBLE_BLOCK' && (
                          <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10px] gap-1">
                            <XCircle className="w-3 h-3" />
                            Blocked
                          </Badge>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px] gap-1 text-primary hover:text-primary"
                          onClick={() => setInspectingExecution(item)}
                        >
                          Inspect
                          <ChevronRight className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Inspection Drawer / Preview */}
          {inspectingExecution && (
            <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  Topological Diagnostics: {inspectingExecution.workflowId}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-[10px]"
                  onClick={() => setInspectingExecution(null)}
                >
                  Close
                </Button>
              </div>

              {inspectingExecution.warnings.length > 0 && (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-[11px] space-y-1">
                  <span className="font-semibold block">Migration Warnings:</span>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {inspectingExecution.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {inspectingExecution.issues.length > 0 && (
                <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-200 text-[11px] space-y-1">
                  <span className="font-semibold block">Blocking Issues:</span>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {inspectingExecution.issues.map((iss, idx) => (
                      <li key={idx}>{iss}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-[11px] text-muted-foreground flex gap-4 pt-1">
                <span>Completed: {inspectingExecution.completedTasks.join(', ') || 'None'}</span>
                <span>Active Frontier: {inspectingExecution.activeTasks.join(', ') || 'None'}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 px-6 border-t border-border/40 bg-card/40 flex items-center justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowConfirmReaffirm(true)}
              disabled={batchMigrateMutation.isPending || summary.fullyCompatible === 0}
              className="text-xs gap-1.5 bg-rose-600 hover:bg-rose-700 text-white border-rose-700/50 shadow-sm"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Migrate All Compatible ({summary.fullyCompatible})
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleMigrateSelected}
              disabled={batchMigrateMutation.isPending || selectedExecutionIds.size === 0}
              className="text-xs gap-1.5 shadow-md shadow-primary/20"
            >
              <GitCompare className="w-3.5 h-3.5" />
              Migrate Selected ({selectedExecutionIds.size})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={showConfirmReaffirm}
        onOpenChange={setShowConfirmReaffirm}
        title="Reaffirm Fleet Hot Migration"
        desc={
          <div className="space-y-2 text-xs">
            <p>
              Are you sure you want to perform in-flight hot migration on all{' '}
              <strong className="text-foreground">{summary.fullyCompatible}</strong> compatible executions of{' '}
              <code className="px-1 py-0.5 rounded bg-muted font-mono">{workflowKey}</code> to target version{' '}
              <strong className="text-foreground">v{selectedTargetVersion}</strong>?
            </p>
            <p className="text-muted-foreground">
              This will acquire an execution quiescence lock on each running instance, drain active worker leases,
              update the definition snapshot, and append tamper-evident cryptographic audit records.
            </p>
          </div>
        }
        destructive={true}
        confirmText="Yes, Reaffirm & Migrate All"
        cancelBtnText="Cancel"
        isLoading={batchMigrateMutation.isPending}
        handleConfirm={handleMigrateAllCompatible}
      />
    </Dialog>
  );
};

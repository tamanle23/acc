import React, { useState } from 'react';
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
import {
  GitCompare,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  ShieldCheck,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  useWorkflowVersions,
  useMigrationDryRun,
  useMigrateExecution,
  useVerifyAuditLedger,
  type MigrationValidationReport,
} from '@/features/workflows/api/workflow-api';
import { toast } from 'sonner';

interface HotMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowKey: string;
  executionId: string;
  currentVersion: number;
  onMigrationSuccess?: () => void;
}

export const HotMigrationModal: React.FC<HotMigrationModalProps> = ({
  isOpen,
  onClose,
  workflowKey,
  executionId,
  currentVersion,
  onMigrationSuccess,
}) => {
  const { data: versions = [] } = useWorkflowVersions(workflowKey);
  const [selectedVersion, setSelectedVersion] = useState<number>(currentVersion + 1);
  const [dryRunReport, setDryRunReport] = useState<MigrationValidationReport | null>(null);

  const dryRunMutation = useMigrationDryRun();
  const migrateMutation = useMigrateExecution();
  const { data: auditVerification } = useVerifyAuditLedger(executionId);

  const targetVersionItem = versions.find((v) => v.version === selectedVersion);

  const handleDryRun = async () => {
    if (!targetVersionItem) {
      toast.error('Select a target version for migration');
      return;
    }
    try {
      const report = await dryRunMutation.mutateAsync({
        executionId,
        targetDefinition: targetVersionItem.definition,
      });
      setDryRunReport(report);
      if (report.compatible) {
        toast.success(`Topological compatibility verified for ${report.targetVersion}`);
      } else {
        toast.warning('Migration compatibility issues detected');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Validation failed');
    }
  };

  const handleExecuteMigration = async () => {
    if (!targetVersionItem) return;
    try {
      await migrateMutation.mutateAsync({
        executionId,
        targetDefinition: targetVersionItem.definition,
      });
      onMigrationSuccess?.();
      onClose();
    } catch {
      // handled in mutation onError
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl backdrop-blur-2xl bg-white/90 dark:bg-slate-900/90 border border-white/40 dark:border-white/10 shadow-2xl rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Policy B: In-Flight Hot Migration</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Safely rewire running execution <span className="font-mono text-foreground font-semibold">{executionId}</span> across workflow definition topologies with cryptographic audit guarantees.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Audit Trail Badge */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-medium">Audit Ledger Integrity</span>
            </div>
            {auditVerification?.verified ? (
              <Badge variant="outline" className="text-emerald-600 bg-emerald-500/10 border-emerald-500/30 text-[10px] gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Cryptographically Verified ({auditVerification.totalEvents} Events)
              </Badge>
            ) : (
              <Badge variant="outline" className="text-rose-600 bg-rose-500/10 border-rose-500/30 text-[10px] gap-1">
                <AlertTriangle className="w-3 h-3" />
                Ledger Warning ({auditVerification?.details || 'Unverified'})
              </Badge>
            )}
          </div>

          {/* Version Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-border/60 bg-muted/30">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Active Execution Version
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-sm px-2.5 py-1">
                  v{currentVersion}
                </Badge>
                <span className="text-xs text-muted-foreground">Immutable Snapshot</span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-primary/30 bg-primary/5">
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wider block mb-1">
                Target Migration Version
              </span>
              <select
                aria-label="Target Migration Version"
                value={selectedVersion}
                onChange={(e) => {
                  setSelectedVersion(Number(e.target.value));
                  setDryRunReport(null);
                }}
                className="w-full text-xs bg-background/80 border border-input rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary font-medium"
              >
                {versions.length === 0 ? (
                  <option value={currentVersion + 1}>v{currentVersion + 1} (Draft NextGen)</option>
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

          {/* Dry Run Report */}
          {dryRunReport && (
            <div className="p-3.5 rounded-xl border border-border/80 bg-background/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-tight flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  Topological Graph Compatibility Validator
                </span>
                {dryRunReport.compatible ? (
                  <Badge className="bg-emerald-500 text-white text-[10px] gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Compatible
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertTriangle className="w-3 h-3" /> Incompatible
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  <span className="block font-semibold">Preserved Tasks</span>
                  <span className="font-mono text-xs">{dryRunReport.completedTasksPreserved.length} tasks</span>
                </div>
                <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300">
                  <span className="block font-semibold">Active Frontier</span>
                  <span className="font-mono text-xs">{dryRunReport.activeFrontierTasks.length} tasks</span>
                </div>
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300">
                  <span className="block font-semibold">Downstream Added</span>
                  <span className="font-mono text-xs">{dryRunReport.addedDownstreamTasks.length} tasks</span>
                </div>
              </div>

              {dryRunReport.issues.length > 0 && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs space-y-1">
                  <span className="font-bold block">Migration Blockers:</span>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                    {dryRunReport.issues.map((iss, idx) => (
                      <li key={idx}>{iss}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>

          {!dryRunReport || !dryRunReport.compatible ? (
            <Button
              size="sm"
              onClick={handleDryRun}
              disabled={dryRunMutation.isPending}
              className="gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {dryRunMutation.isPending ? 'Validating...' : 'Dry-Run Compatibility Check'}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleExecuteMigration}
              disabled={migrateMutation.isPending}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              {migrateMutation.isPending ? 'Migrating...' : `Commit Hot Migration to v${selectedVersion}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

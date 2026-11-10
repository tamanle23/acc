import React from 'react';
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
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  MinusCircle,
  FileDiff,
  Sparkles,
} from 'lucide-react';
import type { DagNodeData } from '../canvas/dag-node';
import type { TaskDefinitionRecord } from '@/features/workflows/api/task-definition-api';

export interface TaskVersionDiffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeData: DagNodeData | null;
  currentRecord?: TaskDefinitionRecord | null;
  targetRecord?: TaskDefinitionRecord | null;
  onConfirmUpgrade: (
    taskRef: string,
    targetVersion: number,
    newSchemas: { inputSchema?: Record<string, unknown>; outputSchema?: Record<string, unknown> }
  ) => void;
}

export const TaskVersionDiffModal: React.FC<TaskVersionDiffModalProps> = ({
  open,
  onOpenChange,
  nodeData,
  currentRecord,
  targetRecord,
  onConfirmUpgrade,
}) => {
  if (!nodeData || !targetRecord) return null;

  const currentVersion = nodeData.taskDefVersion ?? currentRecord?.version ?? 1;
  const targetVersion = targetRecord.version;

  const currInputProps = (currentRecord?.inputSchema?.properties as Record<string, any>) || {};
  const currInputReq = (currentRecord?.inputSchema?.required as string[]) || [];

  const targetInputProps = (targetRecord.inputSchema?.properties as Record<string, any>) || {};
  const targetInputReq = (targetRecord.inputSchema?.required as string[]) || [];

  const currKeys = Object.keys(currInputProps);
  const targetKeys = Object.keys(targetInputProps);

  const addedProps = targetKeys.filter((k) => !currKeys.includes(k));
  const removedProps = currKeys.filter((k) => !targetKeys.includes(k));
  const newRequiredProps = targetInputReq.filter((k) => !currInputReq.includes(k));

  const currOutputProps = Object.keys((currentRecord?.outputSchema?.properties as Record<string, any>) || {});
  const targetOutputProps = Object.keys((targetRecord.outputSchema?.properties as Record<string, any>) || {});
  const addedOutputs = targetOutputProps.filter((k) => !currOutputProps.includes(k));
  const removedOutputs = currOutputProps.filter((k) => !targetOutputProps.includes(k));

  const handleUpgrade = () => {
    onConfirmUpgrade(nodeData.taskReferenceName, targetVersion, {
      inputSchema: targetRecord.inputSchema,
      outputSchema: targetRecord.outputSchema,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="task-version-diff-modal"
        className="max-w-2xl backdrop-blur-2xl bg-white/90 dark:bg-slate-900/90 border border-white/30 dark:border-white/10 shadow-2xl rounded-2xl"
      >
        <DialogHeader className="border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <FileDiff className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Upgrade Task Definition: {nodeData.taskDefName || nodeData.label}</span>
                <Badge variant="outline" className="font-mono text-xs">
                  v{currentVersion}
                </Badge>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-primary/30 font-mono text-xs">
                  v{targetVersion}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Review contract additions and modifications before updating this node.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Changelog & Version Meta */}
          {targetRecord.changelogNote && (
            <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
              <span className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Version {targetVersion} Release Notes:
              </span>
              <p className="text-muted-foreground">{targetRecord.changelogNote}</p>
            </div>
          )}

          {/* Breaking Change Warning */}
          {newRequiredProps.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <span className="font-bold">Required Parameters Added:</span>
                <p className="mt-0.5 text-[11px]">
                  The new version requires values for: <code className="font-mono font-bold">{newRequiredProps.join(', ')}</code>.
                  Ensure you map inputs in the Property Inspector after upgrading.
                </p>
              </div>
            </div>
          )}

          {/* Input Schema Diff */}
          <div className="space-y-2">
            <span className="font-semibold text-foreground">Input Parameter Schema Changes:</span>
            <div className="p-3 rounded-xl bg-slate-900/5 dark:bg-black/30 border border-border/40 font-mono text-[11px] space-y-1">
              {addedProps.length === 0 && removedProps.length === 0 ? (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Input parameters structure is backwards-compatible.</span>
                </div>
              ) : (
                <>
                  {addedProps.map((p) => (
                    <div key={p} className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <PlusCircle className="w-3 h-3 shrink-0" />
                      <span>+ {p}: {targetInputProps[p]?.type || 'any'} {targetInputReq.includes(p) ? '(required)' : '(optional)'}</span>
                    </div>
                  ))}
                  {removedProps.map((p) => (
                    <div key={p} className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 line-through">
                      <MinusCircle className="w-3 h-3 shrink-0" />
                      <span>- {p}: {currInputProps[p]?.type || 'any'}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Output Schema Diff */}
          <div className="space-y-2">
            <span className="font-semibold text-foreground">Output Schema Changes:</span>
            <div className="p-3 rounded-xl bg-slate-900/5 dark:bg-black/30 border border-border/40 font-mono text-[11px] space-y-1">
              {addedOutputs.length === 0 && removedOutputs.length === 0 ? (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Output schemas are identical or fully backward compatible.</span>
                </div>
              ) : (
                <>
                  {addedOutputs.map((p) => (
                    <div key={p} className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <PlusCircle className="w-3 h-3 shrink-0" />
                      <span>+ {p}</span>
                    </div>
                  ))}
                  {removedOutputs.map((p) => (
                    <div key={p} className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 line-through">
                      <MinusCircle className="w-3 h-3 shrink-0" />
                      <span>- {p}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border/40 pt-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Keep v{currentVersion}
          </Button>
          <Button
            size="sm"
            onClick={handleUpgrade}
            data-testid="confirm-upgrade-task-btn"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Upgrade Node to v{targetVersion}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

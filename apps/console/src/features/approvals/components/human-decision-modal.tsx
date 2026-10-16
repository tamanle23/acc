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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  UserCheck,
  FileText,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import type { ApprovalTask } from '@unipost/client';
import { useResolveApprovalMutation } from '../hooks/use-approvals';

interface HumanDecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: ApprovalTask | null;
  onSuccess?: () => void;
}

export const HumanDecisionModal: React.FC<HumanDecisionModalProps> = ({
  isOpen,
  onClose,
  task,
  onSuccess,
}) => {
  const [comment, setComment] = useState('');
  const [verifiedInputs, setVerifiedInputs] = useState(false);
  const [confirmedIdentity, setConfirmedIdentity] = useState(false);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const resolveMutation = useResolveApprovalMutation();

  if (!task) return null;

  const handleResolve = async (action: 'APPROVE' | 'REJECT') => {
    setValidationError(null);
    if (action === 'REJECT' && !comment.trim()) {
      setValidationError('Decision rationale comment is mandatory when rejecting a workflow step.');
      return;
    }

    try {
      await resolveMutation.mutateAsync({
        taskId: task.taskId || task.id,
        payload: {
          action,
          comment: comment.trim() || undefined,
          formData: {
            verifiedInputs,
            confirmedIdentity,
            resolvedAt: new Date().toISOString(),
          },
        },
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setValidationError(err?.response?.data?.message || err?.message || 'Failed to submit decision');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden backdrop-blur-2xl bg-white/90 dark:bg-slate-900/90 border-white/20 dark:border-white/10 shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-5 border-b border-border/40 bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold tracking-tight">
                  Human Decision & Verification Gate
                </DialogTitle>
                <Badge variant="outline" className="font-mono text-[10px] bg-primary/5 text-primary border-primary/20">
                  {task.taskReferenceName}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Workflow: <span className="font-medium text-foreground">{task.workflowName || task.workflowKey}</span> ({task.workflowId})
              </DialogDescription>
            </div>

            {task.slaBreached ? (
              <Badge variant="destructive" className="flex items-center gap-1 text-[11px] font-semibold animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                SLA BREACHED
              </Badge>
            ) : (
              <Badge variant="secondary" className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20">
                <Clock className="w-3.5 h-3.5" />
                SLA: {task.slaMinutes || 120}m
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left Column: Context & Upstream Payload */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-primary" />
                Reviewer Instructions
              </span>
              <div className="p-3 rounded-xl bg-muted/30 border border-border/40 text-xs text-foreground leading-relaxed">
                {task.instructions || 'Review upstream execution parameters and verify KYC & compliance rules.'}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                Upstream Input Context
              </span>
              <pre className="p-3 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[220px] border border-white/10 shadow-inner">
                {JSON.stringify(task.inputData || {}, null, 2)}
              </pre>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>Required Role:</span>
              <span className="font-mono font-medium text-foreground">{task.role || 'ROLE_WORKFLOW_APPROVER'}</span>
            </div>
          </div>

          {/* Right Column: Decision Form & Verification */}
          <div className="space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Verification Checklist
                </span>
                <div className="space-y-2.5 p-3 rounded-xl bg-muted/20 border border-border/40">
                  <div className="flex items-start space-x-2.5">
                    <Checkbox
                      id="verifiedInputs"
                      checked={verifiedInputs}
                      onCheckedChange={(checked) => setVerifiedInputs(Boolean(checked))}
                      className="mt-0.5"
                    />
                    <label htmlFor="verifiedInputs" className="text-xs text-foreground cursor-pointer select-none leading-tight">
                      I have verified that upstream inputs, order IDs, and declaration certificates are accurate.
                    </label>
                  </div>

                  <div className="flex items-start space-x-2.5">
                    <Checkbox
                      id="confirmedIdentity"
                      checked={confirmedIdentity}
                      onCheckedChange={(checked) => setConfirmedIdentity(Boolean(checked))}
                      className="mt-0.5"
                    />
                    <label htmlFor="confirmedIdentity" className="text-xs text-foreground cursor-pointer select-none leading-tight">
                      Sign-off adheres to tenant regulatory compliance guidelines and segregation of duties.
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="decisionComment" className="text-xs font-semibold flex items-center justify-between">
                  <span>Decision Rationale & Comments</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Mandatory on rejection</span>
                </Label>
                <Textarea
                  id="decisionComment"
                  value={comment}
                  onChange={(e) => {
                    setComment(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="Provide rationale, audit sign-off notes, or rejection reason..."
                  rows={4}
                  className="text-xs leading-relaxed"
                />
              </div>

              {validationError && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}
            </div>

            {/* Quick Helper Note */}
            <p className="text-[10px] text-muted-foreground leading-normal italic">
              Approving advances the workflow to downstream execution stages. Rejecting triggers reverse Saga compensation.
            </p>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border/40 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={resolveMutation.isPending}
            className="text-xs"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => handleResolve('REJECT')}
              disabled={resolveMutation.isPending}
              className="text-xs font-medium gap-1.5"
            >
              {resolveMutation.isPending && actionType === 'REJECT' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <XCircle className="w-3.5 h-3.5" />
              )}
              Reject & Compensate
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => handleResolve('APPROVE')}
              disabled={resolveMutation.isPending || !verifiedInputs}
              className="text-xs font-medium gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
            >
              {resolveMutation.isPending && actionType === 'APPROVE' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              Approve Workflow Step
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

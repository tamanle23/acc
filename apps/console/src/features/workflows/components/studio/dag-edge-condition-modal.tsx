import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { GitBranch, AlertCircle, CheckCircle2 } from 'lucide-react';
import { validateBindingExpression } from './workflow-ir-converter';

export interface EdgeConditionModalData {
  edgeId: string;
  sourceTaskRef: string;
  targetTaskRef: string;
  sourceTaskType?: string;
  label?: string;
  condition?: string;
  decisionCase?: string;
  isDefaultCase?: boolean;
}

export interface DagEdgeConditionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  edgeData: EdgeConditionModalData | null;
  availableTaskRefs: string[];
  onSaveEdgeCondition: (
    edgeId: string,
    updates: {
      label?: string;
      condition?: string;
      decisionCase?: string;
      isDefaultCase?: boolean;
    }
  ) => void;
}

export function DagEdgeConditionModal({
  open,
  onOpenChange,
  edgeData,
  availableTaskRefs,
  onSaveEdgeCondition,
}: DagEdgeConditionModalProps) {
  const [label, setLabel] = useState('');
  const [condition, setCondition] = useState('');
  const [decisionCase, setDecisionCase] = useState('');
  const [isDefaultCase, setIsDefaultCase] = useState(false);

  useEffect(() => {
    if (edgeData) {
      setLabel(edgeData.label || '');
      setCondition(edgeData.condition || '');
      setDecisionCase(edgeData.decisionCase || '');
      setIsDefaultCase(Boolean(edgeData.isDefaultCase));
    }
  }, [edgeData]);

  if (!edgeData) return null;

  const isSwitchSource = edgeData.sourceTaskType === 'SWITCH';

  const conditionValidation = condition.includes('${')
    ? validateBindingExpression(condition, availableTaskRefs)
    : { valid: true };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!conditionValidation.valid) return;

    onSaveEdgeCondition(edgeData.edgeId, {
      label: label.trim() || undefined,
      condition: condition.trim() || undefined,
      decisionCase: decisionCase.trim() || undefined,
      isDefaultCase,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 backdrop-blur-2xl bg-white/95 dark:bg-slate-900/95 border border-white/20 dark:border-white/10 shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <GitBranch className="w-4 h-4" />
            </div>
            <DialogTitle className="text-base font-bold">Configure Branch Condition</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Transition connector from{' '}
            <span className="font-mono font-semibold text-foreground">{edgeData.sourceTaskRef}</span> to{' '}
            <span className="font-mono font-semibold text-foreground">{edgeData.targetTaskRef}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          {/* Edge Display Label */}
          <div className="space-y-1.5">
            <Label htmlFor="edge-label" className="text-xs font-semibold">
              Connector Label
            </Label>
            <Input
              id="edge-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. EXPRESS or High Value"
              className="text-xs h-8 bg-background/50"
              data-testid="dag-edge-label-input"
            />
          </div>

          {/* Switch Case Identifier */}
          {isSwitchSource && (
            <div className="space-y-1.5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-center justify-between">
                <Label htmlFor="decision-case" className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Switch Decision Case Key
                </Label>
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                  SWITCH
                </Badge>
              </div>
              <Input
                id="decision-case"
                value={decisionCase}
                onChange={(e) => setDecisionCase(e.target.value)}
                placeholder="e.g. EXPRESS, STANDARD"
                className="text-xs h-8 bg-background/50 font-mono"
                disabled={isDefaultCase}
                data-testid="dag-edge-case-input"
              />
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="default-case-checkbox"
                  checked={isDefaultCase}
                  onChange={(e) => {
                    setIsDefaultCase(e.target.checked);
                    if (e.target.checked) setDecisionCase('DEFAULT');
                  }}
                  className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                  data-testid="dag-edge-default-checkbox"
                />
                <Label htmlFor="default-case-checkbox" className="text-xs cursor-pointer text-muted-foreground">
                  Designate as fallback default branch
                </Label>
              </div>
            </div>
          )}

          {/* Transition Expression */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="edge-condition" className="text-xs font-semibold">
                Evaluation Expression
              </Label>
              {condition.includes('${') && (
                conditionValidation.valid ? (
                  <span className="text-[10px] text-emerald-500 flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Valid expression
                  </span>
                ) : (
                  <span className="text-[10px] text-rose-500 flex items-center gap-0.5">
                    <AlertCircle className="w-3 h-3" /> Syntax error
                  </span>
                )
              )}
            </div>
            <Input
              id="edge-condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="e.g. ${workflow.input.amount > 500}"
              className="text-xs h-8 bg-background/50 font-mono"
              data-testid="dag-edge-condition-input"
            />
            {conditionValidation.error && (
              <p className="text-[11px] text-rose-500">{conditionValidation.error}</p>
            )}
            <p className="text-[10px] text-muted-foreground">
              Evaluated during transition. Supports <code>${'{'}workflow.input.x{'}'}</code> and step output references.
            </p>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!conditionValidation.valid}
              className="h-8 text-xs bg-primary text-primary-foreground shadow-sm"
              data-testid="dag-edge-save-btn"
            >
              Apply Transition
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

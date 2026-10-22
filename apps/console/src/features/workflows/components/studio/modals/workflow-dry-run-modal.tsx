import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Play, Sparkles } from 'lucide-react';
import { VisualJsonEditor } from '@/components/ui/json-editor';
import { useSimulateWorkflowDefinition } from '@/features/workflows/api/workflow-api';
import type { WorkflowIR } from '../utils/workflow-ir-converter';

interface WorkflowDryRunModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowIR: WorkflowIR;
  onSimulationSuccess: (simulatedResult: any) => void;
}

export const WorkflowDryRunModal: React.FC<WorkflowDryRunModalProps> = ({
  open,
  onOpenChange,
  workflowIR,
  onSimulationSuccess,
}) => {
  const [mockInput, setMockInput] = useState<Record<string, unknown>>({
    orderId: 'ORD-TEST-9901',
    speed: 'EXPRESS',
    amount: 1500,
    postalCode: '94107',
  });

  const simulateMutation = useSimulateWorkflowDefinition();

  const handleRunSimulation = () => {
    simulateMutation.mutate(
      {
        definition: workflowIR,
        inputParameters: mockInput,
      },
      {
        onSuccess: (data) => {
          onSimulationSuccess(data);
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-6 rounded-2xl backdrop-blur-2xl bg-white/95 dark:bg-slate-900/95 border border-white/20 dark:border-white/10 shadow-2xl flex flex-col gap-4">
        <DialogHeader className="pb-2 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <DialogTitle className="text-base font-bold">
              Workflow Designer Dry-Run Simulator
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Execute an ephemeral, in-memory simulation of this DAG with custom mock inputs. Zero database records are created.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label className="text-xs font-semibold">
            Mock Input Parameters (${'{workflow.input.*}'})
          </Label>
          <VisualJsonEditor
            value={mockInput}
            onChange={(val) => {
              if (val && typeof val === 'object' && !Array.isArray(val)) {
                setMockInput(val);
              }
            }}
            defaultMode="form"
            height="220px"
          />
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border/40">
          <Button
            size="sm"
            variant="ghost"
            className="text-xs"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>

          <Button
            size="sm"
            onClick={handleRunSimulation}
            disabled={simulateMutation.isPending}
            className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white shadow-md"
            data-testid="run-dry-run-btn"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {simulateMutation.isPending ? 'Simulating...' : 'Run Simulation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSaveWorkflowDefinition } from '../api/workflow-api';
import type { WorkflowIR } from './studio';

interface WorkflowCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (workflowKey: string) => void;
}

export const WorkflowCreateDialog: React.FC<WorkflowCreateDialogProps> = ({
  open,
  onOpenChange,
  onCreated,
}) => {
  const [workflowKey, setWorkflowKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const saveMutation = useSaveWorkflowDefinition();

  const handleCreate = () => {
    if (!workflowKey.trim() || !name.trim()) return;

    const initialIr: WorkflowIR = {
      workflowKey: workflowKey.trim(),
      name: name.trim(),
      version: 1,
      description: description.trim() || undefined,
      tasks: [
        {
          taskReferenceName: 'startTask',
          taskType: 'SIMPLE',
          domain: 'default',
        },
      ],
      layoutMetadata: {
        startTask: { x: 100, y: 150 },
      },
    };

    saveMutation.mutate(initialIr, {
      onSuccess: () => {
        onCreated(workflowKey.trim());
        onOpenChange(false);
        setWorkflowKey('');
        setName('');
        setDescription('');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-white/20 dark:border-white/10 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Create New Workflow Definition</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="workflowKey">Workflow Key (unique slug)</Label>
            <Input
              id="workflowKey"
              placeholder="e.g. order-fulfillment-pipeline"
              value={workflowKey}
              onChange={(e) => setWorkflowKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              placeholder="e.g. Order Fulfillment Pipeline"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Brief summary of what this DAG accomplishes..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!workflowKey.trim() || !name.trim() || saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Creating...' : 'Create & Open Studio'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import type { DagNodeData } from '../canvas/dag-node';
import {
  validateBindingExpression,
  DEFAULT_DRAFT7_SCHEMA,
  inferDraft7Schema,
} from '../utils/workflow-ir-converter';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  GitFork,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Sliders,
  SlidersHorizontal,
  Settings2,
  Cpu,
  Braces,
  PlaySquare,
  StopCircle,
  FileCode,
  ArrowRightLeft,
  Copy,
  Check,
  Play,
  Sparkles,
} from 'lucide-react';
import { useWorkerCatalog, type TaskWorkerDescriptor } from '@/features/workers/api/worker-fleet-api';
import { VisualJsonEditor } from '@/components/ui/json-editor';
import { multiBranchRegistry } from '../utils/branch-strategies';
import { taskContractRegistry } from '../utils/contracts/task-contract-registry';
import { VariableBindingPopover } from '../canvas/variable-binding-popover';
import { executeStepSandboxTest, type StepTestResult } from '../sandbox/dag-step-sandbox-runner';
import { type Node, type Edge } from '@xyflow/react';

interface DagPropertyInspectorProps {
  nodeId: string | null;
  nodeData: DagNodeData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateNodeData: (nodeId: string, updatedData: Partial<DagNodeData>) => void;
  availableTaskRefs: string[];
  defaultTab?: string;
  onAddBranch?: (nodeId: string, customBranchName?: string) => void;
  onRemoveBranch?: (nodeId: string, branchId: string) => void;
  nodes?: Node<DagNodeData>[];
  edges?: Edge[];
}

export function DagPropertyInspector({
  nodeId,
  nodeData,
  open,
  onOpenChange,
  onUpdateNodeData,
  availableTaskRefs,
  defaultTab,
  onAddBranch,
  onRemoveBranch,
  nodes = [],
  edges = [],
}: DagPropertyInspectorProps) {
  const [formData, setFormData] = useState<DagNodeData | null>(nodeData);
  const [paramKey, setParamKey] = useState('');
  const [paramValue, setParamValue] = useState('');
  const [dataSubTab, setDataSubTab] = useState<'inputs' | 'outputs' | 'payloads'>('inputs');
  const [testStepResult, setTestStepResult] = useState<StepTestResult | null>(null);
  const { data: workerCatalog = [] } = useWorkerCatalog();

  useEffect(() => {
    setFormData(nodeData);
    setTestStepResult(null);
  }, [nodeData]);

  const handleRunStepTest = () => {
    if (!formData || !nodeId) return;

    const upstreamOutputs: Record<string, Record<string, unknown>> = {};
    nodes.forEach((n) => {
      if (n.data?.taskReferenceName) {
        upstreamOutputs[n.data.taskReferenceName] =
          n.data.mockOutputPayload ||
          n.data.outputParameters ||
          taskContractRegistry.getContract(n.data.taskType).defaultMockOutput;
      }
    });

    const startNode = nodes.find((n) => n.data?.isStartNode || n.data?.taskType === 'START_WORKFLOW');
    const workflowInput = startNode?.data?.inputParameters || { orderId: 'ORD-TEST-1', customerId: 'CUST-001' };

    const activeNode = {
      id: nodeId,
      type: 'dagNode',
      position: { x: 0, y: 0 },
      data: formData,
    } as any;

    const res = executeStepSandboxTest(activeNode, workflowInput, upstreamOutputs);
    setTestStepResult(res);
  };

  if (!nodeId || !formData) {
    return null;
  }

  const matchedWorkerDescriptor: TaskWorkerDescriptor | undefined = workerCatalog.find(
    (w) => w.taskName === formData.taskReferenceName
  );

  const handleBindRegisteredWorker = (workerTaskName: string) => {
    const desc = workerCatalog.find((w) => w.taskName === workerTaskName);
    if (!desc) return;
    const sampleInputs: Record<string, unknown> = { ...(formData.inputParameters || {}) };
    const props = (desc.inputSchema as { properties?: Record<string, { type?: string }> } | undefined)?.properties || {};
    Object.keys(props).forEach((key) => {
      if (!(key in sampleInputs)) {
        sampleInputs[key] = `\${workflow.input.${key}}`;
      }
    });
    const patch: Partial<DagNodeData> = {
      taskReferenceName: desc.taskName,
      domain: desc.domain || 'default',
      description: desc.description || formData.description,
      timeoutSeconds: desc.timeoutSeconds || formData.timeoutSeconds || 30,
      inputParameters: sampleInputs,
    };
    setFormData({ ...formData, ...patch });
    onUpdateNodeData(nodeId, patch);
  };

  const handleFieldChange = (field: keyof DagNodeData, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdateNodeData(nodeId, { [field]: value });
  };

  const handleSpecializedChange = (
    field:
      | 'httpParams'
      | 'jdbcParams'
      | 'jsonJqParams'
      | 'inlineParams'
      | 'llmParams'
      | 'mcpParams'
      | 'humanParams'
      | 'terminateParams'
      | 'subWorkflowParams'
      | 'kafkaParams',
    subField: string,
    val: any
  ) => {
    const current = (formData[field] as any) || {};
    const updated = { ...current, [subField]: val };
    handleFieldChange(field, updated);
  };

  const handleAddParam = () => {
    if (!paramKey.trim()) return;
    const currentParams = formData.inputParameters || {};
    const updated = {
      ...currentParams,
      [paramKey.trim()]: paramValue.trim(),
    };
    handleFieldChange('inputParameters', updated);
    setParamKey('');
    setParamValue('');
  };

  const handleRemoveParam = (keyToRemove: string) => {
    const currentParams = { ...(formData.inputParameters || {}) };
    delete currentParams[keyToRemove];
    handleFieldChange('inputParameters', currentParams);
  };

  const renderSpecializedConfig = () => {
    switch (formData.taskType) {
      case 'HTTP': {
        const p = formData.httpParams || {};
        return (
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">HTTP Method</Label>
              <div className="flex gap-1.5">
                {(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const).map((m) => (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant={p.method === m ? 'default' : 'outline'}
                    className="h-7 text-[11px] px-2.5 font-mono"
                    onClick={() => handleSpecializedChange('httpParams', 'method', m)}
                  >
                    {m}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="httpUrl" className="text-xs font-semibold">
                Endpoint URL
              </Label>
              <Input
                id="httpUrl"
                value={p.url || ''}
                onChange={(e) => handleSpecializedChange('httpParams', 'url', e.target.value)}
                placeholder="https://api.example.com/v1/resource"
                className="font-mono text-xs h-8"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="httpTimeout" className="text-xs font-semibold">
                Timeout (seconds)
              </Label>
              <Input
                id="httpTimeout"
                type="number"
                value={p.timeoutSeconds ?? 15}
                onChange={(e) =>
                  handleSpecializedChange('httpParams', 'timeoutSeconds', parseInt(e.target.value) || 15)
                }
                className="text-xs h-8"
              />
            </div>
          </div>
        );
      }

      case 'JDBC': {
        const p = formData.jdbcParams || {};
        return (
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="jdbcDatasource" className="text-xs font-semibold">
                Datasource ID
              </Label>
              <Input
                id="jdbcDatasource"
                value={p.datasourceId || 'default'}
                onChange={(e) => handleSpecializedChange('jdbcParams', 'datasourceId', e.target.value)}
                placeholder="default"
                className="font-mono text-xs h-8"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="jdbcSql" className="text-xs font-semibold">
                SQL Statement
              </Label>
              <Textarea
                id="jdbcSql"
                value={p.sql || ''}
                onChange={(e) => handleSpecializedChange('jdbcParams', 'sql', e.target.value)}
                placeholder="SELECT * FROM orders WHERE id = ?"
                rows={4}
                className="font-mono text-xs"
              />
            </div>
          </div>
        );
      }

      case 'JSON_JQ_TRANSFORM': {
        const p = formData.jsonJqParams || {};
        return (
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="jqExpression" className="text-xs font-semibold">
                JQ Query Expression
              </Label>
              <Textarea
                id="jqExpression"
                value={p.queryExpression || ''}
                onChange={(e) => handleSpecializedChange('jsonJqParams', 'queryExpression', e.target.value)}
                placeholder="{ orderId: .id, total: .amount }"
                rows={4}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Transforms JSON payload in-memory without worker queue dispatch.
              </p>
            </div>
          </div>
        );
      }

      case 'INLINE': {
        const p = formData.inlineParams || {};
        return (
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Script Engine</Label>
              <div className="flex gap-1.5">
                {(['javascript', 'groovy', 'mvel'] as const).map((eng) => (
                  <Button
                    key={eng}
                    type="button"
                    size="sm"
                    variant={p.evaluatorType === eng ? 'default' : 'outline'}
                    className="h-7 text-[11px] px-2.5 font-mono capitalize"
                    onClick={() => handleSpecializedChange('inlineParams', 'evaluatorType', eng)}
                  >
                    {eng}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inlineExpr" className="text-xs font-semibold">
                Script Expression
              </Label>
              <Textarea
                id="inlineExpr"
                value={p.expression || ''}
                onChange={(e) => handleSpecializedChange('inlineParams', 'expression', e.target.value)}
                placeholder="function eval() { return { ok: true }; }"
                rows={5}
                className="font-mono text-xs"
              />
            </div>
          </div>
        );
      }

      case 'LLM_CHAT_COMPLETE': {
        const p = formData.llmParams || {};
        return (
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">LLM Provider</Label>
              <div className="flex gap-1.5">
                {(['openai', 'gemini', 'anthropic', 'local'] as const).map((prov) => (
                  <Button
                    key={prov}
                    type="button"
                    size="sm"
                    variant={p.provider === prov ? 'default' : 'outline'}
                    className="h-7 text-[11px] px-2.5 capitalize"
                    onClick={() => handleSpecializedChange('llmParams', 'provider', prov)}
                  >
                    {prov}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="llmModel" className="text-xs font-semibold">
                Model Name
              </Label>
              <Input
                id="llmModel"
                value={p.model || 'gpt-4o'}
                onChange={(e) => handleSpecializedChange('llmParams', 'model', e.target.value)}
                placeholder="gpt-4o, gemini-1.5-pro"
                className="font-mono text-xs h-8"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="llmTemp" className="text-xs font-semibold">
                  Temperature
                </Label>
                <span className="text-[10px] font-mono text-muted-foreground">{p.temperature ?? 0.7}</span>
              </div>
              <Input
                id="llmTemp"
                type="number"
                step="0.1"
                min="0.0"
                max="1.0"
                value={p.temperature ?? 0.7}
                onChange={(e) =>
                  handleSpecializedChange('llmParams', 'temperature', parseFloat(e.target.value) || 0.7)
                }
                className="text-xs h-8"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="llmPrompt" className="text-xs font-semibold">
                Prompt Template
              </Label>
              <Textarea
                id="llmPrompt"
                value={p.prompt || ''}
                onChange={(e) => handleSpecializedChange('llmParams', 'prompt', e.target.value)}
                placeholder="Analyze this payload: ${workflow.input.data}"
                rows={3}
                className="font-mono text-xs"
              />
            </div>
          </div>
        );
      }

      case 'CALL_MCP_TOOL': {
        const p = formData.mcpParams || {};
        return (
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="mcpServer" className="text-xs font-semibold">
                MCP Server Name
              </Label>
              <Input
                id="mcpServer"
                value={p.serverName || ''}
                onChange={(e) => handleSpecializedChange('mcpParams', 'serverName', e.target.value)}
                placeholder="e.g. filesystem"
                className="font-mono text-xs h-8"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mcpTool" className="text-xs font-semibold">
                Tool Name
              </Label>
              <Input
                id="mcpTool"
                value={p.toolName || ''}
                onChange={(e) => handleSpecializedChange('mcpParams', 'toolName', e.target.value)}
                placeholder="e.g. read_file"
                className="font-mono text-xs h-8"
              />
            </div>
          </div>
        );
      }

      case 'HUMAN': {
        const p = formData.humanParams || {};
        return (
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="humanRole" className="text-xs font-semibold">
                Assignee Role
              </Label>
              <Input
                id="humanRole"
                value={p.role || 'WORKFLOW_APPROVER'}
                onChange={(e) => handleSpecializedChange('humanParams', 'role', e.target.value)}
                placeholder="WORKFLOW_APPROVER"
                className="font-mono text-xs h-8"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="humanSla" className="text-xs font-semibold">
                SLA Timeout (Minutes)
              </Label>
              <Input
                id="humanSla"
                type="number"
                value={p.slaMinutes ?? 120}
                onChange={(e) =>
                  handleSpecializedChange('humanParams', 'slaMinutes', parseInt(e.target.value) || 120)
                }
                className="text-xs h-8"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="humanEscalationRole" className="text-xs font-semibold">
                Escalation Role / Target
              </Label>
              <Input
                id="humanEscalationRole"
                value={(p as any).escalationRole || ''}
                onChange={(e) => handleSpecializedChange('humanParams', 'escalationRole', e.target.value)}
                placeholder="SENIOR_REVIEWER"
                className="font-mono text-xs h-8"
              />
              <p className="text-[10px] text-muted-foreground">
                If escalated, task remains on hold at this node and reassigns to this role for review.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="humanInstructions" className="text-xs font-semibold">
                Review Instructions
              </Label>
              <Textarea
                id="humanInstructions"
                value={p.instructions || ''}
                onChange={(e) => handleSpecializedChange('humanParams', 'instructions', e.target.value)}
                placeholder="Verify customer KYC documentation before approving."
                rows={3}
                className="text-xs"
              />
            </div>

            <div className="p-2.5 rounded-lg border border-border/50 bg-muted/20 space-y-1 text-xs">
              <div className="font-semibold text-foreground text-[11px] mb-1">Execution Lifecycle</div>
              <div className="text-[10px] text-muted-foreground space-y-1">
                <div><span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">Approve</span>: Execution continues to the connected next node.</div>
                <div><span className="text-rose-600 dark:text-rose-400 font-semibold font-mono">Reject</span>: Execution terminates and stops at this human node.</div>
                <div><span className="text-amber-600 dark:text-amber-400 font-semibold font-mono">Escalate</span>: Execution stays on hold on this node, waiting for reviewer.</div>
              </div>
            </div>
          </div>
        );
      }

      case 'TERMINATE': {
        const p = formData.terminateParams || {};
        return (
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Termination Status</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={p.terminationStatus === 'COMPLETED' ? 'default' : 'outline'}
                  className="h-7 text-xs"
                  onClick={() => handleSpecializedChange('terminateParams', 'terminationStatus', 'COMPLETED')}
                >
                  COMPLETED
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={p.terminationStatus === 'FAILED' ? 'destructive' : 'outline'}
                  className="h-7 text-xs"
                  onClick={() => handleSpecializedChange('terminateParams', 'terminationStatus', 'FAILED')}
                >
                  FAILED
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="termReason" className="text-xs font-semibold">
                Termination Reason
              </Label>
              <Input
                id="termReason"
                value={p.terminationReason || ''}
                onChange={(e) => handleSpecializedChange('terminateParams', 'terminationReason', e.target.value)}
                placeholder="Order cancelled due to out-of-stock items"
                className="text-xs h-8"
              />
            </div>
          </div>
        );
      }

      case 'SUB_WORKFLOW': {
        const p = formData.subWorkflowParams || {};
        return (
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="subWfKey" className="text-xs font-semibold">
                Sub-Workflow Key
              </Label>
              <Input
                id="subWfKey"
                value={p.workflowKey || ''}
                onChange={(e) => handleSpecializedChange('subWorkflowParams', 'workflowKey', e.target.value)}
                placeholder="e.g. order-settlement-pipeline"
                className="font-mono text-xs h-8"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subWfVersion" className="text-xs font-semibold">
                Version
              </Label>
              <Input
                id="subWfVersion"
                type="number"
                value={p.version ?? 1}
                onChange={(e) =>
                  handleSpecializedChange('subWorkflowParams', 'version', parseInt(e.target.value) || 1)
                }
                className="text-xs h-8"
              />
            </div>
          </div>
        );
      }

      case 'KAFKA_PUBLISH': {
        const p = formData.kafkaParams || {};
        return (
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="kafkaTopic" className="text-xs font-semibold">
                Topic Name
              </Label>
              <Input
                id="kafkaTopic"
                value={p.topic || ''}
                onChange={(e) => handleSpecializedChange('kafkaParams', 'topic', e.target.value)}
                placeholder="order-events"
                className="font-mono text-xs h-8"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="kafkaKey" className="text-xs font-semibold">
                Partition Key
              </Label>
              <Input
                id="kafkaKey"
                value={p.key || ''}
                onChange={(e) => handleSpecializedChange('kafkaParams', 'key', e.target.value)}
                placeholder="${workflow.input.orderId}"
                className="font-mono text-xs h-8"
              />
            </div>
          </div>
        );
      }

      default:
        return (
          <p className="text-xs text-muted-foreground italic p-4 text-center border border-dashed rounded-xl">
            Node type <span className="font-mono font-semibold">{formData.taskType}</span> uses standard worker execution parameters.
          </p>
        );
    }
  };

  if (formData.isStartNode) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col backdrop-blur-2xl bg-white/95 dark:bg-slate-900/95 border-l border-white/20 dark:border-white/10 shadow-2xl z-50 overflow-hidden"
        >
          <SheetHeader className="p-6 pb-4 border-b border-border/40 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-base font-bold flex items-center gap-2">
                  <PlaySquare className="w-4 h-4 text-emerald-500" />
                  <span>Workflow Start</span>
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                    START · INPUT
                  </Badge>
                </SheetTitle>
              </div>
              <Badge variant="outline" className="text-[10px] text-muted-foreground font-mono">
                Entry Boundary
              </Badge>
            </div>
            <SheetDescription className="text-xs text-muted-foreground">
              Conventional entry boundary node. Defines the initial inputs and payload schema accepted by the entire workflow (${'workflow.input'}).
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Pure Conventional Start Node
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                This node contains no execution workers, retry policies, or task logic. It acts purely as the formal input definition for the workflow. All downstream nodes can reference these parameters using <code className="font-mono font-bold bg-emerald-500/20 px-1 py-0.5 rounded text-[10px]">${'{workflow.input.<field>}'}</code>.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="startTaskRef" className="text-xs font-semibold">
                Task Reference Name
              </Label>
              <Input
                id="startTaskRef"
                value={formData.taskReferenceName}
                onChange={(e) => handleFieldChange('taskReferenceName', e.target.value)}
                className="font-mono text-xs h-8 bg-muted/40"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="startLabel" className="text-xs font-semibold">
                Display Label
              </Label>
              <Input
                id="startLabel"
                value={formData.label || 'Workflow Start'}
                onChange={(e) => handleFieldChange('label', e.target.value)}
                className="text-xs h-8"
              />
            </div>

            {/* Draft 7 Input Schema Contract (Mandatory) */}
            <div className="space-y-3 pt-3 border-t border-border/40">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-emerald-500" />
                    Trigger Input Schema (Draft 7)
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Trigger payloads are strictly validated against this contract before initialization.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                    Draft 7
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {Object.keys(((formData.declaredOutputSchema as Record<string, unknown>)?.properties as Record<string, unknown>) || {}).length} properties
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  Fast schema generation:
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 font-semibold"
                  onClick={() => {
                    const sample = formData.inputParameters || {};
                    const inferred = inferDraft7Schema(sample);
                    handleFieldChange('declaredOutputSchema', inferred);
                  }}
                  data-testid="start-infer-schema-btn"
                >
                  <Sparkles className="w-3 h-3 text-emerald-500" />
                  Infer Schema from Sample
                </Button>
              </div>

              <div className="rounded-xl border border-border/50 overflow-hidden bg-background/60">
                <VisualJsonEditor
                  value={formData.declaredOutputSchema || DEFAULT_DRAFT7_SCHEMA}
                  onChange={(updated) => {
                    if (updated && typeof updated === 'object' && !Array.isArray(updated)) {
                      handleFieldChange('declaredOutputSchema', updated);
                    }
                  }}
                  defaultMode="tree"
                  height="180px"
                />
              </div>
            </div>

            {/* Structured Sample Input Parameters */}
            <div className="space-y-2 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Braces className="w-3.5 h-3.5 text-emerald-500" />
                  Sample / Default Payload ($&#123;workflow.input&#125;)
                </Label>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {Object.keys(formData.inputParameters || {}).length} variables
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Default payload used for dry-run simulation and isolated step tests.
              </p>

              <div className="rounded-xl border border-border/50 overflow-hidden bg-background/60">
                <VisualJsonEditor
                  value={formData.inputParameters || {}}
                  onChange={(updated) => {
                    if (updated && typeof updated === 'object' && !Array.isArray(updated)) {
                      handleFieldChange('inputParameters', updated);
                    }
                  }}
                  defaultMode="tree"
                  height="160px"
                />
              </div>
            </div>

            {/* Quick reference variable tags */}
            {Object.keys(formData.inputParameters || {}).length > 0 && (
              <div className="space-y-2 pt-2">
                <Label className="text-[11px] font-semibold text-muted-foreground">
                  Available Downstream Expressions:
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(formData.inputParameters || {}).map((paramName) => (
                    <button
                      key={paramName}
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`\${workflow.input.${paramName}}`);
                      }}
                      title="Click to copy expression"
                      className="px-2 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] border border-emerald-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>${`{workflow.input.${paramName}}`}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (formData.isEndNode) {
    const precedingRefs = availableTaskRefs.filter((r) => r !== formData.taskReferenceName);
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col backdrop-blur-2xl bg-white/95 dark:bg-slate-900/95 border-l border-white/20 dark:border-white/10 shadow-2xl z-50 overflow-hidden"
        >
          <SheetHeader className="p-6 pb-4 border-b border-border/40 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-base font-bold flex items-center gap-2">
                  <StopCircle className="w-4 h-4 text-purple-500" />
                  <span>Workflow End</span>
                  <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[10px]">
                    END · OUTPUT
                  </Badge>
                </SheetTitle>
              </div>
              <Badge variant="outline" className="text-[10px] text-muted-foreground font-mono">
                Terminal Boundary
              </Badge>
            </div>
            <SheetDescription className="text-xs text-muted-foreground">
              Conventional terminal boundary node. Aggregates upstream task outputs to construct the final output payload returned by the workflow execution (${'workflow.output'}).
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-800 dark:text-purple-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                Pure Conventional End Node
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                This node contains no execution workers, retry policies, or task logic. It acts purely as the final output aggregator for the workflow execution. Map preceding task outputs to define the response returned to callers.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="endTaskRef" className="text-xs font-semibold">
                Task Reference Name
              </Label>
              <Input
                id="endTaskRef"
                value={formData.taskReferenceName}
                onChange={(e) => handleFieldChange('taskReferenceName', e.target.value)}
                className="font-mono text-xs h-8 bg-muted/40"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="endLabel" className="text-xs font-semibold">
                Display Label
              </Label>
              <Input
                id="endLabel"
                value={formData.label || 'Workflow End'}
                onChange={(e) => handleFieldChange('label', e.target.value)}
                className="text-xs h-8"
              />
            </div>

            {/* Termination Status & Reason */}
            <div className="space-y-3 pt-2 border-t border-border/40">
              <Label className="text-xs font-semibold">Termination Status</Label>
              <div className="flex gap-2">
                {(['COMPLETED', 'FAILED'] as const).map((status) => {
                  const currentStatus = formData.terminateParams?.terminationStatus || 'COMPLETED';
                  const isSelected = currentStatus === status;
                  return (
                    <Button
                      key={status}
                      type="button"
                      size="sm"
                      variant={isSelected ? 'default' : 'outline'}
                      className={cn(
                        'h-8 text-xs font-semibold flex-1',
                        isSelected && status === 'COMPLETED' && 'bg-emerald-600 hover:bg-emerald-700 text-white',
                        isSelected && status === 'FAILED' && 'bg-rose-600 hover:bg-rose-700 text-white'
                      )}
                      onClick={() => handleSpecializedChange('terminateParams', 'terminationStatus', status)}
                    >
                      {status}
                    </Button>
                  );
                })}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="terminationReason" className="text-xs font-semibold">
                  Completion Reason / Message
                </Label>
                <Input
                  id="terminationReason"
                  value={formData.terminateParams?.terminationReason || ''}
                  onChange={(e) => handleSpecializedChange('terminateParams', 'terminationReason', e.target.value)}
                  placeholder="e.g. Workflow execution successfully completed"
                  className="text-xs h-8"
                />
              </div>
            </div>

            {/* Draft 7 Exit Output Schema Contract (Mandatory) */}
            {(() => {
              const currentOutputSchema =
                (formData.declaredOutputSchema as Record<string, unknown>) || DEFAULT_DRAFT7_SCHEMA;
              const reqOutputs = Array.isArray(currentOutputSchema.required)
                ? (currentOutputSchema.required as string[])
                : [];
              const currentMappings = formData.inputParameters || {};
              const unsatisfied = reqOutputs.filter(
                (k) => currentMappings[k] === undefined || currentMappings[k] === ''
              );
              const propCount = Object.keys(
                (currentOutputSchema.properties as Record<string, unknown>) || {}
              ).length;

              return (
                <div className="space-y-3 pt-3 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-purple-500" />
                        Exit Output Schema (Draft 7)
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Execution completes only if terminal payload satisfies this contract.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] font-mono border-purple-500/30 text-purple-600 dark:text-purple-400">
                        Draft 7
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        {propCount} properties
                      </Badge>
                    </div>
                  </div>

                  {/* Satisfaction Alert */}
                  {unsatisfied.length > 0 ? (
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                        <span className="truncate">
                          Unsatisfied required outputs: <span className="font-mono font-semibold">{unsatisfied.join(', ')}</span>
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px] shrink-0 border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20"
                        onClick={() => {
                          const updated = { ...currentMappings };
                          unsatisfied.forEach((k) => {
                            const guessRef = precedingRefs[precedingRefs.length - 1] || 'task';
                            updated[k] = `\${${guessRef}.output.${k}}`;
                          });
                          handleFieldChange('inputParameters', updated);
                        }}
                      >
                        Auto-Map
                      </Button>
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>All required output fields are satisfied by terminal mappings.</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      Fast schema generation:
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-xs gap-1.5 text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/10 font-semibold"
                      onClick={() => {
                        const currentParams = formData.inputParameters || {};
                        const inferred = inferDraft7Schema(currentParams);
                        handleFieldChange('declaredOutputSchema', inferred);
                      }}
                      data-testid="end-infer-schema-btn"
                    >
                      <Sparkles className="w-3 h-3 text-purple-500" />
                      Infer Schema from Mappings
                    </Button>
                  </div>

                  <div className="rounded-xl border border-border/50 overflow-hidden bg-background/60">
                    <VisualJsonEditor
                      value={formData.declaredOutputSchema || DEFAULT_DRAFT7_SCHEMA}
                      onChange={(updated) => {
                        if (updated && typeof updated === 'object' && !Array.isArray(updated)) {
                          handleFieldChange('declaredOutputSchema', updated);
                        }
                      }}
                      defaultMode="tree"
                      height="180px"
                    />
                  </div>
                </div>
              );
            })()}

            {/* Workflow Output Payload Mapping via VisualJsonEditor */}
            <div className="space-y-2 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Braces className="w-3.5 h-3.5 text-purple-500" />
                  Workflow Output Payload Mapping
                </Label>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {Object.keys(formData.inputParameters || {}).length} output fields
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Map preceding step outputs (e.g. <code className="text-foreground font-mono font-bold">$&#123;task.output.field&#125;</code>) to format the final execution result.
              </p>

              <div className="rounded-xl border border-border/50 overflow-hidden bg-background/60">
                <VisualJsonEditor
                  value={formData.inputParameters || {}}
                  onChange={(updated) => {
                    if (updated && typeof updated === 'object' && !Array.isArray(updated)) {
                      handleFieldChange('inputParameters', updated);
                    }
                  }}
                  defaultMode="tree"
                  height="160px"
                />
              </div>
            </div>

            {/* Quick helper of preceding task outputs */}
            {precedingRefs.length > 0 && (
              <div className="space-y-2 pt-2">
                <Label className="text-[11px] font-semibold text-muted-foreground">
                  Available Preceding Task Outputs:
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {precedingRefs.map((ref) => (
                    <button
                      key={ref}
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`\${${ref}.output}`);
                      }}
                      title="Click to copy output expression"
                      className="px-2 py-0.5 rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-mono text-[10px] border border-purple-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>${`{${ref}.output.*}`}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col backdrop-blur-2xl bg-white/95 dark:bg-slate-900/95 border-l border-white/20 dark:border-white/10 shadow-2xl z-50 overflow-hidden"
      >
        <SheetHeader className="p-6 pb-4 border-b border-border/40 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-base font-bold flex items-center gap-2">
                <span>Node Inspector</span>
                <Badge variant="outline" className="text-xs font-mono font-normal">
                  {formData.taskType}
                </Badge>
              </SheetTitle>
              {formData.isPermanent && (
                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]">
                  Protected Boundary Node
                </Badge>
              )}
            </div>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Configure step execution parameters, retry reliability, and DAG expressions.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue={defaultTab || 'general'} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-2 shrink-0">
            <TabsList className="grid grid-cols-5 w-full h-9">
              <TabsTrigger value="general" className="text-[11px]">General</TabsTrigger>
              <TabsTrigger value="config" className="text-[11px]">Config</TabsTrigger>
              <TabsTrigger value="params" className="text-[11px] font-semibold text-primary flex items-center gap-1">
                <Braces className="w-3 h-3 text-primary" /> Data (I/O)
              </TabsTrigger>
              <TabsTrigger value="policies" className="text-[11px]">Policies</TabsTrigger>
              <TabsTrigger value="routing" className="text-[11px]">Routing</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* 1. General Tab */}
            <TabsContent value="general" className="mt-0 space-y-4">
              {formData.taskType === 'SIMPLE' && workerCatalog.length > 0 && (
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                  <Label htmlFor="workerCatalogSelect" className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                    <Cpu className="w-3.5 h-3.5" />
                    Bind to Registered SIMPLE Worker
                  </Label>
                  <select
                    id="workerCatalogSelect"
                    aria-label="Bind to Registered SIMPLE Worker"
                    value={matchedWorkerDescriptor?.taskName || ''}
                    onChange={(e) => {
                      if (e.target.value) handleBindRegisteredWorker(e.target.value);
                    }}
                    className="w-full h-8 rounded-lg border border-border bg-background px-2 text-xs font-mono"
                    data-testid="bind-registered-worker-select"
                  >
                    <option value="">-- Custom / Unregistered Task --</option>
                    {workerCatalog.map((w) => (
                      <option key={w.taskName} value={w.taskName}>
                        {w.taskName} ({w.domain})
                      </option>
                    ))}
                  </select>
                  {matchedWorkerDescriptor && (
                    <div className="text-[10px] text-muted-foreground space-y-0.5">
                      <div>{matchedWorkerDescriptor.description}</div>
                      <div className="font-mono text-primary">
                        Domain: {matchedWorkerDescriptor.domain} · Max Concurrency: {matchedWorkerDescriptor.maxConcurrency}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="taskRef" className="text-xs font-semibold">
                  Task Reference Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="taskRef"
                  value={formData.taskReferenceName}
                  onChange={(e) => handleFieldChange('taskReferenceName', e.target.value)}
                  className="font-mono text-xs h-8"
                  placeholder="e.g. checkInventory"
                />
                <p className="text-[10px] text-muted-foreground">
                  Unique node identifier in DAG expressions (${`{${formData.taskReferenceName}.output}`}).
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="label" className="text-xs font-semibold">
                  Display Label
                </Label>
                <Input
                  id="label"
                  value={formData.label || ''}
                  onChange={(e) => handleFieldChange('label', e.target.value)}
                  className="text-xs h-8"
                  placeholder="e.g. Check Inventory Service"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="domain" className="text-xs font-semibold">
                  Worker Domain Routing
                </Label>
                <Input
                  id="domain"
                  value={formData.domain || 'default'}
                  onChange={(e) => handleFieldChange('domain', e.target.value)}
                  className="font-mono text-xs h-8"
                  placeholder="e.g. payment, shipping, default"
                />
                <p className="text-[10px] text-muted-foreground">
                  Target worker lease domain pool.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs font-semibold">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  className="text-xs"
                  placeholder="Operational documentation for this step"
                  rows={2}
                />
              </div>
            </TabsContent>

            {/* 2. Specialized Config Tab */}
            <TabsContent value="config" className="mt-0 space-y-4">
              {renderSpecializedConfig()}
            </TabsContent>

            {/* 3. Data & Schema (I/O) Tab */}
            <TabsContent value="params" className="mt-0 space-y-3">
              {/* Sub-tab Pill Switcher */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/30 border border-border/40">
                <button
                  type="button"
                  onClick={() => setDataSubTab('inputs')}
                  className={cn(
                    'flex-1 py-1 text-xs font-semibold rounded-md transition-all text-center',
                    dataSubTab === 'inputs' ? 'bg-background shadow-xs text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
                  )}
                  data-testid="dag-inspector-tab-inputs"
                >
                  Inputs ({Object.keys(formData.inputParameters || {}).length})
                </button>
                <button
                  type="button"
                  onClick={() => setDataSubTab('outputs')}
                  className={cn(
                    'flex-1 py-1 text-xs font-semibold rounded-md transition-all text-center',
                    dataSubTab === 'outputs' ? 'bg-background shadow-xs text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
                  )}
                  data-testid="dag-inspector-tab-outputs"
                >
                  Outputs & Contract
                </button>
                <button
                  type="button"
                  onClick={() => setDataSubTab('payloads')}
                  className={cn(
                    'flex-1 py-1 text-xs font-semibold rounded-md transition-all text-center',
                    dataSubTab === 'payloads' ? 'bg-background shadow-xs text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
                  )}
                  data-testid="dag-inspector-tab-payloads"
                >
                  Live Payloads
                </button>
              </div>

              {/* Sub-tab 1: Inputs & Bindings */}
              {dataSubTab === 'inputs' && (
                <div className="space-y-3">
                  {/* Upstream Variable Autocomplete Pills */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Braces className="w-3 h-3 text-primary" />
                      Upstream Variable Reference Pills (Click to insert)
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setParamValue('${workflow.input.orderId}')}
                        className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 hover:bg-sky-500/20"
                      >
                        ${'{workflow.input.*}'}
                      </button>
                      {availableTaskRefs
                        .filter((r) => r !== formData.taskReferenceName)
                        .map((ref) => (
                          <button
                            key={ref}
                            type="button"
                            onClick={() => setParamValue(`\${${ref}.output.result}`)}
                            className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20"
                          >
                            ${`{${ref}.output.*}`}
                          </button>
                        ))}
                    </div>
                  </div>

                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="paramKey" className="text-[11px] font-medium">Key</Label>
                      <Input
                        id="paramKey"
                        value={paramKey}
                        onChange={(e) => setParamKey(e.target.value)}
                        placeholder="e.g. orderId"
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                    <div className="flex-[2] space-y-1">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="paramVal" className="text-[11px] font-medium">Value Expression</Label>
                        {nodes.length > 0 && (
                          <VariableBindingPopover
                            currentNodeId={nodeId}
                            nodes={nodes}
                            edges={edges}
                            currentValue={paramValue}
                            onSelectVariable={(expr) => setParamValue(expr)}
                            workerCatalog={workerCatalog}
                          />
                        )}
                      </div>
                      <Input
                        id="paramVal"
                        value={paramValue}
                        onChange={(e) => setParamValue(e.target.value)}
                        placeholder="${workflow.input.orderId}"
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 px-2.5 text-xs gap-1"
                      onClick={handleAddParam}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </Button>
                  </div>

                  {/* Worker Schema Requirement Checklist */}
                  {(() => {
                    const inputSchemaObj = matchedWorkerDescriptor?.inputSchema as
                      | { required?: string[]; properties?: Record<string, { type?: string; description?: string }> }
                      | undefined;
                    const reqInputs = Array.isArray(inputSchemaObj?.required) ? inputSchemaObj.required : [];
                    if (reqInputs.length === 0) return null;

                    const currentInputs = formData.inputParameters || {};
                    const missing = reqInputs.filter(
                      (k) => currentInputs[k] === undefined || currentInputs[k] === ''
                    );

                    return (
                      <div className="p-2.5 rounded-lg border border-border/50 bg-muted/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                            <ShieldAlert className="w-3.5 h-3.5 text-primary" />
                            Worker Contract Requirements
                          </Label>
                          {missing.length === 0 ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[9px]">
                              All Required Bound
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[9px]">
                              {missing.length} Unbound
                            </Badge>
                          )}
                        </div>

                        {missing.length > 0 && (
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/30 text-xs">
                            <span className="text-[11px] text-muted-foreground truncate">
                              Missing: <span className="font-mono text-amber-600 dark:text-amber-400">{missing.join(', ')}</span>
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px] shrink-0 border-primary/30 text-primary hover:bg-primary/10"
                              onClick={() => {
                                const updated = { ...currentInputs };
                                missing.forEach((k) => {
                                  updated[k] = `\${workflow.input.${k}}`;
                                });
                                handleFieldChange('inputParameters', updated);
                              }}
                            >
                              Auto-Bind Missing
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="space-y-1.5 pt-2 border-t border-border/40">
                    <Label className="text-xs font-semibold">Active Input Parameters</Label>
                    {Object.entries(formData.inputParameters || {}).length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No input parameters bound.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {Object.entries(formData.inputParameters || {}).map(([k, v]) => {
                          const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
                          const validation = validateBindingExpression(valStr, availableTaskRefs);

                          return (
                            <div
                              key={k}
                              className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/40 gap-2"
                            >
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-xs font-mono font-semibold text-foreground truncate">
                                  {k}
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground truncate">
                                  {valStr}
                                </span>
                                {!validation.valid && (
                                  <span className="text-[10px] text-rose-500 font-sans flex items-center gap-1 mt-0.5">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    {validation.error}
                                  </span>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveParam(k)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-border/40">
                    <Label className="text-xs font-semibold">
                      Structured Input Parameters (Visual JSON Editor)
                    </Label>
                    <VisualJsonEditor
                      value={formData.inputParameters || {}}
                      onChange={(nextVal) => {
                        if (nextVal && typeof nextVal === 'object' && !Array.isArray(nextVal)) {
                          handleFieldChange('inputParameters', nextVal);
                        }
                      }}
                      jsonSchema={matchedWorkerDescriptor?.inputSchema}
                      defaultMode="tree"
                      height="200px"
                    />
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Outputs & Schema */}
              {dataSubTab === 'outputs' && (
                <div className="space-y-3">
                  <div className="p-2.5 rounded-lg border border-border/50 bg-muted/20 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold flex items-center gap-1 text-primary">
                        <FileCode className="w-3.5 h-3.5" />
                        Resolved Output Contract Schema
                      </Label>
                      <Badge variant="outline" className="text-[9px] font-mono uppercase">
                        {formData.declaredOutputSchema ? 'Custom Override' : matchedWorkerDescriptor?.outputSchema ? 'Worker Fleet' : 'Built-in Contract'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Fields exported by this step. Downstream tasks reference these via <code className="text-primary font-mono">${`{${formData.taskReferenceName}.output.<field>}`}</code>.
                    </p>

                    <div className="p-2 rounded bg-background/60 border border-border/40 font-mono text-[10px] max-h-36 overflow-y-auto">
                      <pre className="text-foreground/90 whitespace-pre-wrap">
                        {JSON.stringify(
                          taskContractRegistry.resolveOutputSchema(formData, matchedWorkerDescriptor),
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">
                        Mock Output Payload (Visual JSON Editor)
                      </Label>
                      <span className="text-[10px] text-muted-foreground">
                        Used for autocomplete & zero-run testing
                      </span>
                    </div>
                    <VisualJsonEditor
                      value={
                        formData.mockOutputPayload ||
                        taskContractRegistry.getContract(formData.taskType, matchedWorkerDescriptor).defaultMockOutput
                      }
                      onChange={(nextVal) => {
                        if (nextVal && typeof nextVal === 'object' && !Array.isArray(nextVal)) {
                          handleFieldChange('mockOutputPayload', nextVal);
                        }
                      }}
                      defaultMode="tree"
                      height="200px"
                    />
                  </div>
                </div>
              )}

              {/* Sub-tab 3: Live Payloads View */}
              {dataSubTab === 'payloads' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1">
                      <span className="font-semibold text-muted-foreground flex items-center gap-1 text-[11px]">
                        <ArrowRightLeft className="w-3 h-3 text-sky-500" /> Input Payload
                      </span>
                      <div className="p-2 rounded-lg bg-background/50 border border-border/40 font-mono text-[10px] max-h-56 overflow-y-auto">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(formData.inputParameters || {}, null, 2)}
                        </pre>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="font-semibold text-muted-foreground flex items-center gap-1 text-[11px]">
                        <Check className="w-3 h-3 text-emerald-500" /> Output Payload
                      </span>
                      <div className="p-2 rounded-lg bg-background/50 border border-border/40 font-mono text-[10px] max-h-56 overflow-y-auto">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(
                            formData.outputParameters ||
                              formData.mockOutputPayload ||
                              taskContractRegistry.getContract(formData.taskType, matchedWorkerDescriptor).defaultMockOutput,
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold flex items-center gap-1 text-primary">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Zero-Run Isolated Sandbox Runner
                      </Label>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleRunStepTest}
                        className="h-7 px-2.5 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                        data-testid="property-inspector-test-step-btn"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        Run Step Test
                      </Button>
                    </div>

                    {testStepResult && (
                      <div
                        data-testid="property-inspector-step-test-result"
                        className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <Badge className="bg-emerald-600 text-white text-[9px] font-mono">
                            {testStepResult.status} ({testStepResult.durationMs}ms)
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Ref: {testStepResult.taskReferenceName}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                            Evaluated Inputs:
                          </span>
                          <pre className="mt-0.5 p-1.5 rounded bg-background/60 font-mono text-[9px] max-h-24 overflow-y-auto">
                            {JSON.stringify(testStepResult.evaluatedInputs, null, 2)}
                          </pre>
                        </div>

                        <div>
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                            Simulated Output Payload:
                          </span>
                          <pre className="mt-0.5 p-1.5 rounded bg-background/60 font-mono text-[9px] max-h-24 overflow-y-auto">
                            {JSON.stringify(testStepResult.outputPayload, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* 4. Policies Tab */}
            <TabsContent value="policies" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="timeoutSec" className="text-xs font-semibold">
                    Timeout (seconds)
                  </Label>
                  <Input
                    id="timeoutSec"
                    type="number"
                    value={formData.timeoutSeconds ?? 30}
                    onChange={(e) => handleFieldChange('timeoutSeconds', parseInt(e.target.value) || 30)}
                    className="text-xs h-8"
                    min={1}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="retryCount" className="text-xs font-semibold">
                    Max Retries
                  </Label>
                  <Input
                    id="retryCount"
                    type="number"
                    value={formData.retryCount ?? 3}
                    onChange={(e) => handleFieldChange('retryCount', parseInt(e.target.value) || 0)}
                    className="text-xs h-8"
                    min={0}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="retryDelay" className="text-xs font-semibold">
                    Retry Delay (seconds)
                  </Label>
                  <Input
                    id="retryDelay"
                    type="number"
                    value={formData.retryDelaySeconds ?? 2}
                    onChange={(e) => handleFieldChange('retryDelaySeconds', parseInt(e.target.value) || 1)}
                    className="text-xs h-8"
                    min={1}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="backoffRate" className="text-xs font-semibold">
                    Backoff Rate
                  </Label>
                  <Input
                    id="backoffRate"
                    type="number"
                    step="0.5"
                    value={formData.backoffRate ?? 2.0}
                    onChange={(e) => handleFieldChange('backoffRate', parseFloat(e.target.value) || 1.0)}
                    className="text-xs h-8"
                    min={1.0}
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-border/40">
                <Label htmlFor="compensateRef" className="text-xs font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                  Saga Compensation Handler
                </Label>
                <Input
                  id="compensateRef"
                  value={formData.compensateHandlerRef || ''}
                  onChange={(e) => handleFieldChange('compensateHandlerRef', e.target.value)}
                  className="font-mono text-xs h-8"
                  placeholder="e.g. cancelPackingJob"
                />
                <p className="text-[10px] text-muted-foreground">
                  Task executed in reverse topological order if the workflow fails downstream.
                </p>
              </div>
            </TabsContent>

            {/* 5. Routing Tab */}
            <TabsContent value="routing" className="mt-0 space-y-4">
              {formData.taskType === 'SWITCH' ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="switchCond" className="text-xs font-semibold">
                      Condition Expression
                    </Label>
                    <Input
                      id="switchCond"
                      value={formData.condition || ''}
                      onChange={(e) => handleFieldChange('condition', e.target.value)}
                      className="font-mono text-xs h-8"
                      placeholder="${workflow.input.tier}"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Evaluated value determines which target branch route to execute.
                    </p>
                  </div>
                </div>
              ) : formData.taskType === 'DO_WHILE' ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="loopCond" className="text-xs font-semibold">
                      Loop Condition Expression
                    </Label>
                    <Input
                      id="loopCond"
                      value={formData.loopCondition || formData.condition || ''}
                      onChange={(e) => {
                        handleFieldChange('loopCondition', e.target.value);
                        handleFieldChange('condition', e.target.value);
                      }}
                      className="font-mono text-xs h-8"
                      placeholder="${taskRef.output.status} == 'PENDING'"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Evaluated after each iteration. Graph continues looping while true.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic p-4 text-center border border-dashed rounded-xl">
                  Node type <span className="font-mono font-semibold">{formData.taskType}</span> uses standard sequential DAG routing.
                </p>
              )}

              {/* Universal Multi-Branch Management Section */}
              {multiBranchRegistry.supports(formData.taskType) && (() => {
                const branchStrategy = multiBranchRegistry.get(formData.taskType);
                if (!branchStrategy) return null;
                const activeBranches = branchStrategy.getBranches(formData);

                return (
                  <div className="space-y-3 pt-3 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <GitFork className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-bold text-foreground">
                          Active Branches ({activeBranches.length})
                        </span>
                      </div>
                      {onAddBranch && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onAddBranch(nodeId)}
                          className="h-7 px-2 text-[10px] font-semibold flex items-center gap-1 border-primary/30 hover:border-primary/60 text-primary bg-primary/5 hover:bg-primary/10"
                          data-testid="property-inspector-add-branch-btn"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{branchStrategy.addActionLabel}</span>
                        </Button>
                      )}
                    </div>

                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-0.5">
                      {activeBranches.map((branch) => (
                        <div
                          key={branch.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md text-xs shadow-sm"
                          data-testid={`branch-item-${branch.id}`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[9px] px-1.5 py-0 shrink-0 font-mono font-semibold',
                                branch.isDefault
                                  ? 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30'
                                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                              )}
                            >
                              {branch.id}
                            </Badge>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-xs font-semibold text-foreground truncate">
                                {branch.label}
                              </span>
                              {branch.targetTaskRef && (
                                <span className="text-[10px] font-mono text-muted-foreground truncate">
                                  Target: {branch.targetTaskRef}
                                </span>
                              )}
                            </div>
                          </div>

                          {branch.isRemovable && onRemoveBranch && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={activeBranches.filter((b) => b.isRemovable).length <= 1}
                              onClick={() => onRemoveBranch(nodeId, branch.id)}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 shrink-0"
                              title={
                                activeBranches.filter((b) => b.isRemovable).length <= 1
                                  ? 'Minimum branches reached'
                                  : `Remove branch ${branch.id}`
                              }
                              data-testid={`branch-delete-btn-${branch.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

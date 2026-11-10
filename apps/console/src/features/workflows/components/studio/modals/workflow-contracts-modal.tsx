import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Braces,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Copy,
  Check,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import type { WorkflowIR } from '../utils/workflow-ir-converter';
import { DEFAULT_DRAFT7_SCHEMA } from '../utils/workflow-ir-converter';
import { toast } from 'sonner';

export interface WorkflowContractsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowIR: WorkflowIR;
  onOpenStartNode?: () => void;
  onOpenEndNode?: () => void;
}

export const WorkflowContractsModal: React.FC<WorkflowContractsModalProps> = ({
  open,
  onOpenChange,
  workflowIR,
  onOpenStartNode,
  onOpenEndNode,
}) => {
  const [copiedSection, setCopiedSection] = React.useState<'input' | 'output' | null>(null);

  const inputSchema = (workflowIR.inputSchema || DEFAULT_DRAFT7_SCHEMA) as Record<string, unknown>;
  const outputSchema = (workflowIR.outputSchema || DEFAULT_DRAFT7_SCHEMA) as Record<string, unknown>;

  const inputProps = (inputSchema.properties as Record<string, unknown>) || {};
  const inputReq = Array.isArray(inputSchema.required) ? (inputSchema.required as string[]) : [];

  const outputProps = (outputSchema.properties as Record<string, unknown>) || {};
  const outputReq = Array.isArray(outputSchema.required) ? (outputSchema.required as string[]) : [];

  const endTask = workflowIR.tasks.find((t) => t.taskType === 'END_WORKFLOW');
  const endMappings = endTask?.inputParameters || {};

  const unsatisfiedExitOutputs = outputReq.filter(
    (reqKey) => endMappings[reqKey] === undefined || endMappings[reqKey] === ''
  );

  const handleCopySchema = (type: 'input' | 'output', schema: Record<string, unknown>) => {
    navigator.clipboard.writeText(JSON.stringify(schema, null, 2));
    setCopiedSection(type);
    toast.success(`${type === 'input' ? 'Input' : 'Output'} Schema copied to clipboard`);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-4xl max-h-[85vh] flex flex-col backdrop-blur-2xl bg-white/95 dark:bg-slate-900/95 border border-white/20 dark:border-white/10 shadow-2xl"
        data-testid="workflow-contracts-modal"
      >
        <DialogHeader className="shrink-0 pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
                <Braces className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <span>Workflow I/O Contract Specifications</span>
                  <Badge variant="outline" className="text-[10px] font-mono border-purple-500/30 text-purple-600 dark:text-purple-400">
                    Draft 7 Mandatory
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Governs trigger payload ingestion validation and terminal exit output verification for{' '}
                  <span className="font-mono font-semibold text-foreground">
                    {workflowIR.workflowKey || 'Workflow'} (v{workflowIR.version})
                  </span>.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {unsatisfiedExitOutputs.length === 0 ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[11px] gap-1 py-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Contracts Satisfied
                </Badge>
              ) : (
                <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[11px] gap-1 py-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {unsatisfiedExitOutputs.length} Unsatisfied Exit Fields
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Contracts Topology Description */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column: Input Contract */}
            <div className="flex flex-col rounded-xl border border-border/50 bg-background/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-foreground">Trigger Ingestion Contract</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {Object.keys(inputProps).length} Properties
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => handleCopySchema('input', inputSchema)}
                    title="Copy Input Schema"
                  >
                    {copiedSection === 'input' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground leading-relaxed">
                Evaluated at API trigger gate before execution starts. Payloads violating this Draft 7 schema or containing extraneous fields are rejected with HTTP 400.
              </div>

              {/* Required Keys Chip List */}
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Required Properties:
                </span>
                <div className="flex flex-wrap gap-1">
                  {inputReq.length === 0 ? (
                    <span className="text-[10px] text-muted-foreground italic">None required</span>
                  ) : (
                    inputReq.map((k) => (
                      <Badge key={k} variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                        {k}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {/* JSON Code Viewer */}
              <div className="flex-1 rounded-lg border border-border/40 bg-muted/30 p-2.5 font-mono text-[11px] overflow-y-auto max-h-56">
                <pre className="text-foreground/90 whitespace-pre-wrap">
                  {JSON.stringify(inputSchema, null, 2)}
                </pre>
              </div>

              {onOpenStartNode && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-7 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1.5"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenStartNode();
                  }}
                >
                  Configure in Start Node Inspector
                  <ArrowRight className="w-3 h-3" />
                </Button>
              )}
            </div>

            {/* Right Column: Output Contract */}
            <div className="flex flex-col rounded-xl border border-border/50 bg-background/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span className="text-xs font-bold text-foreground">Terminal Exit Contract</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {Object.keys(outputProps).length} Properties
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => handleCopySchema('output', outputSchema)}
                    title="Copy Output Schema"
                  >
                    {copiedSection === 'output' ? <Check className="w-3 h-3 text-purple-500" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground leading-relaxed">
                Evaluated by <code className="font-mono text-purple-600 dark:text-purple-400">EndWorkflowStrategy</code> before completing. Resolved output must strictly satisfy all declared types.
              </div>

              {/* Terminal Exit Satisfaction Checklist */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Terminal Output Mapping Satisfaction:
                </span>
                {outputReq.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic">No required exit properties declared.</p>
                ) : (
                  <div className="space-y-1">
                    {outputReq.map((reqKey) => {
                      const mapping = endMappings[reqKey];
                      const isSatisfied = mapping !== undefined && mapping !== '';
                      return (
                        <div
                          key={reqKey}
                          className="flex items-center justify-between p-1.5 rounded-md bg-muted/40 border border-border/30 text-[10px]"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isSatisfied ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                            )}
                            <span className="font-mono font-semibold truncate">{reqKey}</span>
                          </div>
                          <span className="font-mono text-muted-foreground truncate max-w-[180px]">
                            {isSatisfied ? String(mapping) : 'UNMAPPED'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* JSON Code Viewer */}
              <div className="flex-1 rounded-lg border border-border/40 bg-muted/30 p-2.5 font-mono text-[11px] overflow-y-auto max-h-56">
                <pre className="text-foreground/90 whitespace-pre-wrap">
                  {JSON.stringify(outputSchema, null, 2)}
                </pre>
              </div>

              {onOpenEndNode && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-7 text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/10 gap-1.5"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenEndNode();
                  }}
                >
                  Configure in End Node Inspector
                  <ArrowRight className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 pt-3 border-t border-border/40 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Strict Draft 7 validation is zero-overhead and deterministic across all nodes.
          </p>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-8 px-4 text-xs"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

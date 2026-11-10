import React, { useState, useMemo } from 'react';
import { type Node, type Edge } from '@xyflow/react';
import { type DagNodeData } from './dag-node';
import { taskContractRegistry, type SchemaTreeNode } from '../utils/contracts/task-contract-registry';
import { type TaskWorkerDescriptor } from '@/features/workers/api/worker-fleet-api';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Braces,
  Search,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Database,
  ArrowRight,
  Layers,
  Check,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface VariableBindingPopoverProps {
  currentNodeId: string;
  nodes: Node<DagNodeData>[];
  edges: Edge[];
  currentValue?: string;
  onSelectVariable: (expression: string) => void;
  trigger?: React.ReactNode;
  workerCatalog?: TaskWorkerDescriptor[];
  className?: string;
}

/**
 * Computes strictly valid topological ancestors for currentNodeId in G_control.
 */
export function getTopologicalAncestors(
  currentNodeId: string,
  nodes: Node<DagNodeData>[],
  edges: Edge[]
): Node<DagNodeData>[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const ancestors = new Set<string>();

  // Queue of predecessor node IDs to traverse upstream
  const queue: string[] = [];

  for (const edge of edges) {
    // Ignore loop-back edges
    const isLoopback = Boolean((edge.data as any)?.isLoopbackEdge || edge.targetHandle === 'loop-back');
    if (!isLoopback && edge.target === currentNodeId) {
      ancestors.add(edge.source);
      queue.push(edge.source);
    }
  }

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const edge of edges) {
      const isLoopback = Boolean((edge.data as any)?.isLoopbackEdge || edge.targetHandle === 'loop-back');
      if (!isLoopback && edge.target === cur && !ancestors.has(edge.source)) {
        ancestors.add(edge.source);
        queue.push(edge.source);
      }
    }
  }

  // Also include START_WORKFLOW if present
  const startNode = nodes.find((n) => n.data.taskType === 'START_WORKFLOW' || n.data.isStartNode);
  if (startNode && startNode.id !== currentNodeId) {
    ancestors.add(startNode.id);
  }

  return nodes.filter((n) => ancestors.has(n.id) && n.id !== currentNodeId);
}

/**
 * Evaluates a template expression against mock payloads of upstream nodes.
 */
export function evaluateExpressionPreview(
  expression: string,
  ancestors: Node<DagNodeData>[],
  workerCatalog?: TaskWorkerDescriptor[]
): { evaluatedValue: string; isValid: boolean; error?: string } {
  if (!expression || !expression.includes('${')) {
    return { evaluatedValue: expression, isValid: true };
  }

  const exprRegex = /\$\{([a-zA-Z0-9_-]+)\.(output|input)(\.[^}]+)?\}/g;
  let hasMatches = false;
  let evaluated = expression;
  let hasError = false;
  let errorMsg = '';

  const ancestorMap = new Map(ancestors.map((n) => [n.data.taskReferenceName, n]));

  // Also check if workflow is referenced
  const startNode = ancestors.find((n) => n.data.taskType === 'START_WORKFLOW' || n.data.isStartNode);
  const workflowInputs = startNode?.data.inputParameters || {};

  evaluated = evaluated.replace(exprRegex, (fullMatch, taskRef, type, propPath) => {
    hasMatches = true;
    if (taskRef === 'workflow' && type === 'input') {
      const key = propPath ? propPath.replace(/^\./, '') : '';
      if (!key) return JSON.stringify(workflowInputs);
      const val = workflowInputs[key];
      return val !== undefined ? String(val) : 'undefined';
    }

    const sourceNode = ancestorMap.get(taskRef);
    if (!sourceNode) {
      hasError = true;
      errorMsg = `Task "${taskRef}" is not an upstream dependency`;
      return fullMatch;
    }

    const matchedWorker = workerCatalog?.find((w) => w.taskName === sourceNode.data.taskReferenceName);
    const mock = sourceNode.data.mockOutputPayload || taskContractRegistry.getContract(sourceNode.data.taskType, matchedWorker).defaultMockOutput;

    if (!propPath) {
      return JSON.stringify(mock);
    }

    const keys = propPath.replace(/^\./, '').split('.');
    let cur: any = mock;
    for (const k of keys) {
      if (cur === undefined || cur === null) break;
      cur = cur[k];
    }

    return cur !== undefined ? (typeof cur === 'object' ? JSON.stringify(cur) : String(cur)) : 'undefined';
  });

  if (!hasMatches) {
    return { evaluatedValue: expression, isValid: true };
  }

  return {
    evaluatedValue: evaluated,
    isValid: !hasError,
    error: errorMsg || undefined,
  };
}

export const VariableBindingPopover: React.FC<VariableBindingPopoverProps> = ({
  currentNodeId,
  nodes,
  edges,
  currentValue = '',
  onSelectVariable,
  trigger,
  workerCatalog,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const ancestors = useMemo(
    () => getTopologicalAncestors(currentNodeId, nodes, edges),
    [currentNodeId, nodes, edges]
  );

  const startNode = useMemo(
    () => nodes.find((n) => n.data.taskType === 'START_WORKFLOW' || n.data.isStartNode),
    [nodes]
  );

  const workflowInputs = useMemo(
    () => startNode?.data.inputParameters || {},
    [startNode]
  );

  const preview = useMemo(
    () => evaluateExpressionPreview(currentValue, ancestors, workerCatalog),
    [currentValue, ancestors, workerCatalog]
  );

  const toggleNodeExpand = (nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const renderSchemaTree = (
    items: SchemaTreeNode[],
    taskRef: string,
    prefix: string = ''
  ): React.ReactNode => {
    return (
      <div className="pl-2 space-y-1 border-l border-border/40 ml-1.5 my-1">
        {items.map((item) => {
          const fullExpr = `\${${taskRef}.output.${item.path}}`;
          const isObjectWithChildren = item.children && item.children.length > 0;

          if (searchTerm && !item.path.toLowerCase().includes(searchTerm.toLowerCase())) {
            return null;
          }

          return (
            <div key={item.path} className="space-y-1">
              <div className="flex items-center justify-between group py-0.5 px-1.5 rounded hover:bg-muted/40 transition-colors">
                <button
                  type="button"
                  onClick={() => {
                    onSelectVariable(fullExpr);
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-1.5 text-left text-xs font-mono text-foreground hover:text-primary transition-colors truncate max-w-[210px]"
                  title={`Insert ${fullExpr}`}
                >
                  <span className="font-semibold text-foreground/90">{item.key}</span>
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1 py-0 h-3.5 font-normal text-muted-foreground uppercase"
                  >
                    {item.type.slice(0, 4)}
                  </Badge>
                </button>

                {item.example !== undefined && (
                  <span className="text-[10px] font-mono text-muted-foreground/70 truncate max-w-[90px] hidden group-hover:inline">
                    {typeof item.example === 'object' ? '{...}' : String(item.example)}
                  </span>
                )}
              </div>

              {isObjectWithChildren && renderSchemaTree(item.children!, taskRef, item.path)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn('h-7 px-2 text-xs font-mono gap-1 text-primary hover:text-primary/90', className)}
            title="Open Variable Binding Picker"
            data-testid="variable-binding-picker-trigger"
          >
            <Braces className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold">(fx)</span>
          </Button>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        className="w-84 p-3 backdrop-blur-2xl bg-popover/95 border border-border/70 shadow-2xl rounded-xl space-y-3 z-50 text-xs"
        data-testid="variable-binding-popover-content"
      >
        {/* Header & Search */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Variable Binding Picker
            </span>
            <Badge variant="outline" className="text-[10px] font-mono">
              {ancestors.length} upstream steps
            </Badge>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-2" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter fields (e.g. email, id, body)..."
              className="h-7 text-xs pl-7 font-mono"
            />
          </div>
        </div>

        {/* Scrollable Tree Sections */}
        <ScrollArea className="h-56 pr-2">
          <div className="space-y-3">
            {/* 1. Workflow Inputs Section */}
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[11px] font-bold text-sky-600 dark:text-sky-400 font-mono uppercase tracking-wider">
                <Database className="w-3 h-3" />
                <span>workflow.input</span>
              </div>

              {Object.keys(workflowInputs).length === 0 ? (
                <div className="text-[11px] text-muted-foreground italic pl-3">
                  No declared workflow inputs.
                </div>
              ) : (
                <div className="pl-2 space-y-1">
                  {Object.entries(workflowInputs).map(([k, v]) => {
                    const expr = `\${workflow.input.${k}}`;
                    if (searchTerm && !k.toLowerCase().includes(searchTerm.toLowerCase())) return null;

                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          onSelectVariable(expr);
                          setIsOpen(false);
                        }}
                        className="w-full flex items-center justify-between p-1 rounded hover:bg-muted/50 text-left font-mono text-xs transition-colors group"
                      >
                        <span className="text-foreground font-medium truncate">{k}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                          {typeof v === 'object' ? '{...}' : String(v)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Topologically Preceding Tasks Section */}
            <div className="space-y-1.5 pt-2 border-t border-border/40">
              <div className="flex items-center gap-1 text-[11px] font-bold text-primary font-mono uppercase tracking-wider">
                <Layers className="w-3 h-3" />
                <span>Upstream Task Outputs</span>
              </div>

              {ancestors.length === 0 ? (
                <div className="text-[11px] text-muted-foreground italic pl-3">
                  No upstream steps connected.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {ancestors.map((node) => {
                    const isExpanded = expandedNodes[node.id] ?? true;
                    const matchedWorker = workerCatalog?.find(
                      (w) => w.taskName === node.data.taskReferenceName
                    );
                    const tree = taskContractRegistry.getOutputSchemaTree(node.data, matchedWorker);

                    return (
                      <div
                        key={node.id}
                        className="rounded-lg border border-border/40 bg-background/50 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleNodeExpand(node.id)}
                          className="w-full flex items-center justify-between p-1.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                            )}
                            <span className="text-xs font-semibold text-foreground truncate">
                              {node.data.label || node.data.taskReferenceName}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              (${node.data.taskReferenceName}.output)
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="p-1.5 pt-0">
                            {tree.length === 0 ? (
                              <div className="text-[10px] text-muted-foreground italic pl-4 py-1">
                                No properties in output schema.
                              </div>
                            ) : (
                              renderSchemaTree(tree, node.data.taskReferenceName)
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. System Variables Section */}
            <div className="space-y-1 pt-2 border-t border-border/40">
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 font-mono uppercase tracking-wider">
                <Braces className="w-3 h-3" />
                <span>System Context</span>
              </div>
              <div className="pl-2 space-y-1">
                {[
                  { expr: '${workflow.workflowId}', label: 'workflowId', desc: 'Current execution UUID' },
                  { expr: '${workflow.startTime}', label: 'startTime', desc: 'Start timestamp in epoch ms' },
                  { expr: '${workflow.version}', label: 'version', desc: 'Active workflow schema version' },
                ].map((sys) => (
                  <button
                    key={sys.expr}
                    type="button"
                    onClick={() => {
                      onSelectVariable(sys.expr);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-1 rounded hover:bg-muted/50 text-left font-mono text-xs transition-colors"
                  >
                    <span className="text-foreground">{sys.label}</span>
                    <span className="text-[9px] text-muted-foreground/70">{sys.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Live Expression Preview Box */}
        {currentValue && (
          <div className="pt-2 border-t border-border/50 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-muted-foreground">Expression Evaluation:</span>
              {preview.isValid ? (
                <span className="text-emerald-500 flex items-center gap-0.5">
                  <Check className="w-3 h-3" /> Resolved
                </span>
              ) : (
                <span className="text-rose-500 flex items-center gap-0.5">
                  <AlertCircle className="w-3 h-3" /> {preview.error}
                </span>
              )}
            </div>
            <div className="p-1.5 rounded bg-muted/40 font-mono text-[10px] text-foreground truncate border border-border/40">
              {preview.evaluatedValue}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

import React, { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import {
  Play,
  Split,
  GitMerge,
  Clock,
  Repeat,
  CheckCircle2,
  AlertCircle,
  Loader2,
  GitFork,
  Globe,
  Database,
  Radio,
  Zap,
  Braces,
  Code,
  Variable,
  UserCheck,
  Bot,
  Cpu,
  StopCircle,
  Layers,
  PlaySquare,
  MinusCircle,
  Sparkles,
  Terminal,
  Server,
  Timer,
} from 'lucide-react';

export type DagNodeType =
  // Control Flow (9)
  | 'SIMPLE'
  | 'SWITCH'
  | 'FORK_JOIN'
  | 'DYNAMIC_FORK'
  | 'WAIT'
  | 'DO_WHILE'
  | 'JOIN'
  | 'EXCLUSIVE_JOIN'
  | 'TERMINATE'
  | 'SUB_WORKFLOW'
  | 'START_WORKFLOW'
  // Data & Transformation (3)
  | 'JSON_JQ_TRANSFORM'
  | 'INLINE'
  | 'SET_VARIABLE'
  // System Connectors & I/O (4)
  | 'HTTP'
  | 'JDBC'
  | 'KAFKA_PUBLISH'
  | 'EVENT'
  | 'NOOP'
  // Human & Governance (1)
  | 'HUMAN'
  // AI & Emerging Integrations (3)
  | 'LLM_CHAT_COMPLETE'
  | 'CALL_MCP_TOOL'
  | 'DYNAMIC';

export type ExecutionState =
  | 'PENDING'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'SKIPPED'
  | 'WAITING_FOR_APPROVAL'
  | 'PAUSED_AT_BREAKPOINT';

export interface HttpTaskParams {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutSeconds?: number;
  expectedStatuses?: number[];
}

export interface JdbcTaskParams {
  datasourceId?: string;
  sql?: string;
  parameters?: unknown[];
}

export interface JsonJqTaskParams {
  queryExpression?: string;
  inputPayload?: string;
}

export interface InlineTaskParams {
  evaluatorType?: 'groovy' | 'mvel' | 'javascript';
  expression?: string;
}

export interface LlmTaskParams {
  provider?: 'openai' | 'gemini' | 'anthropic' | 'local';
  model?: string;
  prompt?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface McpTaskParams {
  serverName?: string;
  toolName?: string;
  arguments?: Record<string, unknown>;
}

export interface HumanTaskParams {
  assignee?: string;
  role?: string;
  instructions?: string;
  slaMinutes?: number;
  escalationHandlerRef?: string;
}

export interface TerminateTaskParams {
  terminationStatus?: 'COMPLETED' | 'FAILED';
  terminationReason?: string;
}

export interface SubWorkflowTaskParams {
  workflowKey?: string;
  version?: number;
  inputParameters?: Record<string, unknown>;
}

export interface KafkaTaskParams {
  topic?: string;
  key?: string;
  message?: unknown;
}

export interface DagNodeData {
  taskReferenceName: string;
  taskType: DagNodeType;
  label?: string;
  description?: string;
  domain?: string;
  executionState?: ExecutionState;
  inputParameters?: Record<string, unknown>;
  outputParameters?: Record<string, unknown>;
  retryCount?: number;
  retryDelaySeconds?: number;
  backoffRate?: number;
  timeoutSeconds?: number;
  compensateHandlerRef?: string;
  condition?: string;
  decisionCases?: Record<string, string[]>;
  defaultCase?: string[];
  loopCondition?: string;
  validationError?: string;
  // Specialized Parameter Payloads
  httpParams?: HttpTaskParams;
  jdbcParams?: JdbcTaskParams;
  jsonJqParams?: JsonJqTaskParams;
  inlineParams?: InlineTaskParams;
  llmParams?: LlmTaskParams;
  mcpParams?: McpTaskParams;
  humanParams?: HumanTaskParams;
  terminateParams?: TerminateTaskParams;
  subWorkflowParams?: SubWorkflowTaskParams;
  kafkaParams?: KafkaTaskParams;
  // Execution Telemetry Data (Read-only mode)
  durationMs?: number;
  workerId?: string;
  leaseId?: string;
  attemptNumber?: number;
  startedAt?: number;
  endedAt?: number;
  error?: string;
  diffStatus?: 'added' | 'removed' | 'modified';
  hasBreakpoint?: boolean;
  onToggleBreakpoint?: (taskReferenceName: string) => void;
  onInspectTask?: (taskReferenceName: string) => void;
  // Topology Boundary & Permanence Invariants (Iteration 15)
  isPermanent?: boolean;
  isStartNode?: boolean;
  isEndNode?: boolean;
  [key: string]: unknown;
}

// Aliases for backward compatibility if imported elsewhere
export type ConductorNodeType = DagNodeType;
export type ConductorNodeData = DagNodeData;

export function areDagNodePropsEqual(
  prev: NodeProps<DagNodeData>,
  next: NodeProps<DagNodeData>
): boolean {
  if (prev.selected !== next.selected) return false;
  const p = prev.data;
  const n = next.data;
  if (p === n) return true;
  if (!p || !n) return false;

  return (
    p.taskReferenceName === n.taskReferenceName &&
    p.taskType === n.taskType &&
    p.label === n.label &&
    p.executionState === n.executionState &&
    p.durationMs === n.durationMs &&
    p.diffStatus === n.diffStatus &&
    p.hasBreakpoint === n.hasBreakpoint &&
    p.isStartNode === n.isStartNode &&
    p.isEndNode === n.isEndNode &&
    p.validationError === n.validationError &&
    p.attemptNumber === n.attemptNumber &&
    p.workerId === n.workerId &&
    p.error === n.error &&
    p.timeoutSeconds === n.timeoutSeconds &&
    p.retryCount === n.retryCount &&
    p.inputParameters === n.inputParameters &&
    p.outputParameters === n.outputParameters &&
    p.onToggleBreakpoint === n.onToggleBreakpoint &&
    p.onInspectTask === n.onInspectTask
  );
}

export const DagWorkflowNodeComponent = memo(({ data, selected }: NodeProps<DagNodeData>) => {
  const isRunning = data.executionState === 'IN_PROGRESS';
  const startTimeRef = useRef<number | null>(null);
  const [liveElapsedMs, setLiveElapsedMs] = useState<number>(data.durationMs ?? 0);

  useEffect(() => {
    if (isRunning) {
      const baseStart = data.startedAt || startTimeRef.current || Date.now();
      startTimeRef.current = baseStart;
      setLiveElapsedMs(Math.max(0, Date.now() - baseStart));

      const interval = setInterval(() => {
        setLiveElapsedMs(Math.max(0, Date.now() - baseStart));
      }, 100);

      return () => clearInterval(interval);
    } else {
      startTimeRef.current = null;
      if (data.durationMs !== undefined) {
        setLiveElapsedMs(data.durationMs);
      }
    }
  }, [isRunning, data.startedAt, data.durationMs]);

  const hasTelemetryOverlay =
    !data.isStartNode &&
    !data.isEndNode &&
    Boolean(
      data.executionState &&
        data.executionState !== 'PENDING' &&
        data.executionState !== 'SCHEDULED'
    );

  const displayedDurationMs =
    data.durationMs !== undefined ? data.durationMs : isRunning ? liveElapsedMs : undefined;

  const getNodeIcon = () => {
    if (data.isStartNode) {
      return <PlaySquare className="w-4 h-4 text-emerald-500" />;
    }
    if (data.isEndNode) {
      return <StopCircle className="w-4 h-4 text-purple-500" />;
    }
    switch (data.taskType) {
      // Control Flow
      case 'SWITCH':
        return <Split className="w-4 h-4 text-amber-500" />;
      case 'FORK_JOIN':
      case 'JOIN':
        return <GitMerge className="w-4 h-4 text-indigo-500" />;
      case 'DYNAMIC_FORK':
        return <GitFork className="w-4 h-4 text-purple-500" />;
      case 'EXCLUSIVE_JOIN':
        return <GitMerge className="w-4 h-4 text-rose-500" />;
      case 'WAIT':
        return <Clock className="w-4 h-4 text-sky-500" />;
      case 'DO_WHILE':
        return <Repeat className="w-4 h-4 text-emerald-500" />;
      case 'TERMINATE':
        return <StopCircle className="w-4 h-4 text-red-500" />;
      case 'SUB_WORKFLOW':
        return <Layers className="w-4 h-4 text-cyan-500" />;
      case 'START_WORKFLOW':
        return <PlaySquare className="w-4 h-4 text-teal-500" />;
      // Data & Transformation
      case 'JSON_JQ_TRANSFORM':
        return <Braces className="w-4 h-4 text-orange-500" />;
      case 'INLINE':
        return <Code className="w-4 h-4 text-lime-500" />;
      case 'SET_VARIABLE':
        return <Variable className="w-4 h-4 text-violet-500" />;
      // System Connectors & I/O
      case 'HTTP':
        return <Globe className="w-4 h-4 text-blue-500" />;
      case 'JDBC':
        return <Database className="w-4 h-4 text-amber-600" />;
      case 'KAFKA_PUBLISH':
        return <Radio className="w-4 h-4 text-pink-500" />;
      case 'EVENT':
        return <Zap className="w-4 h-4 text-yellow-500" />;
      case 'NOOP':
        return <MinusCircle className="w-4 h-4 text-slate-400" />;
      // Human & Governance
      case 'HUMAN':
        return <UserCheck className="w-4 h-4 text-emerald-600" />;
      // AI & Emerging
      case 'LLM_CHAT_COMPLETE':
        return <Bot className="w-4 h-4 text-fuchsia-500" />;
      case 'CALL_MCP_TOOL':
        return <Cpu className="w-4 h-4 text-indigo-600" />;
      case 'DYNAMIC':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'SIMPLE':
      default:
        return <Play className="w-4 h-4 text-primary" />;
    }
  };

  const getStatusBadge = () => {
    switch (data.executionState) {
      case 'COMPLETED':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            COMPLETED
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded-full border border-emerald-500/30 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            RUNNING
          </span>
        );
      case 'PAUSED_AT_BREAKPOINT':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded-full border border-amber-500/40 animate-pulse">
            <StopCircle className="w-3 h-3 text-rose-500" />
            BREAKPOINT
          </span>
        );
      case 'FAILED':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-full border border-rose-500/20">
            <AlertCircle className="w-3 h-3" />
            FAILED
          </span>
        );
      case 'WAITING_FOR_APPROVAL':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20 animate-pulse">
            <UserCheck className="w-3 h-3" />
            APPROVAL
          </span>
        );
      case 'SKIPPED':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-500/10 px-1.5 py-0.5 rounded-full border border-slate-500/20">
            <MinusCircle className="w-3 h-3" />
            SKIPPED
          </span>
        );
      default:
        if (data.isStartNode) {
          return (
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
              INPUT
            </span>
          );
        }
        if (data.isEndNode) {
          return (
            <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded-full border border-purple-500/20">
              OUTPUT
            </span>
          );
        }
        return (
          <span className="text-[10px] font-medium text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded-full">
            {data.taskType}
          </span>
        );
    }
  };

    const nodeAccessibleLabel = `${data.isStartNode ? 'Start Node' : data.isEndNode ? 'End Node' : data.label || data.taskReferenceName}, status ${data.executionState || 'PENDING'}${data.validationError ? `, error: ${data.validationError}` : ''}`;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (data.onInspectTask) {
          data.onInspectTask(data.taskReferenceName);
        }
      }
    };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={nodeAccessibleLabel}
      aria-selected={Boolean(selected)}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative px-4 py-3 min-w-[200px] rounded-2xl backdrop-blur-xl border transition-all duration-200 select-none',
        'shadow-xl shadow-black/5 dark:shadow-black/30',
        'shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
        'bg-white/75 dark:bg-slate-900/75 border-white/40 dark:border-white/10',
        data.executionState === 'COMPLETED' && 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.35)]',
        data.executionState === 'IN_PROGRESS' && 'border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-500/50 shadow-[0_0_24px_rgba(16,185,129,0.55)] animate-pulse',
        data.executionState === 'PAUSED_AT_BREAKPOINT' && 'border-amber-500 bg-amber-500/20 ring-2 ring-amber-500/70 shadow-[0_0_28px_rgba(245,158,11,0.65)] animate-pulse',
        data.executionState === 'WAITING_FOR_APPROVAL' && 'border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/50 shadow-[0_0_25px_rgba(245,158,11,0.55)] animate-pulse',
        data.executionState === 'FAILED' && 'border-rose-500 bg-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.45)] ring-2 ring-rose-500/50',
        data.executionState === 'SKIPPED' && 'opacity-45 border-dashed border-slate-400/50',
        data.diffStatus === 'added' && 'border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.4)]',
        data.diffStatus === 'removed' && 'border-rose-500 bg-rose-500/15 ring-2 ring-rose-500/50 opacity-70 line-through',
        data.diffStatus === 'modified' && 'border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.4)]',
        data.validationError && 'border-rose-500 ring-2 ring-rose-500/40',
        selected ? 'ring-2 ring-primary border-primary scale-105' : 'hover:scale-[1.02]',
        'cursor-grab active:cursor-grabbing'
      )}
    >
      {/* Liquid Glass Execution Telemetry Hover Popover Card */}
      {hasTelemetryOverlay && (
        <div
          data-testid={`dag-node-hover-card-${data.taskReferenceName}`}
          className={cn(
            'nodrag nopan absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-30 w-56 p-2.5 rounded-xl',
            'backdrop-blur-2xl bg-white/90 dark:bg-slate-900/90 border border-white/40 dark:border-white/15',
            'shadow-2xl shadow-black/20 dark:shadow-black/50',
            'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto',
            'transition-all duration-150 translate-y-1 group-hover:translate-y-0'
          )}
        >
          <div className="flex items-center justify-between gap-1.5 pb-1.5 mb-1.5 border-b border-border/50">
            <span className="text-[10px] font-bold text-foreground truncate">
              {data.label || data.taskReferenceName}
            </span>
            <span
              className={cn(
                'text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase',
                data.executionState === 'COMPLETED' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                data.executionState === 'IN_PROGRESS' && 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300',
                data.executionState === 'FAILED' && 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
                data.executionState !== 'COMPLETED' &&
                  data.executionState !== 'IN_PROGRESS' &&
                  data.executionState !== 'FAILED' &&
                  'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              )}
            >
              {data.executionState}
            </span>
          </div>

          <div className="space-y-1 text-[10px] text-muted-foreground font-mono">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Server className="w-2.5 h-2.5 text-primary" /> Worker:
              </span>
              <span className="text-foreground font-medium truncate max-w-[110px]">
                {data.workerId || 'virtual-thread-pool'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Timer className="w-2.5 h-2.5 text-emerald-500" /> Elapsed:
              </span>
              <span className="text-foreground font-medium">
                {displayedDurationMs !== undefined ? `${displayedDurationMs}ms` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Attempt:</span>
              <span className="text-foreground font-medium">#{data.attemptNumber ?? 1}</span>
            </div>
          </div>

          {data.onInspectTask && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                data.onInspectTask?.(data.taskReferenceName);
              }}
              data-testid={`dag-node-inspect-btn-${data.taskReferenceName}`}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-[10px] font-semibold bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 transition-colors cursor-pointer"
            >
              <Terminal className="w-3 h-3" />
              <span>Inspect I/O & Logs</span>
            </button>
          )}
        </div>
      )}

      {/* Breakpoint Gutter Dot (Top-Left, only in execution inspection mode) */}
      {(data.onToggleBreakpoint || data.hasBreakpoint) && (
        <button
          type="button"
          aria-label={`Toggle breakpoint on ${data.taskReferenceName}`}
          title={data.hasBreakpoint ? 'Remove breakpoint' : 'Set breakpoint on node'}
          onClick={(e) => {
            e.stopPropagation();
            if (data.onToggleBreakpoint) {
              data.onToggleBreakpoint(data.taskReferenceName);
            }
          }}
          className={cn(
            'absolute -top-2 -left-2 z-20 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center transition-all',
            data.hasBreakpoint
              ? 'bg-rose-600 scale-110 shadow-[0_0_10px_rgba(225,29,72,0.8)] opacity-100'
              : 'bg-slate-400/50 opacity-0 group-hover:opacity-80 hover:bg-rose-500'
          )}
          data-testid={`dag-breakpoint-dot-${data.taskReferenceName}`}
        />
      )}
      {/* Diff Status Indicator Pill */}
      {data.diffStatus && (
        <div className="absolute -top-3 -right-2 z-10">
          <span
            className={cn(
              'px-2 py-0.5 text-[9px] font-black uppercase rounded-full shadow-md tracking-wider border',
              data.diffStatus === 'added' && 'bg-emerald-500 text-white border-emerald-400',
              data.diffStatus === 'removed' && 'bg-rose-500 text-white border-rose-400',
              data.diffStatus === 'modified' && 'bg-amber-500 text-white border-amber-400'
            )}
          >
            {data.diffStatus}
          </span>
        </div>
      )}
      {/* Target Handle (Left) - omitted on pure START node since in-degree is strictly 0 */}
      {!data.isStartNode && (
        <Handle
          type="target"
          position={Position.Left}
          id="target-left"
          className="w-2.5 h-2.5 rounded-full bg-slate-400 border-2 border-white dark:border-slate-900 -left-1.5"
          data-testid={`dag-handle-target-${data.taskReferenceName}`}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
            {getNodeIcon()}
          </div>
          <span className="text-xs font-bold tracking-tight text-foreground truncate max-w-[120px]">
            {data.label || data.taskReferenceName}
          </span>
          {data.isStartNode && (
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
              data-testid={`dag-node-start-badge-${data.taskReferenceName}`}
            >
              START
            </span>
          )}
          {data.isEndNode && (
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30"
              data-testid={`dag-node-end-badge-${data.taskReferenceName}`}
            >
              END
            </span>
          )}
        </div>
        {getStatusBadge()}
      </div>

      {/* Body details */}
      {data.isStartNode ? (
        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-1">
          Workflow Input ({Object.keys(data.inputParameters || {}).length} params)
        </div>
      ) : data.isEndNode ? (
        <div className="text-[10px] text-purple-600 dark:text-purple-400 font-mono mt-1">
          Workflow Output ({Object.keys(data.inputParameters || {}).length} mappings)
        </div>
      ) : (
        <>
          <div className="text-[11px] text-muted-foreground line-clamp-1 mb-1">
            Ref: <span className="font-mono text-[10px] text-foreground/80">{data.taskReferenceName}</span>
          </div>

          {displayedDurationMs !== undefined && (
            <div
              className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1"
              data-testid={`dag-node-duration-${data.taskReferenceName}`}
            >
              <Timer className="w-2.5 h-2.5 shrink-0" />
              <span>
                {isRunning ? `Elapsed: ${displayedDurationMs}ms` : `Duration: ${displayedDurationMs}ms`}
                {data.attemptNumber ? ` · Attempt ${data.attemptNumber}` : ''}
              </span>
            </div>
          )}
          {data.timeoutSeconds && displayedDurationMs === undefined && (
            <div className="text-[10px] text-muted-foreground/70">
              Timeout: {data.timeoutSeconds}s {data.retryCount ? `· Retries: ${data.retryCount}` : ''}
            </div>
          )}
        </>
      )}

      {/* Validation Error Banner */}
      {data.validationError && (
        <div className="mt-2 flex items-center gap-1 p-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-medium leading-tight">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span className="truncate">{data.validationError}</span>
        </div>
      )}

      {/* Source Handle (Right) - omitted on pure END node since out-degree is strictly 0 */}
      {!data.isEndNode && (
        <Handle
          type="source"
          position={Position.Right}
          id="source-right"
          className="w-2.5 h-2.5 rounded-full bg-primary border-2 border-white dark:border-slate-900 -right-1.5"
          data-testid={`dag-handle-source-${data.taskReferenceName}`}
        />
      )}
    </div>
  );
}, areDagNodePropsEqual);

DagWorkflowNodeComponent.displayName = 'DagWorkflowNodeComponent';
export const ConductorWorkflowNodeComponent = DagWorkflowNodeComponent;

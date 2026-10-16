import React, { memo } from 'react';
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

export type ExecutionState = 'PENDING' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'TIMED_OUT' | 'SKIPPED' | 'WAITING_FOR_APPROVAL';

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
  error?: string;
  [key: string]: unknown;
}

// Aliases for backward compatibility if imported elsewhere
export type ConductorNodeType = DagNodeType;
export type ConductorNodeData = DagNodeData;

export const DagWorkflowNodeComponent = memo(({ data, selected }: NodeProps<DagNodeData>) => {
  const getNodeIcon = () => {
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
          <span className="flex items-center gap-1 text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded-full border border-sky-500/20 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            RUNNING
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
      default:
        return (
          <span className="text-[10px] font-medium text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded-full">
            {data.taskType}
          </span>
        );
    }
  };

  return (
    <div
      className={cn(
        'group relative px-4 py-3 min-w-[200px] rounded-2xl backdrop-blur-xl border transition-all duration-200 select-none',
        'shadow-xl shadow-black/5 dark:shadow-black/30',
        'shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
        'bg-white/75 dark:bg-slate-900/75 border-white/40 dark:border-white/10',
        data.executionState === 'COMPLETED' && 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.35)]',
        data.executionState === 'IN_PROGRESS' && 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.45)] animate-pulse',
        data.executionState === 'WAITING_FOR_APPROVAL' && 'border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/50 shadow-[0_0_25px_rgba(245,158,11,0.55)] animate-pulse',
        data.executionState === 'FAILED' && 'border-rose-500 bg-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.45)] ring-2 ring-rose-500/50',
        data.validationError && 'border-rose-500 ring-2 ring-rose-500/40',
        selected ? 'ring-2 ring-primary border-primary scale-105' : 'hover:scale-[1.02]',
        'cursor-grab active:cursor-grabbing'
      )}
    >
      {/* Target Handle (Left) */}
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="w-2.5 h-2.5 rounded-full bg-slate-400 border-2 border-white dark:border-slate-900 -left-1.5"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
            {getNodeIcon()}
          </div>
          <span className="text-xs font-bold tracking-tight text-foreground truncate max-w-[120px]">
            {data.label || data.taskReferenceName}
          </span>
        </div>
        {getStatusBadge()}
      </div>

      {/* Body details */}
      <div className="text-[11px] text-muted-foreground line-clamp-1 mb-1">
        Ref: <span className="font-mono text-[10px] text-foreground/80">{data.taskReferenceName}</span>
      </div>

      {data.durationMs !== undefined && (
        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
          Duration: {data.durationMs}ms {data.attemptNumber ? `· Attempt ${data.attemptNumber}` : ''}
        </div>
      )}
      {data.timeoutSeconds && data.durationMs === undefined && (
        <div className="text-[10px] text-muted-foreground/70">
          Timeout: {data.timeoutSeconds}s {data.retryCount ? `· Retries: ${data.retryCount}` : ''}
        </div>
      )}

      {/* Validation Error Banner */}
      {data.validationError && (
        <div className="mt-2 flex items-center gap-1 p-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-medium leading-tight">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span className="truncate">{data.validationError}</span>
        </div>
      )}

      {/* Source Handle (Right) */}
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className="w-2.5 h-2.5 rounded-full bg-primary border-2 border-white dark:border-slate-900 -right-1.5"
      />
    </div>
  );
});

DagWorkflowNodeComponent.displayName = 'DagWorkflowNodeComponent';
export const ConductorWorkflowNodeComponent = DagWorkflowNodeComponent;

import type {
  WorkflowExecution,
  WorkflowExecutionStatus,
  TaskSnapshot,
  WorkflowSnapshot,
} from '@acc/client';

export type {
  WorkflowExecution,
  WorkflowExecutionStatus,
  TaskSnapshot,
  WorkflowSnapshot,
};

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Circle,
  CheckCircle,
  AlertCircle,
  Timer,
  HelpCircle,
  CircleOff,
  Clock,
  Play,
  Split,
  GitMerge,
  GitFork,
  Repeat,
  RotateCcw,
} from 'lucide-react'

export const taskTypeMeta: Record<string, { label: string; icon: any; color: string }> = {
  SIMPLE: {
    label: 'Simple WorkflowExecution',
    icon: Play,
    color: 'text-primary bg-primary/10 border-primary/20',
  },
  SWITCH: {
    label: 'Switch',
    icon: Split,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  },
  FORK_JOIN: {
    label: 'Fork Join',
    icon: GitMerge,
    color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  },
  DYNAMIC_FORK: {
    label: 'Dynamic Fork',
    icon: GitFork,
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
  },
  WAIT: {
    label: 'Wait Timer',
    icon: Clock,
    color: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
  },
  DO_WHILE: {
    label: 'Do While',
    icon: Repeat,
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  },
  MANUAL: {
    label: 'Manual WorkflowExecution',
    icon: Circle,
    color: 'text-slate-500 bg-slate-500/10 border-slate-500/20',
  },
}

export const statuses = [
  // Orchestration engine execution statuses
  {
    label: 'Scheduled',
    value: 'SCHEDULED' as const,
    icon: Clock,
  },
  {
    label: 'In Progress',
    value: 'IN_PROGRESS' as const,
    icon: Timer,
  },
  {
    label: 'Completed',
    value: 'COMPLETED' as const,
    icon: CheckCircle,
  },
  {
    label: 'Failed',
    value: 'FAILED' as const,
    icon: AlertCircle,
  },
  {
    label: 'Timed Out',
    value: 'TIMED_OUT' as const,
    icon: CircleOff,
  },
  {
    label: 'Skipped',
    value: 'SKIPPED' as const,
    icon: RotateCcw,
  },
  // Legacy / Backlog WorkflowExecution Statuses
  {
    label: 'Backlog',
    value: 'backlog' as const,
    icon: HelpCircle,
  },
  {
    label: 'Todo',
    value: 'todo' as const,
    icon: Circle,
  },
  {
    label: 'In Progress (Manual)',
    value: 'in progress' as const,
    icon: Timer,
  },
  {
    label: 'Done',
    value: 'done' as const,
    icon: CheckCircle,
  },
  {
    label: 'Canceled',
    value: 'canceled' as const,
    icon: CircleOff,
  },
]

export const labels = [
  {
    value: 'workflow',
    label: 'Workflow',
  },
  {
    value: 'bug',
    label: 'Bug',
  },
  {
    value: 'feature',
    label: 'Feature',
  },
  {
    value: 'documentation',
    label: 'Documentation',
  },
]




export const priorities = [
  {
    label: 'Low',
    value: 'low' as const,
    icon: ArrowDown,
  },
  {
    label: 'Medium',
    value: 'medium' as const,
    icon: ArrowRight,
  },
  {
    label: 'High',
    value: 'high' as const,
    icon: ArrowUp,
  },
  {
    label: 'Critical',
    value: 'critical' as const,
    icon: AlertCircle,
  },
]


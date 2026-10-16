import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronUp,
  ChevronDown,
  Activity,
  Terminal,
  FileJson,
  AlertOctagon,
  Clock,
  CheckCircle2,
  Loader2,
  XCircle,
  Wifi,
  WifiOff,
  FileDiff,
} from 'lucide-react';
import type { WorkflowExecutionStreamState } from '../hooks/use-workflow-execution-stream';
import type { WorkflowExecutionSnapshot } from '../api/workflow-api';
import { PayloadDiffViewer } from './payload-diff-viewer';

interface ExecutionRunDrawerProps {
  executionId: string;
  stream: WorkflowExecutionStreamState;
  snapshot?: WorkflowExecutionSnapshot | null;
  currentVariables?: Record<string, any>;
  previousVariables?: Record<string, any>;
  currentStepIndex?: number;
  onClose?: () => void;
}

type TabType = 'timeline' | 'logs' | 'payload' | 'diff' | 'diagnostics';

export const ExecutionRunDrawer: React.FC<ExecutionRunDrawerProps> = ({
  executionId,
  stream,
  snapshot,
  currentVariables,
  previousVariables,
  currentStepIndex,
  onClose,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('timeline');

  const getStatusBadge = () => {
    switch (stream.workflowStatus) {
      case 'COMPLETED':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            COMPLETED
          </Badge>
        );
      case 'RUNNING':
        return (
          <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 flex items-center gap-1 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            RUNNING
          </Badge>
        );
      case 'FAILED':
      case 'TERMINATED':
        return (
          <Badge className="bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            {stream.workflowStatus}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {stream.workflowStatus}
          </Badge>
        );
    }
  };

  return (
    <div
      className={cn(
        'absolute bottom-0 left-0 right-0 z-30 transition-all duration-300 ease-in-out',
        'border-t border-white/30 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl shadow-2xl',
        isExpanded ? 'h-72' : 'h-12'
      )}
    >
      {/* Drawer Control Bar */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-white/20 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Execution Stream
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              {executionId}
            </span>
          </div>
          {getStatusBadge()}
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
            {stream.isConnected ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Wifi className="w-3 h-3" /> Live SSE
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <WifiOff className="w-3 h-3" /> Polling Fallback
              </span>
            )}
          </span>
        </div>

        {/* Tab Controls & Drawer Toggle */}
        <div className="flex items-center gap-2">
          {isExpanded && (
            <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-0.5 rounded-lg">
              <Button
                variant={activeTab === 'timeline' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setActiveTab('timeline')}
              >
                <Clock className="w-3.5 h-3.5 mr-1" />
                Timeline
              </Button>
              <Button
                variant={activeTab === 'logs' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setActiveTab('logs')}
              >
                <Terminal className="w-3.5 h-3.5 mr-1" />
                Logs ({stream.logs.length})
              </Button>
              <Button
                variant={activeTab === 'payload' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setActiveTab('payload')}
              >
                <FileJson className="w-3.5 h-3.5 mr-1" />
                Payload
              </Button>
              <Button
                variant={activeTab === 'diff' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setActiveTab('diff')}
              >
                <FileDiff className="w-3.5 h-3.5 mr-1 text-primary" />
                Variable Diff
              </Button>
              <Button
                variant={activeTab === 'diagnostics' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setActiveTab('diagnostics')}
              >
                <AlertOctagon className="w-3.5 h-3.5 mr-1" />
                Diagnostics
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Minimize drawer' : 'Expand drawer'}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>

          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={onClose}
            >
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Drawer Tab Content Body */}
      {isExpanded && (
        <div className="h-[calc(100%-3rem)] p-4 overflow-y-auto">
          {activeTab === 'timeline' && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Active Node Execution States:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {Object.keys(stream.nodeStates).length === 0 ? (
                  <div className="col-span-full text-xs text-muted-foreground italic py-2">
                    Awaiting node dispatch events...
                  </div>
                ) : (
                  Object.entries(stream.nodeStates).map(([nodeRef, state]) => (
                    <div
                      key={nodeRef}
                      className={cn(
                        'flex flex-col p-2 rounded-xl border text-xs backdrop-blur-md',
                        state === 'COMPLETED' && 'border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200',
                        state === 'IN_PROGRESS' && 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-200 animate-pulse',
                        state === 'FAILED' && 'border-rose-500/30 bg-rose-500/5 text-rose-800 dark:text-rose-200',
                        state === 'PENDING' && 'border-muted bg-muted/20 text-muted-foreground'
                      )}
                    >
                      <span className="font-semibold truncate">{nodeRef}</span>
                      <span className="text-[10px] uppercase font-mono mt-1 opacity-80">{state}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="font-mono text-xs bg-slate-950 text-slate-100 p-3 rounded-xl max-h-48 overflow-y-auto space-y-1">
              {stream.logs.length === 0 ? (
                <div className="text-slate-500 italic">No telemetry logs received yet.</div>
              ) : (
                stream.logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2">
                    <span className="text-slate-500 select-none">{log.time}</span>
                    <span
                      className={cn(
                        'font-bold select-none text-[10px] px-1 rounded',
                        log.level === 'SUCCESS' && 'bg-emerald-950 text-emerald-400',
                        log.level === 'INFO' && 'bg-sky-950 text-sky-400',
                        log.level === 'WARN' && 'bg-amber-950 text-amber-400',
                        log.level === 'ERROR' && 'bg-rose-950 text-rose-400'
                      )}
                    >
                      {log.level}
                    </span>
                    <span className="text-slate-200 break-all">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'payload' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Workflow Input Payload
                </span>
                <pre className="font-mono text-xs p-3 rounded-xl bg-black/5 dark:bg-black/30 border border-white/20 dark:border-white/5 overflow-x-auto max-h-44">
                  {JSON.stringify(snapshot?.input || { message: 'No input specified' }, null, 2)}
                </pre>
              </div>
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Workflow Output Payload
                </span>
                <pre className="font-mono text-xs p-3 rounded-xl bg-black/5 dark:bg-black/30 border border-white/20 dark:border-white/5 overflow-x-auto max-h-44">
                  {JSON.stringify(snapshot?.output || { status: stream.workflowStatus }, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'diff' && (
            <PayloadDiffViewer
              currentPayload={currentVariables || snapshot?.output || snapshot?.input || {}}
              previousPayload={previousVariables || snapshot?.input || {}}
              stepIndex={currentStepIndex}
            />
          )}

          {activeTab === 'diagnostics' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-black/5 dark:bg-black/30 border border-white/20 dark:border-white/5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Execution ID:</span>
                  <span className="font-mono font-bold">{executionId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stream Channel:</span>
                  <span className="font-mono">{stream.isConnected ? 'Server-Sent Events (active)' : 'HTTP Polling (active)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tenant / Workspace:</span>
                  <span className="font-mono">{snapshot?.tenantId || 'system'} / {snapshot?.workspaceId || 'default'}</span>
                </div>
                {stream.error && (
                  <div className="flex justify-between text-rose-500">
                    <span>Active Diagnostics Warning:</span>
                    <span>{stream.error}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

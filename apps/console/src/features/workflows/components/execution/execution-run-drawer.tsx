import React, { useState, useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Copy,
  Check,
  Search,
  Filter,
  ArrowDownToLine,
  Trash2,
  Server,
  Layers,
} from 'lucide-react';
import type { WorkflowExecutionStreamState, WorkflowStreamLogItem } from '@/features/workflows/hooks/use-workflow-execution-stream';
import type { WorkflowExecutionSnapshot } from '@/features/workflows/api/workflow-api';
import { PayloadDiffViewer } from './payload-diff-viewer';

export interface ExecutionRunDrawerProps {
  executionId: string;
  stream: WorkflowExecutionStreamState;
  snapshot?: WorkflowExecutionSnapshot | null;
  currentVariables?: Record<string, any>;
  previousVariables?: Record<string, any>;
  currentStepIndex?: number;
  onClose?: () => void;
  // Node selection coordination
  selectedTaskRef?: string | null;
  onSelectTaskRef?: (taskRef: string | null) => void;
  availableTaskRefs?: string[];
  // Viewport and docking offsets
  bottomOffsetClass?: string;
  className?: string;
}

export type ExecutionDrawerTabType = 'timeline' | 'logs' | 'payload' | 'diff' | 'diagnostics';
type LogLevelFilter = 'ALL' | 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';

export const ExecutionRunDrawer: React.FC<ExecutionRunDrawerProps> = ({
  executionId,
  stream,
  snapshot,
  currentVariables,
  previousVariables,
  currentStepIndex,
  onClose,
  selectedTaskRef = null,
  onSelectTaskRef,
  availableTaskRefs = [],
  bottomOffsetClass = 'bottom-0',
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<ExecutionDrawerTabType>('logs');

  // Terminal Logs State
  const [logFilterQuery, setLogFilterQuery] = useState('');
  const [selectedLogLevel, setSelectedLogLevel] = useState<LogLevelFilter>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const [allCopied, setAllCopied] = useState(false);

  const terminalScrollRef = useRef<HTMLDivElement>(null);

  // Auto-expand drawer if a node was explicitly selected to inspect
  useEffect(() => {
    if (selectedTaskRef) {
      setIsExpanded(true);
      setActiveTab('logs');
    }
  }, [selectedTaskRef]);

  // Terminal Auto-Scroll Hook
  useEffect(() => {
    if (autoScroll && activeTab === 'logs' && terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [stream.logs.length, autoScroll, activeTab]);

  // Filtered Logs Memo
  const filteredLogs = useMemo(() => {
    return stream.logs.filter((log: WorkflowStreamLogItem) => {
      // 1. Task filter
      if (selectedTaskRef) {
        const matchesRef =
          log.taskReferenceName === selectedTaskRef ||
          log.message.includes(selectedTaskRef) ||
          (log.raw && typeof log.raw === 'object' && (log.raw as any).taskReferenceName === selectedTaskRef);
        if (!matchesRef) return false;
      }

      // 2. Log level filter
      if (selectedLogLevel !== 'ALL' && log.level !== selectedLogLevel) {
        return false;
      }

      // 3. Regex / search query filter
      if (logFilterQuery.trim()) {
        try {
          const regex = new RegExp(logFilterQuery.trim(), 'i');
          const textToSearch = `${log.time} ${log.level} ${log.taskReferenceName || ''} ${log.workerId || ''} ${log.message}`;
          if (!regex.test(textToSearch)) return false;
        } catch {
          // Fallback to substring if regex is invalid
          const query = logFilterQuery.toLowerCase();
          const textToSearch = `${log.time} ${log.level} ${log.taskReferenceName || ''} ${log.workerId || ''} ${log.message}`.toLowerCase();
          if (!textToSearch.includes(query)) return false;
        }
      }

      return true;
    });
  }, [stream.logs, selectedTaskRef, selectedLogLevel, logFilterQuery]);

  // Counts by log level
  const logLevelCounts = useMemo(() => {
    const counts = { ALL: stream.logs.length, INFO: 0, SUCCESS: 0, WARN: 0, ERROR: 0 };
    stream.logs.forEach((log) => {
      if (log.level in counts) {
        counts[log.level as keyof typeof counts]++;
      }
    });
    return counts;
  }, [stream.logs]);

  // Copy single log line
  const handleCopyLine = (log: WorkflowStreamLogItem) => {
    const line = `[${log.time}] [${log.level}] ${log.taskReferenceName ? `(${log.taskReferenceName}) ` : ''}${log.message}`;
    navigator.clipboard.writeText(line);
    setCopiedLogId(log.id);
    setTimeout(() => setCopiedLogId(null), 2000);
  };

  // Copy all filtered logs
  const handleCopyAll = () => {
    const fullText = filteredLogs
      .map(
        (l) =>
          `[${l.time}] [${l.level}] ${l.taskReferenceName ? `(${l.taskReferenceName}) ` : ''}${l.workerId ? `<${l.workerId}> ` : ''}${l.message}`
      )
      .join('\n');
    navigator.clipboard.writeText(fullText);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  };

  const getStatusBadge = () => {
    switch (stream.workflowStatus) {
      case 'COMPLETED':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3" />
            COMPLETED
          </Badge>
        );
      case 'RUNNING':
        return (
          <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 flex items-center gap-1 animate-pulse font-medium">
            <Loader2 className="w-3 h-3 animate-spin" />
            RUNNING
          </Badge>
        );
      case 'FAILED':
      case 'TERMINATED':
        return (
          <Badge className="bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30 flex items-center gap-1 font-medium">
            <XCircle className="w-3 h-3" />
            {stream.workflowStatus}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground flex items-center gap-1 font-medium">
            <Clock className="w-3 h-3" />
            {stream.workflowStatus}
          </Badge>
        );
    }
  };

  return (
    <div
      data-testid="execution-run-drawer"
      className={cn(
        'absolute left-3 right-3 z-30 transition-all duration-300 ease-in-out',
        'border border-white/30 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl shadow-2xl rounded-2xl overflow-hidden',
        bottomOffsetClass,
        isExpanded ? 'h-72' : 'h-12',
        className
      )}
    >
      {/* 1. Drawer Header / Control Strip */}
      <div className="h-12 px-3 sm:px-4 flex items-center justify-between border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Activity className="w-4 h-4 text-primary animate-pulse shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground hidden sm:inline">
              Execution Stream
            </span>
            <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[90px] sm:max-w-[140px]" title={executionId}>
              {executionId}
            </span>
          </div>

          <div className="shrink-0">{getStatusBadge()}</div>

          <span className="hidden md:flex items-center gap-1 text-[11px] text-muted-foreground font-mono shrink-0">
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

          {/* Active Task Filter Chip if filtered */}
          {selectedTaskRef && (
            <Badge
              variant="outline"
              className="hidden lg:flex items-center gap-1 text-[10px] bg-primary/10 text-primary border-primary/30"
            >
              <span>Task: {selectedTaskRef}</span>
              <button
                type="button"
                onClick={() => onSelectTaskRef?.(null)}
                className="hover:text-foreground ml-0.5"
                title="Clear task filter"
              >
                ×
              </button>
            </Badge>
          )}
        </div>

        {/* Tab Controls & Drawer Minimize/Maximize */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {isExpanded && (
            <div className="flex items-center gap-0.5 sm:gap-1 bg-muted/60 p-0.5 rounded-xl border border-border/40">
              <Button
                variant={activeTab === 'logs' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-2 sm:px-2.5"
                onClick={() => setActiveTab('logs')}
                data-testid="execution-tab-logs"
              >
                <Terminal className="w-3.5 h-3.5 mr-1" />
                <span>Logs</span>
                <span className="ml-1 text-[10px] opacity-80">({filteredLogs.length})</span>
              </Button>
              <Button
                variant={activeTab === 'timeline' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-2 sm:px-2.5"
                onClick={() => setActiveTab('timeline')}
                data-testid="execution-tab-timeline"
              >
                <Clock className="w-3.5 h-3.5 mr-1" />
                <span className="hidden sm:inline">Tasks</span>
              </Button>
              <Button
                variant={activeTab === 'payload' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-2 sm:px-2.5"
                onClick={() => setActiveTab('payload')}
                data-testid="execution-tab-payload"
              >
                <FileJson className="w-3.5 h-3.5 mr-1" />
                <span className="hidden sm:inline">Payload</span>
              </Button>
              <Button
                variant={activeTab === 'diff' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-2 sm:px-2.5"
                onClick={() => setActiveTab('diff')}
                data-testid="execution-tab-diff"
              >
                <FileDiff className="w-3.5 h-3.5 mr-1 text-primary" />
                <span className="hidden sm:inline">Diff</span>
              </Button>
              <Button
                variant={activeTab === 'diagnostics' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-2 sm:px-2.5"
                onClick={() => setActiveTab('diagnostics')}
                data-testid="execution-tab-diagnostics"
              >
                <AlertOctagon className="w-3.5 h-3.5 mr-1" />
                <span className="hidden sm:inline">Diagnostics</span>
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setIsExpanded((prev) => !prev)}
            title={isExpanded ? 'Minimize execution console' : 'Expand execution console'}
            aria-label={isExpanded ? 'Minimize console' : 'Expand console'}
            data-testid="execution-drawer-toggle-btn"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>

          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
              onClick={onClose}
            >
              Close
            </Button>
          )}
        </div>
      </div>

      {/* 2. Expanded Drawer Body */}
      {isExpanded && (
        <div className="h-[calc(100%-3rem)] flex flex-col min-h-0 bg-background/50">
          {/* TAB: Enhanced Logs Terminal */}
          {activeTab === 'logs' && (
            <div className="flex-1 flex flex-col min-h-0 p-3 gap-2">
              {/* Terminal Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  {/* Search query input */}
                  <div className="relative w-36 sm:w-48">
                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      placeholder="Filter logs (regex)..."
                      value={logFilterQuery}
                      onChange={(e) => setLogFilterQuery(e.target.value)}
                      className="h-7 text-xs pl-8 pr-2 bg-background/70 border-border/50"
                      data-testid="log-search-input"
                    />
                  </div>

                  {/* Task Step filter dropdown */}
                  {availableTaskRefs.length > 0 && (
                    <select
                      aria-label="Filter by task step"
                      value={selectedTaskRef || ''}
                      onChange={(e) => onSelectTaskRef?.(e.target.value || null)}
                      className="h-7 px-2 text-xs rounded-md bg-background/70 border border-border/50 text-foreground cursor-pointer focus:outline-none max-w-[130px] truncate"
                      data-testid="log-task-filter-select"
                    >
                      <option value="">All Tasks ({availableTaskRefs.length})</option>
                      {availableTaskRefs.map((ref) => (
                        <option key={ref} value={ref}>
                          Task: {ref}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Log level chips */}
                  <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/40">
                    {(['ALL', 'INFO', 'SUCCESS', 'WARN', 'ERROR'] as LogLevelFilter[]).map((level) => {
                      const count = logLevelCounts[level] ?? 0;
                      const isSelected = selectedLogLevel === level;
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setSelectedLogLevel(level)}
                          className={cn(
                            'px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-all',
                            isSelected
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                          data-testid={`log-level-chip-${level}`}
                        >
                          {level} {count > 0 ? `(${count})` : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right controls: Auto-scroll & Copy All */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant={autoScroll ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs gap-1 px-2"
                    onClick={() => setAutoScroll((prev) => !prev)}
                    title={autoScroll ? 'Auto-scroll enabled (following tail)' : 'Auto-scroll paused'}
                    data-testid="log-autoscroll-toggle-btn"
                  >
                    <ArrowDownToLine className={cn('w-3 h-3', autoScroll && 'animate-bounce')} />
                    <span className="hidden sm:inline">Follow</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 px-2"
                    onClick={handleCopyAll}
                    disabled={filteredLogs.length === 0}
                    title="Copy all filtered logs to clipboard"
                    data-testid="log-copy-all-btn"
                  >
                    {allCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span className="hidden sm:inline">{allCopied ? 'Copied' : 'Copy'}</span>
                  </Button>
                </div>
              </div>

              {/* Terminal Screen Container */}
              <div
                ref={terminalScrollRef}
                data-testid="execution-terminal-logs"
                className="flex-1 font-mono text-[11px] bg-slate-950 text-slate-100 p-2.5 rounded-xl overflow-y-auto space-y-1 select-text border border-white/10 shadow-inner"
              >
                {filteredLogs.length === 0 ? (
                  <div className="text-slate-500 italic p-3 text-center">
                    {stream.logs.length === 0
                      ? 'No telemetry logs received yet. Dispatching stream...'
                      : 'No logs match the active filter criteria.'}
                  </div>
                ) : (
                  filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      className="group flex items-start justify-between gap-2 py-0.5 px-1 rounded hover:bg-slate-900/80 transition-colors"
                    >
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <span className="text-slate-500 select-none shrink-0 text-[10px]">{log.time}</span>
                        <span
                          className={cn(
                            'font-bold select-none text-[9px] px-1 rounded shrink-0 uppercase',
                            log.level === 'SUCCESS' && 'bg-emerald-950 text-emerald-400 border border-emerald-800/40',
                            log.level === 'INFO' && 'bg-sky-950 text-sky-400 border border-sky-800/40',
                            log.level === 'WARN' && 'bg-amber-950 text-amber-400 border border-amber-800/40',
                            log.level === 'ERROR' && 'bg-rose-950 text-rose-400 border border-rose-800/40'
                          )}
                        >
                          {log.level}
                        </span>
                        {log.taskReferenceName && (
                          <span
                            className="text-sky-300 font-semibold select-none shrink-0 cursor-pointer hover:underline"
                            onClick={() => onSelectTaskRef?.(log.taskReferenceName || null)}
                            title={`Filter logs to ${log.taskReferenceName}`}
                          >
                            [{log.taskReferenceName}]
                          </span>
                        )}
                        {log.workerId && (
                          <span className="text-muted-foreground select-none shrink-0 hidden md:inline text-[10px]">
                            &lt;{log.workerId}&gt;
                          </span>
                        )}
                        <span className="text-slate-200 break-all leading-tight">{log.message}</span>
                      </div>

                      {/* 1-click line copy button */}
                      <button
                        type="button"
                        onClick={() => handleCopyLine(log)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-100 transition-opacity p-1 shrink-0"
                        title="Copy log line"
                        aria-label="Copy log line"
                      >
                        {copiedLogId === log.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: Tasks / Timeline State */}
          {activeTab === 'timeline' && (
            <div className="flex-1 p-3 overflow-y-auto space-y-3">
              <div className="text-xs font-semibold text-muted-foreground">
                Task Execution Node Dispatch States:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {Object.keys(stream.nodeStates).length === 0 ? (
                  <div className="col-span-full text-xs text-muted-foreground italic py-3 text-center">
                    Awaiting node dispatch events...
                  </div>
                ) : (
                  Object.entries(stream.nodeStates).map(([nodeRef, state]) => (
                    <div
                      key={nodeRef}
                      onClick={() => onSelectTaskRef?.(nodeRef)}
                      className={cn(
                        'flex flex-col p-2 rounded-xl border text-xs backdrop-blur-md cursor-pointer transition-all hover:scale-[1.02]',
                        selectedTaskRef === nodeRef && 'ring-2 ring-primary shadow-md',
                        state === 'COMPLETED' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
                        state === 'IN_PROGRESS' && 'border-emerald-500/40 bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 animate-pulse',
                        state === 'FAILED' && 'border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200',
                        state === 'PENDING' && 'border-muted bg-muted/20 text-muted-foreground'
                      )}
                    >
                      <span className="font-bold truncate">{nodeRef}</span>
                      <span className="text-[10px] uppercase font-mono mt-1 opacity-80">{state}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: Payload Inputs and Outputs */}
          {activeTab === 'payload' && (
            <div className="flex-1 p-3 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Workflow Input Payload
                </span>
                <pre className="font-mono text-xs p-3 rounded-xl bg-slate-950 text-slate-200 border border-white/10 overflow-x-auto max-h-48">
                  {JSON.stringify(snapshot?.input || { message: 'No input payload recorded' }, null, 2)}
                </pre>
              </div>
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Workflow Output Payload
                </span>
                <pre className="font-mono text-xs p-3 rounded-xl bg-slate-950 text-slate-200 border border-white/10 overflow-x-auto max-h-48">
                  {JSON.stringify(snapshot?.output || { status: stream.workflowStatus }, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* TAB: Variable Diff */}
          {activeTab === 'diff' && (
            <div className="flex-1 p-3 overflow-y-auto">
              <PayloadDiffViewer
                currentPayload={currentVariables || snapshot?.output || snapshot?.input || {}}
                previousPayload={previousVariables || snapshot?.input || {}}
                stepIndex={currentStepIndex}
              />
            </div>
          )}

          {/* TAB: Diagnostics */}
          {activeTab === 'diagnostics' && (
            <div className="flex-1 p-3 overflow-y-auto space-y-2">
              <div className="p-3 rounded-xl bg-background/70 border border-border/40 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Execution ID:</span>
                  <span className="font-mono font-bold text-foreground">{executionId}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Telemetry Channel:</span>
                  <span className="font-mono text-foreground">
                    {stream.isConnected ? 'Server-Sent Events (Live channel)' : 'HTTP Polling (Adaptive fallback)'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Connection State:</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {stream.connectionState}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Retry Attempts:</span>
                  <span className="font-mono">{stream.retryAttempt} / 5</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Tenant / Workspace:</span>
                  <span className="font-mono text-foreground">
                    {snapshot?.tenantId || 'system'} / {snapshot?.workspaceId || 'default'}
                  </span>
                </div>
                {stream.error && (
                  <div className="flex justify-between text-rose-500 pt-1 border-t border-border/30">
                    <span className="font-semibold">Stream Warning:</span>
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

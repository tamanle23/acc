import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import {
  Server,
  Cpu,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Zap,
} from 'lucide-react';
import type { WorkerFleetSummary } from '../api/worker-fleet-api';

export interface WorkerFleetMetricsProps {
  summary: WorkerFleetSummary;
  className?: string;
}

export const WorkerFleetMetrics: React.FC<WorkerFleetMetricsProps> = ({
  summary,
  className,
}) => {
  return (
    <div
      data-testid="worker-fleet-metrics"
      className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4', className)}
    >
      {/* Total Workers */}
      <Card className="backdrop-blur-xl bg-white/65 dark:bg-slate-900/65 border-white/30 dark:border-white/10 shadow-xl shadow-black/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Polyglot Workers
            </span>
            <div className="text-2xl font-bold font-mono text-foreground flex items-center gap-2">
              {summary.totalWorkers}
              <span className="text-xs font-normal text-muted-foreground">hosts</span>
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3" /> {summary.healthyCount} Healthy
              </span>
              {summary.degradedCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-mono text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3 h-3" /> {summary.degradedCount} Degraded
                </span>
              )}
              {summary.offlineCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-mono text-rose-600 dark:text-rose-400">
                  <XCircle className="w-3 h-3" /> {summary.offlineCount} Offline
                </span>
              )}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Server className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      {/* Active Leases / Concurrency */}
      <Card className="backdrop-blur-xl bg-white/65 dark:bg-slate-900/65 border-white/30 dark:border-white/10 shadow-xl shadow-black/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active Leases
            </span>
            <div className="text-2xl font-bold font-mono text-foreground flex items-center gap-2">
              {summary.activeLeases}
              <span className="text-xs font-normal text-muted-foreground">in-flight</span>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
              <Cpu className="w-3 h-3 text-primary" /> Multi-Tenant Lease Distribution
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Zap className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      {/* Throughput */}
      <Card className="backdrop-blur-xl bg-white/65 dark:bg-slate-900/65 border-white/30 dark:border-white/10 shadow-xl shadow-black/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Throughput
            </span>
            <div className="text-2xl font-bold font-mono text-foreground flex items-center gap-2">
              {summary.tasksPerSecond.toFixed(1)}
              <span className="text-xs font-normal text-muted-foreground">tasks/sec</span>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
              <Activity className="w-3 h-3 text-emerald-500 animate-pulse" /> Real-time Polling Rate
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      {/* Completed Tasks Total */}
      <Card className="backdrop-blur-xl bg-white/65 dark:bg-slate-900/65 border-white/30 dark:border-white/10 shadow-xl shadow-black/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Processed Tasks
            </span>
            <div className="text-2xl font-bold font-mono text-foreground">
              {summary.totalCompletedTasks.toLocaleString()}
            </div>
            <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> Cumulative Fleet Total
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

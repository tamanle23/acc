import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Server,
  Cpu,
  WifiOff,
  AlertTriangle,
  RotateCcw,
  Coffee,
  Code,
  Loader2,
} from 'lucide-react';
import type { WorkerTelemetry } from '../api/worker-fleet-api';

export interface WorkerCardProps {
  worker: WorkerTelemetry;
  onDrain?: (workerId: string) => Promise<void> | void;
  isDraining?: boolean;
}

export const WorkerCard: React.FC<WorkerCardProps> = ({
  worker,
  onDrain,
  isDraining = false,
}) => {
  const [showConfirmDrain, setShowConfirmDrain] = useState(false);

  const getStatusBadge = () => {
    switch (worker.status) {
      case 'HEALTHY':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 flex items-center gap-1 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            HEALTHY
          </Badge>
        );
      case 'DEGRADED':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 flex items-center gap-1 text-[11px]">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            DEGRADED
          </Badge>
        );
      case 'DRAINING':
        return (
          <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 flex items-center gap-1 text-[11px]">
            <Loader2 className="w-3 h-3 text-sky-500 animate-spin" />
            DRAINING
          </Badge>
        );
      case 'OFFLINE':
      default:
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 flex items-center gap-1 text-[11px]">
            <WifiOff className="w-3 h-3 text-rose-500" />
            OFFLINE
          </Badge>
        );
    }
  };

  const getRuntimeBadge = () => {
    if (worker.runtime === 'JAVA_VIRTUAL_THREADS') {
      return (
        <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-500/5 flex items-center gap-1">
          <Coffee className="w-3 h-3 text-amber-600" />
          Java 21 Virtual Threads
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/5 flex items-center gap-1">
        <Code className="w-3 h-3 text-emerald-600" />
        Node.js @acc/worker
      </Badge>
    );
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${seconds % 60}s`;
  };

  const heartbeatAgeMs = Math.max(0, Date.now() - worker.lastHeartbeatEpochMs);
  const leaseLoadPercent = Math.min(
    100,
    worker.concurrencyLimit > 0 ? (worker.activeLeases / worker.concurrencyLimit) * 100 : 0
  );

  const handleConfirmDrain = async () => {
    if (onDrain) {
      await onDrain(worker.workerId);
    }
    setShowConfirmDrain(false);
  };

  return (
    <Card
      data-testid={`worker-card-${worker.workerId}`}
      className={cn(
        'backdrop-blur-xl bg-white/65 dark:bg-slate-900/65 border-white/30 dark:border-white/10 shadow-xl transition-all duration-200',
        worker.status === 'OFFLINE' && 'opacity-70 border-rose-500/20'
      )}
    >
      <CardContent className="p-4 space-y-3">
        {/* Top Header: ID & Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              <span className="font-mono font-bold text-sm text-foreground truncate max-w-[200px]" title={worker.workerId}>
                {worker.workerId}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
              <span>Host: {worker.hostIp}</span>
              <span>·</span>
              <span>Uptime: {formatUptime(worker.uptimeSeconds)}</span>
            </div>
          </div>
          {getStatusBadge()}
        </div>

        {/* Runtime & Domains */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
          {getRuntimeBadge()}
          <span className="text-[11px] font-mono text-muted-foreground">
            Heartbeat: {heartbeatAgeMs}ms ago
          </span>
        </div>

        {/* Concurrency Load Meter */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-muted-foreground flex items-center gap-1">
              <Cpu className="w-3 h-3 text-primary" /> Active Concurrency
            </span>
            <span className="font-semibold text-foreground">
              {worker.activeLeases} / {worker.concurrencyLimit} leases ({Math.round(leaseLoadPercent)}%)
            </span>
          </div>
          <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                leaseLoadPercent > 85 ? 'bg-rose-500' : leaseLoadPercent > 50 ? 'bg-amber-500' : 'bg-primary'
              )}
              style={{ width: `${leaseLoadPercent}%` }}
            />
          </div>
        </div>

        {/* Domains List */}
        <div className="flex items-center gap-1 flex-wrap pt-1">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground mr-1">
            Domains:
          </span>
          {worker.pollDomains.map((domain) => (
            <Badge key={domain} variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
              {domain}
            </Badge>
          ))}
        </div>

        {/* Stats & Actions */}
        <div className="pt-2 border-t border-white/20 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
            <span>Completed: <strong className="text-foreground">{worker.tasksCompletedCount}</strong></span>
            <span>Errors: <strong className={worker.errorCount > 0 ? 'text-rose-500 font-bold' : 'text-foreground'}>{worker.errorCount}</strong></span>
          </div>

          {/* Drain Action */}
          {worker.status !== 'OFFLINE' && worker.status !== 'DRAINING' && (
            <div>
              {showConfirmDrain ? (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs px-2"
                    disabled={isDraining}
                    onClick={handleConfirmDrain}
                  >
                    {isDraining ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm Drain'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2"
                    onClick={() => setShowConfirmDrain(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                  onClick={() => setShowConfirmDrain(true)}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Drain
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

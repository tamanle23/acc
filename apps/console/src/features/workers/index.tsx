import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Server,
  RefreshCw,
  Search,
  ShieldAlert,
  Loader2,
  Coffee,
  Code,
} from 'lucide-react';
import { useWorkerFleet, useDrainWorker, type WorkerTelemetry } from './api/worker-fleet-api';
import { WorkerFleetMetrics } from './components/worker-fleet-metrics';
import { WorkerCard } from './components/worker-card';
import { WorkerChaosPanel } from './components/worker-chaos-panel';

export const WorkerFleetFeature: React.FC = () => {
  const [refreshInterval, setRefreshInterval] = useState<number>(3000);
  const [searchQuery, setSearchQuery] = useState('');
  const [runtimeFilter, setRuntimeFilter] = useState<'ALL' | 'JAVA_VIRTUAL_THREADS' | 'NODEJS_WORKER'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'DRAINING'>('ALL');
  const [activeChaosProfile, setActiveChaosProfile] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useWorkerFleet(refreshInterval);
  const drainMutation = useDrainWorker();

  // Local simulated chaos states for interactive testing
  const [localWorkersOverride, setLocalWorkersOverride] = useState<WorkerTelemetry[] | null>(null);

  const workers = useMemo(() => {
    return localWorkersOverride || data?.workers || [];
  }, [localWorkersOverride, data?.workers]);

  const summary = useMemo(() => {
    if (localWorkersOverride) {
      let healthyCount = 0;
      let degradedCount = 0;
      let offlineCount = 0;
      let drainingCount = 0;
      let activeLeases = 0;
      let totalCompletedTasks = 0;

      for (const w of localWorkersOverride) {
        if (w.status === 'HEALTHY') healthyCount++;
        else if (w.status === 'DEGRADED') degradedCount++;
        else if (w.status === 'OFFLINE') offlineCount++;
        else if (w.status === 'DRAINING') drainingCount++;
        activeLeases += w.activeLeases;
        totalCompletedTasks += w.tasksCompletedCount;
      }

      return {
        totalWorkers: localWorkersOverride.length,
        activeLeases,
        totalCompletedTasks,
        healthyCount,
        degradedCount,
        offlineCount,
        drainingCount,
        tasksPerSecond: activeLeases * 1.8,
      };
    }

    return (
      data?.summary || {
        totalWorkers: 0,
        activeLeases: 0,
        totalCompletedTasks: 0,
        healthyCount: 0,
        degradedCount: 0,
        offlineCount: 0,
        drainingCount: 0,
        tasksPerSecond: 0,
      }
    );
  }, [localWorkersOverride, data?.summary]);

  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      if (runtimeFilter !== 'ALL' && w.runtime !== runtimeFilter) return false;
      if (statusFilter !== 'ALL' && w.status !== statusFilter) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        w.workerId.toLowerCase().includes(q) ||
        w.hostIp.toLowerCase().includes(q) ||
        w.pollDomains.some((d) => d.toLowerCase().includes(q))
      );
    });
  }, [workers, runtimeFilter, statusFilter, searchQuery]);

  const handleDrain = async (workerId: string) => {
    if (localWorkersOverride) {
      setLocalWorkersOverride((prev) =>
        prev
          ? prev.map((w) => (w.workerId === workerId ? { ...w, status: 'DRAINING' as const } : w))
          : null
      );
    }
    await drainMutation.mutateAsync(workerId);
  };

  // Chaos simulation handlers
  const handleSimulateCrash = () => {
    setActiveChaosProfile('Worker Crash (kill -9) injected on random host');
    setLocalWorkersOverride((prev) => {
      const list = prev ? [...prev] : [...(data?.workers || [])];
      if (list.length > 0) {
        list[0] = { ...list[0], status: 'OFFLINE', activeLeases: 0 };
      }
      return list;
    });
  };

  const handleInjectLatency = () => {
    setActiveChaosProfile('2000ms Polling Jitter / Network Partition Active');
    setLocalWorkersOverride((prev) => {
      const list = prev ? [...prev] : [...(data?.workers || [])];
      return list.map((w) => (w.status === 'HEALTHY' ? { ...w, status: 'DEGRADED' as const } : w));
    });
  };

  const handleInjectPoisonBurst = () => {
    setActiveChaosProfile('5 Poison Tasks Triggered into Dead-Letter Queue');
    setLocalWorkersOverride((prev) => {
      const list = prev ? [...prev] : [...(data?.workers || [])];
      if (list.length > 1) {
        list[1] = { ...list[1], errorCount: list[1].errorCount + 5 };
      }
      return list;
    });
  };

  const handleHealAll = () => {
    setActiveChaosProfile(null);
    setLocalWorkersOverride(null);
    refetch();
  };

  return (
    <div
      data-testid="worker-fleet-feature"
      className="p-6 space-y-6 max-w-7xl mx-auto"
    >
      {/* Sovereign Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/20 dark:border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Worker Fleet Telemetry
            </h1>
            <Badge className="bg-primary/20 text-primary border-primary/30 font-mono text-[10px]">
              SOVEREIGN CUSTODY
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono border-amber-600/40 text-amber-900 dark:text-amber-200 bg-amber-500/10">
              ROOT
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time health, virtual thread concurrency, and multi-domain task scheduling across Java and Node.js hosts.
          </p>
        </div>

        {/* Polling / Refresh Controls */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs font-mono backdrop-blur-md bg-white/50 dark:bg-slate-900/50"
            onClick={() => setRefreshInterval(refreshInterval > 0 ? 0 : 3000)}
          >
            {refreshInterval > 0 ? (
              <span className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live 3s
              </span>
            ) : (
              <span className="text-muted-foreground">Paused</span>
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs px-2.5 backdrop-blur-md bg-white/50 dark:bg-slate-900/50"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('w-3.5 h-3.5 mr-1', isFetching && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Aggregate Metric Cards */}
      <WorkerFleetMetrics summary={summary} />

      {/* Chaos Injection Panel */}
      <WorkerChaosPanel
        onSimulateCrash={handleSimulateCrash}
        onInjectLatency={handleInjectLatency}
        onInjectPoisonBurst={handleInjectPoisonBurst}
        onHealAll={handleHealAll}
        activeChaosProfile={activeChaosProfile}
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-3 rounded-2xl border border-white/20 dark:border-white/10 shadow-lg">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Search by worker ID, IP or domain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 text-xs bg-white/50 dark:bg-slate-900/50"
          />
        </div>

        {/* Runtime & Status Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
            <button
              onClick={() => setRuntimeFilter('ALL')}
              className={cn(
                'px-2.5 py-1 text-xs rounded-lg font-medium transition-all',
                runtimeFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-800 text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              All Runtimes
            </button>
            <button
              onClick={() => setRuntimeFilter('JAVA_VIRTUAL_THREADS')}
              className={cn(
                'px-2.5 py-1 text-xs rounded-lg font-medium transition-all flex items-center gap-1',
                runtimeFilter === 'JAVA_VIRTUAL_THREADS'
                  ? 'bg-white dark:bg-slate-800 text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Coffee className="w-3 h-3 text-amber-600" /> Java
            </button>
            <button
              onClick={() => setRuntimeFilter('NODEJS_WORKER')}
              className={cn(
                'px-2.5 py-1 text-xs rounded-lg font-medium transition-all flex items-center gap-1',
                runtimeFilter === 'NODEJS_WORKER'
                  ? 'bg-white dark:bg-slate-800 text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Code className="w-3 h-3 text-emerald-600" /> Node.js
            </button>
          </div>

          <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
            {(['ALL', 'HEALTHY', 'DEGRADED', 'OFFLINE'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'px-2 py-1 text-[11px] font-mono rounded-lg transition-all',
                  statusFilter === status
                    ? 'bg-white dark:bg-slate-800 text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Worker Fleet Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Connecting to Worker Fleet Registry...</span>
        </div>
      ) : isError ? (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-center space-y-2">
          <ShieldAlert className="w-8 h-8 mx-auto" />
          <div className="text-sm font-bold">Failed to connect to Worker Fleet Registry</div>
          <p className="text-xs opacity-80">Check backend connectivity or verify permissions.</p>
        </div>
      ) : filteredWorkers.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 space-y-2">
          <Server className="w-8 h-8 text-muted-foreground mx-auto" />
          <div className="text-sm font-medium text-foreground">No worker instances match the active filters</div>
          <p className="text-xs text-muted-foreground">Try clearing your search query or switching filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkers.map((worker) => (
            <WorkerCard
              key={worker.workerId}
              worker={worker}
              onDrain={handleDrain}
              isDraining={drainMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
};

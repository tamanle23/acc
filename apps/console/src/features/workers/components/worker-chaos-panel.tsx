import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Flame,
  Skull,
  Timer,
  ShieldCheck,
  ZapOff,
  AlertOctagon,
} from 'lucide-react';

export interface WorkerChaosPanelProps {
  onSimulateCrash?: () => void;
  onInjectLatency?: () => void;
  onInjectPoisonBurst?: () => void;
  onHealAll?: () => void;
  activeChaosProfile?: string | null;
}

export const WorkerChaosPanel: React.FC<WorkerChaosPanelProps> = ({
  onSimulateCrash,
  onInjectLatency,
  onInjectPoisonBurst,
  onHealAll,
  activeChaosProfile,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card
      data-testid="worker-chaos-panel"
      className="backdrop-blur-xl bg-rose-500/5 dark:bg-rose-950/10 border-rose-500/20 shadow-xl"
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
              Chaos Engineering Injection Console
            </span>
            <Badge variant="outline" className="text-[10px] border-rose-500/30 text-rose-600 bg-rose-500/10">
              SANDBOX / DEV ONLY
            </Badge>
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-rose-700 dark:text-rose-300 hover:bg-rose-500/10"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Collapse' : 'Expand Controls'}
          </Button>
        </div>

        {isExpanded && (
          <div className="pt-2 border-t border-rose-500/20 space-y-3">
            <p className="text-xs text-muted-foreground">
              Simulate volatile runtime anomalies to verify lease sweeper reclamation, virtual-thread failover, and zero-loss state recovery.
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-500/15"
                onClick={onSimulateCrash}
              >
                <Skull className="w-3.5 h-3.5 mr-1 text-rose-500" />
                Simulate Worker Crash (kill -9)
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/15"
                onClick={onInjectLatency}
              >
                <Timer className="w-3.5 h-3.5 mr-1 text-amber-500" />
                Inject 2000ms Jitter/Latency
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-500/15"
                onClick={onInjectPoisonBurst}
              >
                <AlertOctagon className="w-3.5 h-3.5 mr-1 text-rose-500" />
                Trigger 5 Poison DLQ Tasks
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15"
                onClick={onHealAll}
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                Restore & Heal All Workers
              </Button>
            </div>

            {activeChaosProfile && (
              <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 font-mono">
                <ZapOff className="w-3.5 h-3.5" />
                <span>Active Chaos Profile: <strong>{activeChaosProfile}</strong></span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

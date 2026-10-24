import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Play,
  Pause,
  StepForward,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import {
  workflowSimulationEngine,
  type WorkflowSimulationStatus,
  type SimulationSpeed,
} from '@/features/workflows/sandbox/workflow-simulation-engine';
import {
  SIMULATION_SCENARIOS,
  type SimulationScenarioId,
} from '@/features/workflows/sandbox/simulation-scenarios';
import { cn } from '@/lib/utils';

export interface WorkflowSimulationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartSimulation: (executionId: string) => void;
}

export const WorkflowSimulationModal: React.FC<WorkflowSimulationModalProps> = ({
  open,
  onOpenChange,
  onStartSimulation,
}) => {
  const [status, setStatus] = useState<WorkflowSimulationStatus>(() =>
    workflowSimulationEngine.getStatus()
  );
  const [selectedScenario, setSelectedScenario] =
    useState<SimulationScenarioId>('HAPPY_PATH');
  const [selectedSpeed, setSelectedSpeed] = useState<SimulationSpeed>('2x');

  useEffect(() => {
    return workflowSimulationEngine.subscribeStatus((newStatus) => {
      setStatus(newStatus);
    });
  }, []);

  const handleLaunchSimulation = () => {
    const execId = workflowSimulationEngine.start(selectedScenario, selectedSpeed);
    onStartSimulation(execId);
  };

  const handlePauseResume = () => {
    if (status.isPaused) {
      workflowSimulationEngine.resume();
    } else {
      workflowSimulationEngine.pause();
    }
  };

  const handleStepNext = () => {
    workflowSimulationEngine.stepNext();
  };

  const handleReset = () => {
    workflowSimulationEngine.reset();
  };

  const getScenarioIcon = (id: SimulationScenarioId) => {
    switch (id) {
      case 'HAPPY_PATH':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'FRAUD_REJECTED':
        return <ShieldAlert className="w-4 h-4 text-rose-500" />;
      case 'PAYMENT_TIMEOUT':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'APPROVAL_ESCALATION':
        return <UserCheck className="w-4 h-4 text-sky-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-primary" />;
    }
  };

  const progressPercent =
    status.totalEvents > 0
      ? Math.round((status.currentEventIndex / status.totalEvents) * 100)
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl p-6 rounded-2xl backdrop-blur-2xl bg-white/95 dark:bg-slate-900/95 border border-white/20 dark:border-white/10 shadow-2xl flex flex-col gap-4 text-foreground"
        data-testid="workflow-simulation-modal"
      >
        <DialogHeader className="pb-2 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  Multi-Branch Live Execution Simulator
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    Unified Sandbox
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Simulate live execution traces with logic fork/join synchronization and real-time SSE telemetry.
                </DialogDescription>
              </div>
            </div>

            {status.isRunning && (
              <Badge
                variant="outline"
                className="text-[10px] bg-emerald-500/15 text-emerald-600 border-emerald-500/40 animate-pulse flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live Running ({progressPercent}%)
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* 1. Scenario Selector Grid */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold flex items-center justify-between">
            <span>Select Simulation Scenario</span>
            <span className="text-[11px] text-muted-foreground font-normal">
              {Object.keys(SIMULATION_SCENARIOS).length} pre-configured traces
            </span>
          </Label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.values(SIMULATION_SCENARIOS) as typeof SIMULATION_SCENARIOS[SimulationScenarioId][]).map(
              (scenario) => {
                const isSelected = selectedScenario === scenario.id;
                return (
                  <button
                    key={scenario.id}
                    type="button"
                    onClick={() => {
                      if (!status.isRunning) {
                        setSelectedScenario(scenario.id);
                      }
                    }}
                    disabled={status.isRunning}
                    data-testid={`scenario-option-${scenario.id}`}
                    className={cn(
                      'flex flex-col text-left p-3 rounded-xl border transition-all text-xs relative select-none',
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/30 font-medium'
                        : 'border-border/60 hover:border-border hover:bg-muted/40',
                      status.isRunning && !isSelected && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        {getScenarioIcon(scenario.id)}
                        <span>{scenario.name}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                        {scenario.badge}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {scenario.description}
                    </p>
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* 2. Speed and Cadence Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Playback Cadence</Label>
            <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border border-border/40">
              {(['1x', '2x', '5x', 'step'] as SimulationSpeed[]).map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => {
                    setSelectedSpeed(spd);
                    if (status.isRunning) {
                      workflowSimulationEngine.setSpeed(spd);
                    }
                  }}
                  data-testid={`speed-option-${spd}`}
                  className={cn(
                    'flex-1 py-1 text-xs rounded-md font-medium transition-all text-center',
                    selectedSpeed === spd
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {spd === 'step' ? 'Manual Step' : spd}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Simulation Telemetry Progress</Label>
            <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-border/30 text-xs flex flex-col justify-center">
              <div className="flex items-center justify-between mb-1 text-[11px] text-muted-foreground">
                <span>Event Stream Frame</span>
                <span className="font-mono font-medium text-foreground">
                  {status.currentEventIndex} / {status.totalEvents || 0}
                </span>
              </div>
              <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. Execution Control Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border/40">
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1 h-8"
              onClick={handleReset}
              disabled={!status.isRunning && status.currentEventIndex === 0}
              title="Reset simulation state and clear generated stream"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </Button>

            {status.isRunning && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1 h-8"
                  onClick={handlePauseResume}
                  title={status.isPaused ? 'Resume live simulation' : 'Pause simulation'}
                  data-testid="sim-pause-resume-btn"
                >
                  {status.isPaused ? <Play className="w-3 h-3 text-emerald-500" /> : <Pause className="w-3 h-3 text-amber-500" />}
                  <span>{status.isPaused ? 'Resume' : 'Pause'}</span>
                </Button>

                {(selectedSpeed === 'step' || status.isPaused) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1 h-8 bg-sky-500/10 text-sky-600 border-sky-500/30 hover:bg-sky-500/20"
                    onClick={handleStepNext}
                    data-testid="sim-step-next-btn"
                    title="Dispatch next simulated SSE event frame"
                  >
                    <StepForward className="w-3 h-3" />
                    <span>Next Event</span>
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-8"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>

            <Button
              size="sm"
              onClick={handleLaunchSimulation}
              className="text-xs gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md font-medium"
              data-testid="launch-simulation-btn"
            >
              <Play className="w-3 h-3" />
              <span>{status.isRunning ? 'Restart Simulation' : 'Start Simulation'}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

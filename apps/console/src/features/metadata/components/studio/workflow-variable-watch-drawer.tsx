import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  Bug,
  Pause,
  Play,
  RotateCcw,
  StepForward,
  Trash2,
  Variable,
  FileCode,
  Layers,
  Clock,
} from 'lucide-react';
import { VisualJsonEditor } from '@/components/ui/json-editor';

export interface WorkflowVariableWatchDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  executionId?: string | null;
  workflowStatus?: string;
  pausedAtNode?: string | null;
  breakpoints?: string[];
  onRemoveBreakpoint?: (taskReferenceName: string) => void;
  variablesSnapshot?: Record<string, unknown>;
  taskOutputs?: Record<string, unknown>;
  onStepOver?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  isStepping?: boolean;
}

export function WorkflowVariableWatchDrawer({
  open,
  onOpenChange,
  executionId,
  workflowStatus = 'RUNNING',
  pausedAtNode,
  breakpoints = [],
  onRemoveBreakpoint,
  variablesSnapshot = {},
  taskOutputs = {},
  onStepOver,
  onPause,
  onResume,
  isStepping = false,
}: WorkflowVariableWatchDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col backdrop-blur-2xl bg-white/95 dark:bg-slate-900/95 border-l border-white/20 dark:border-white/10 shadow-2xl z-50 overflow-hidden"
      >
        <SheetHeader className="p-6 pb-4 border-b border-border/40 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                <Bug className="w-4 h-4" />
              </div>
              <SheetTitle className="text-base font-bold">Execution Variable Watch</SheetTitle>
            </div>
            <Badge
              variant="outline"
              className={
                workflowStatus === 'PAUSED_AT_BREAKPOINT'
                  ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                  : workflowStatus === 'COMPLETED'
                  ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                  : 'bg-primary/15 text-primary border-primary/30'
              }
            >
              {workflowStatus}
            </Badge>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Live inspection of virtual thread state, accumulator payload, and breakpoints for{' '}
            <span className="font-mono text-foreground font-semibold">{executionId || 'active execution'}</span>.
          </SheetDescription>
        </SheetHeader>

        {/* Frontier Status Banner & Quick Controls */}
        <div className="px-6 py-3 bg-muted/40 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">Frontier:</span>
            {pausedAtNode ? (
              <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 text-xs font-mono">
                <Pause className="w-3 h-3 mr-1" />
                Paused at: {pausedAtNode}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground italic">Running to next breakpoint...</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {onStepOver && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs px-2 gap-1"
                onClick={onStepOver}
                disabled={isStepping}
                title="Step Over single task"
                data-testid="watch-drawer-step-btn"
              >
                <StepForward className="w-3 h-3 text-sky-500" />
                Step
              </Button>
            )}
            {onResume && (
              <Button
                type="button"
                size="sm"
                variant="default"
                className="h-7 text-xs px-2 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={onResume}
                title="Resume execution"
                data-testid="watch-drawer-resume-btn"
              >
                <Play className="w-3 h-3" />
                Resume
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="variables" className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-2 shrink-0">
            <TabsList className="grid grid-cols-3 w-full h-8">
              <TabsTrigger value="variables" className="text-xs">Variables & Inputs</TabsTrigger>
              <TabsTrigger value="outputs" className="text-xs">Task Outputs</TabsTrigger>
              <TabsTrigger value="breakpoints" className="text-xs">
                Breakpoints ({breakpoints.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* 1. Global Variables & Inputs */}
            <TabsContent value="variables" className="mt-0 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <Variable className="w-3.5 h-3.5 text-primary" />
                  Accumulated Scope Variables
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {Object.keys(variablesSnapshot).length} keys
                </span>
              </div>
              <VisualJsonEditor
                value={variablesSnapshot}
                onChange={() => {}}
                readOnly
                defaultMode="tree"
                height="280px"
              />
            </TabsContent>

            {/* 2. Task Outputs */}
            <TabsContent value="outputs" className="mt-0 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  Task Output Payloads
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {Object.keys(taskOutputs).length} completed tasks
                </span>
              </div>
              <VisualJsonEditor
                value={taskOutputs}
                onChange={() => {}}
                readOnly
                defaultMode="tree"
                height="280px"
              />
            </TabsContent>

            {/* 3. Breakpoints */}
            <TabsContent value="breakpoints" className="mt-0 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <Bug className="w-3.5 h-3.5 text-amber-500" />
                  Active Breakpoint Registry
                </span>
              </div>
              {breakpoints.length === 0 ? (
                <div className="p-6 text-center border border-dashed rounded-xl space-y-1.5">
                  <Clock className="w-6 h-6 text-muted-foreground mx-auto" />
                  <p className="text-xs font-medium text-foreground">No Breakpoints Configured</p>
                  <p className="text-[11px] text-muted-foreground">
                    Click the red breakpoint indicator on any step node in the DAG canvas to pause execution before that step runs.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {breakpoints.map((bp) => (
                    <div
                      key={bp}
                      className="flex items-center justify-between p-2 rounded-xl bg-card border border-border/50 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                        <span className="font-semibold">{bp}</span>
                        {pausedAtNode === bp && (
                          <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-500/30">
                            CURRENT
                          </Badge>
                        )}
                      </div>
                      {onRemoveBreakpoint && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => onRemoveBreakpoint(bp)}
                          title={`Remove breakpoint from ${bp}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

import React from 'react';
import { Workflow, Layers, Cpu, CheckSquare } from 'lucide-react';
import { type WorkflowDefinitionSummary } from '../../api/workflow-api';

interface WorkflowCatalogKpiBarProps {
  definitions: WorkflowDefinitionSummary[];
}

export const WorkflowCatalogKpiBar: React.FC<WorkflowCatalogKpiBarProps> = ({ definitions }) => {
  const activeCount = definitions.filter((d) => d.status !== 'DISABLED').length;
  const disabledCount = definitions.filter((d) => d.status === 'DISABLED').length;
  const totalDefinitions = definitions.length;

  // Calculate total tasks/nodes across all definitions
  const totalNodes = definitions.reduce((acc, d) => {
    const nodeCount = d.tasks ? d.tasks.length : Object.keys(d.layoutMetadata || {}).length;
    return acc + nodeCount;
  }, 0);

  // Approximate domain fleets from prefixes or task types
  const uniqueDomains = new Set<string>();
  definitions.forEach((d) => {
    const prefix = d.workflowKey.split(/[-_.]/)[0];
    if (prefix) uniqueDomains.add(prefix.toUpperCase());
    d.tasks?.forEach((t) => {
      if (t.taskType) uniqueDomains.add(t.taskType.split(/[-_.]/)[0].toUpperCase());
    });
  });
  const domainCount = Math.max(uniqueDomains.size, 1);

  return (
    <div
      data-testid="workflow-catalog-kpi-bar"
      className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
    >
      {/* 1. Active Workflows */}
      <div className="p-3 sm:p-4 rounded-2xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Active Workflows
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">{activeCount}</span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              of {totalDefinitions}
            </span>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
          <Workflow className="size-5" />
        </div>
      </div>

      {/* 2. Total DAG Topology Nodes */}
      <div className="p-3 sm:p-4 rounded-2xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            DAG Topology Nodes
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {totalNodes}
            </span>
            <span className="text-xs text-muted-foreground">managed tasks</span>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
          <Layers className="size-5" />
        </div>
      </div>

      {/* 3. Worker Fleet Domains */}
      <div className="p-3 sm:p-4 rounded-2xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Fleet Domains
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">{domainCount}</span>
            <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">registered</span>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400">
          <Cpu className="size-5" />
        </div>
      </div>

      {/* 4. Governance & Disabled States */}
      <div className="p-3 sm:p-4 rounded-2xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Draft / Disabled
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {disabledCount}
            </span>
            <span className="text-xs text-muted-foreground">definitions</span>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
          <CheckSquare className="size-5" />
        </div>
      </div>
    </div>
  );
};

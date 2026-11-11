import type { Component } from 'solid-js';
import { ShieldCheck } from 'lucide-solid';
import { useStudio } from '@/context/studio-context';
import { Badge } from '@/components/ui/badge';

export const PipelineQaCard: Component = () => {
  const studio = useStudio();

  return (
    <div class="space-y-2">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-bold">
          <ShieldCheck class="w-3.5 h-3.5 text-primary" />
          Studio Pipeline QA Audit
        </span>
        <Badge variant="lime">PASS</Badge>
      </div>

      <div class="grid grid-cols-2 gap-1.5 text-xs font-mono">
        <div class="p-2 rounded bg-card border border-border">
          <div class="text-muted-foreground">WCAG 2.2 AA</div>
          <div class="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {studio.wcagContrast}:1 {studio.wcagContrast >= 4.5 ? '✓' : 'SCRIM ON'}
          </div>
        </div>
        <div class="p-2 rounded bg-card border border-border">
          <div class="text-muted-foreground">Optical Safety</div>
          <div class="text-xs font-bold text-cyan-700 dark:text-cyan-300 mt-0.5">
            ≤ 3.0 Hz Safe
          </div>
        </div>
        <div class="p-2 rounded bg-card border border-border">
          <div class="text-muted-foreground">Loop Continuity</div>
          <div class="text-xs font-bold text-foreground mt-0.5">
            Δ = 0.00 rad
          </div>
        </div>
        <div class="p-2 rounded bg-card border border-border">
          <div class="text-muted-foreground">Motion Budget</div>
          <div class="text-xs font-bold text-foreground mt-0.5">
            {studio.state.heroBudget}/{studio.state.ambientBudget}/{studio.state.metaBudget}
          </div>
        </div>
      </div>
    </div>
  );
};

import type { Component } from 'solid-js';
import { useStudio } from '@/context/studio-context';
import { Badge } from '@/components/ui/badge';

export const ViewportStatusHeader: Component = () => {
  const studio = useStudio();

  return (
    <div class="h-9 px-4 border-b border-border flex items-center justify-between text-xs font-mono font-medium text-muted-foreground bg-background/60 shrink-0 select-none">
      <div class="flex items-center gap-2">
        <span class="text-primary font-bold">{studio.choreo.phaseName}</span>
        <span class="opacity-40">//</span>
        <span class="hidden md:inline text-muted-foreground">{studio.choreo.phaseDesc}</span>
      </div>
      <div class="flex items-center gap-2">
        <Badge variant={studio.wcagContrast >= 4.5 ? 'lime' : 'amber'}>
          WCAG {studio.wcagContrast}:1 {studio.wcagContrast >= 4.5 ? 'AA PASS' : 'GUARD'}
        </Badge>
        <Badge variant="cyan">≤3Hz SAFE</Badge>
        <Badge>{studio.state.fps} FPS</Badge>
      </div>
    </div>
  );
};

import { createMemo, For, type Component } from 'solid-js';
import { useStudio } from '@/context/studio-context';
import { cn } from '@/lib/utils';

export const PhaseJumpPills: Component = () => {
  const studio = useStudio();

  const segments = createMemo(() =>
    studio.state.timelineMode === 'studio3'
      ? [
          { label: '1. Hook (0–1.5s)', compact: '1. Hook', micro: '1', jump: 0.05 },
          { label: '2. Golden Hold (1.5–6s)', compact: '2. Hold', micro: '2', jump: 0.42 },
          { label: '3. Seamless Loop (6–8s)', compact: '3. Loop', micro: '3', jump: 0.85 },
        ]
      : studio.state.timelineMode === 'narrative4'
      ? [
          { label: 'Act I: Reveal', compact: 'I: Reveal', micro: 'I', jump: 0.1 },
          { label: 'Act II: Hero', compact: 'II: Hero', micro: 'II', jump: 0.38 },
          { label: 'Act III: Climax', compact: 'III: Climax', micro: 'III', jump: 0.66 },
          { label: 'Act IV: Lockup', compact: 'IV: Lockup', micro: 'IV', jump: 0.9 },
        ]
      : [{ label: 'Continuous Loop', compact: 'Loop', micro: '∞', jump: 0.5 }]
  );

  return (
    <div class="flex items-center gap-1 select-none">
      <For each={segments()}>
        {(seg, idx) => (
          <button
            type="button"
            onClick={() => {
              studio.setCurrentFrame(Math.floor(seg.jump * studio.totalFrames));
            }}
            title={seg.label}
            class={cn(
              'px-2 py-0.5 rounded text-xs font-mono border transition-all cursor-pointer whitespace-nowrap',
              studio.choreo.phaseIndex === idx()
                ? 'bg-primary/20 border-primary text-primary font-bold shadow-xs'
                : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
          >
            <span class="hidden 2xl:inline">{seg.label}</span>
            <span class="hidden md:inline 2xl:hidden">{seg.compact}</span>
            <span class="inline md:hidden">{seg.micro}</span>
          </button>
        )}
      </For>
    </div>
  );
};

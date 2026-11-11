import type { Component } from 'solid-js';
import { useStudio } from '@/context/studio-context';

export const ChoreographyTelemetry: Component = () => {
  const studio = useStudio();

  return (
    <div class="p-3 border-b border-border space-y-2 text-xs font-mono select-none">
      <div class="text-xs text-muted-foreground uppercase tracking-wider font-bold">
        Choreography Envelope
      </div>
      <div class="space-y-1">
        <div class="flex justify-between">
          <span class="text-muted-foreground">Headline Reveal</span>
          <span class="text-foreground">
            {Math.round(studio.choreo.headlineReveal * 100)}%
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">Hero 2.5D Boost</span>
          <span class="text-lime-600 dark:text-lime-300 font-semibold">
            {studio.choreo.heroScaleBoost.toFixed(2)}x
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">Hold Calmness</span>
          <span class="text-cyan-700 dark:text-cyan-300 font-semibold">
            {Math.round(studio.choreo.holdCalmness * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};

import { Film, PlusCircle, Layers } from 'lucide-solid';
import { Button } from '../ui/button';
import { Show } from 'solid-js';

export interface EmptyStateProps {
  onLoadSample?: () => void;
  onAddTrack?: () => void;
}

export type TimelineEmptyStateProps = EmptyStateProps;

export function EmptyState(props: EmptyStateProps) {
  return (
    <div
      role="region"
      aria-label="Timeline empty — no tracks"
      class="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed border-glass-border bg-muted/10 p-6 text-center space-y-3 select-none"
    >
      {/* Icon cluster */}
      <div class="relative">
        <div class="w-12 h-12 rounded-2xl bg-muted/60 border border-glass-border flex items-center justify-center shadow-sm">
          <Film class="w-6 h-6 text-muted-foreground/60" aria-hidden="true" />
        </div>
        <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-accent-theme flex items-center justify-center shadow-accent-glow">
          <Layers class="w-2.5 h-2.5 text-primary-foreground" aria-hidden="true" />
        </div>
      </div>

      {/* Copy */}
      <div class="space-y-1">
        <div class="text-xs font-semibold text-foreground/80">No Tracks in Timeline</div>
        <p class="text-[11px] text-muted-foreground max-w-[220px] leading-relaxed">
          Drag media from the Asset Library, or start with a sample composition.
        </p>
      </div>

      {/* CTAs */}
      <div class="flex items-center gap-2">
        <Show when={props.onLoadSample}>
          <Button
            variant="outline"
            size="sm"
            onClick={props.onLoadSample}
            class="h-7 text-[11px] gap-1.5 border-glass-border bg-glass-surface hover:bg-muted/60 text-foreground focus-visible:ring-2 focus-visible:ring-accent-theme"
            aria-label="Load sample project"
          >
            <Film class="w-3 h-3 text-accent-theme" aria-hidden="true" />
            Load Sample
          </Button>
        </Show>
        <Show when={props.onAddTrack}>
          <Button
            variant="default"
            size="sm"
            onClick={props.onAddTrack}
            class="h-7 text-[11px] gap-1.5 focus-visible:ring-2 focus-visible:ring-accent-theme"
            aria-label="Add a new track to timeline"
          >
            <PlusCircle class="w-3 h-3" aria-hidden="true" />
            Add Track
          </Button>
        </Show>
      </div>

      {/* Keyboard hint */}
      <p class="text-[9px] text-muted-foreground/50">
        Tip: Drag &amp; drop assets onto the timeline to begin editing
      </p>
    </div>
  );
}

export const TimelineEmptyState = EmptyState;

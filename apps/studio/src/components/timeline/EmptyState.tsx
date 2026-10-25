import React from 'react';
import { Film, PlusCircle, Layers } from 'lucide-react';
import { Button } from '../ui/button';

export interface EmptyStateProps {
  /** Called when user clicks "Load Sample Project" */
  onLoadSample?: () => void;
  /** Called when user clicks "Add Track" */
  onAddTrack?: () => void;
}

export type TimelineEmptyStateProps = EmptyStateProps;

/**
 * EmptyState — 5-State Component Matrix: Empty State.
 *
 * Renders when the timeline has zero tracks. Provides:
 * - Clear illustration icon with semantic colors
 * - Instructional copy explaining what to do
 * - Two primary CTAs: Load Sample Project + Add Track
 * - Keyboard shortcut hint
 * - WCAG 2.1 AA: focus-visible rings on all interactive elements
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  onLoadSample,
  onAddTrack,
}) => {
  return (
    <div
      role="region"
      aria-label="Timeline empty — no tracks"
      className="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed border-glass-border bg-muted/10 p-6 text-center space-y-3 select-none"
    >
      {/* Icon cluster */}
      <div className="relative">
        <div className="w-12 h-12 rounded-2xl bg-muted/60 border border-glass-border flex items-center justify-center shadow-sm">
          <Film className="w-6 h-6 text-muted-foreground/60" aria-hidden="true" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-accent-theme flex items-center justify-center shadow-accent-glow">
          <Layers className="w-2.5 h-2.5 text-primary-foreground" aria-hidden="true" />
        </div>
      </div>

      {/* Copy */}
      <div className="space-y-1">
        <div className="text-xs font-semibold text-foreground/80">No Tracks in Timeline</div>
        <p className="text-[11px] text-muted-foreground max-w-[220px] leading-relaxed">
          Drag media from the Asset Library, or start with a sample composition.
        </p>
      </div>

      {/* CTAs */}
      <div className="flex items-center gap-2">
        {onLoadSample && (
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadSample}
            className="h-7 text-[11px] gap-1.5 border-glass-border bg-glass-surface hover:bg-muted/60 text-foreground focus-visible:ring-2 focus-visible:ring-accent-theme"
            aria-label="Load sample project"
          >
            <Film className="w-3 h-3 text-accent-theme" aria-hidden="true" />
            Load Sample
          </Button>
        )}
        {onAddTrack && (
          <Button
            variant="default"
            size="sm"
            onClick={onAddTrack}
            className="h-7 text-[11px] gap-1.5 focus-visible:ring-2 focus-visible:ring-accent-theme"
            aria-label="Add a new track to timeline"
          >
            <PlusCircle className="w-3 h-3" aria-hidden="true" />
            Add Track
          </Button>
        )}
      </div>

      {/* Keyboard hint */}
      <p className="text-[9px] text-muted-foreground/50">
        Tip: Drag &amp; drop assets onto the timeline to begin editing
      </p>
    </div>
  );
};

// Backward-compatible alias
export const TimelineEmptyState = EmptyState;


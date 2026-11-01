import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';

export interface KeyframeAnchorProps {
  hasKeyframe?: boolean;
  hasAnimation?: boolean;
  disabled?: boolean;
  onToggleKeyframe?: () => void;
  onPrevKeyframe?: () => void;
  onNextKeyframe?: () => void;
  className?: string;
  propertyLabel?: string;
}

/**
 * KeyframeAnchor:
 * Studio-grade diamond keyframe indicator & navigator (Premiere/After Effects/Resolve).
 * - Hollow diamond: Keyframing enabled, but no keyframe on current frame.
 * - Solid accent diamond: Active keyframe on current frame.
 * - Prev/Next arrows: Quickly jump between temporal keyframes.
 */
export const KeyframeAnchor: React.FC<KeyframeAnchorProps> = ({
  hasKeyframe = false,
  hasAnimation = false,
  disabled = false,
  onToggleKeyframe,
  onPrevKeyframe,
  onNextKeyframe,
  className = '',
  propertyLabel = 'property',
}) => {
  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`}>
      {onPrevKeyframe && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || !hasAnimation}
          onClick={onPrevKeyframe}
          className="h-4 w-3.5 p-0 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          title={`Previous keyframe for ${propertyLabel}`}
          aria-label={`Jump to previous keyframe for ${propertyLabel}`}
        >
          <ChevronLeft className="w-2.5 h-2.5" />
        </Button>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={onToggleKeyframe}
        className={`h-4 w-4 flex items-center justify-center rounded transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-theme ${
          disabled
            ? 'opacity-30 cursor-not-allowed'
            : 'hover:bg-glass-surface cursor-pointer'
        }`}
        title={
          hasKeyframe
            ? `Remove keyframe at current frame for ${propertyLabel}`
            : `Add keyframe at current frame for ${propertyLabel}`
        }
        aria-label={`Toggle keyframe for ${propertyLabel}`}
        aria-pressed={hasKeyframe}
      >
        <svg
          viewBox="0 0 16 16"
          className={`w-2.5 h-2.5 transition-transform ${
            hasKeyframe
              ? 'text-accent-theme fill-current scale-110 drop-shadow-[0_0_4px_var(--accent-primary)]'
              : hasAnimation
              ? 'text-accent-theme/60 stroke-current fill-none stroke-[1.5]'
              : 'text-muted-foreground/60 stroke-current fill-none stroke-[1.5] hover:text-accent-theme/80'
          }`}
        >
          {/* 45-degree diamond */}
          <polygon points="8,1 15,8 8,15 1,8" />
        </svg>
      </button>

      {onNextKeyframe && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || !hasAnimation}
          onClick={onNextKeyframe}
          className="h-4 w-3.5 p-0 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          title={`Next keyframe for ${propertyLabel}`}
          aria-label={`Jump to next keyframe for ${propertyLabel}`}
        >
          <ChevronRight className="w-2.5 h-2.5" />
        </Button>
      )}
    </div>
  );
};

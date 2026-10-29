import React from 'react';
import { Diamond } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';

export interface KeyframeDiamondButtonProps {
  hasKeyframe: boolean;
  onToggleKeyframe: () => void;
  onPrevKeyframe?: () => void;
  onNextKeyframe?: () => void;
  disabled?: boolean;
}

export const KeyframeDiamondButton: React.FC<KeyframeDiamondButtonProps> = ({
  hasKeyframe,
  onToggleKeyframe,
  onPrevKeyframe,
  onNextKeyframe,
  disabled = false,
}) => {
  return (
    <div className="flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onToggleKeyframe();
            }}
            className={`p-1 rounded-sm transition-all cursor-pointer ${
              disabled
                ? 'opacity-30 cursor-not-allowed'
                : hasKeyframe
                ? 'text-accent-theme bg-accent-theme/15 hover:bg-accent-theme/25 shadow-accent-glow'
                : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <Diamond className={`w-3 h-3 ${hasKeyframe ? 'fill-current stroke-current' : 'stroke-[1.5]'}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {hasKeyframe ? 'Remove keyframe at current frame' : 'Add keyframe at current frame'}
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

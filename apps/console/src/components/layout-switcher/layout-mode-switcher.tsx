import React from 'react';
import { cn } from '@/lib/utils';
import { LayoutGrid, List, Columns } from 'lucide-react';

export type LayoutMode = 'grid' | 'table' | 'split';

export interface LayoutModeOption {
  id: LayoutMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

export const DEFAULT_LAYOUT_OPTIONS: LayoutModeOption[] = [
  {
    id: 'grid',
    label: 'Grid View',
    icon: LayoutGrid,
    description: 'Visual cards layout with icons and previews',
  },
  {
    id: 'table',
    label: 'Table View',
    icon: List,
    description: 'Dense tabular list for fast comparison',
  },
  {
    id: 'split',
    label: 'Split Inspector',
    icon: Columns,
    description: 'Master-detail split pane for instant live preview',
  },
];

interface LayoutModeSwitcherProps {
  value: LayoutMode;
  onChange: (mode: LayoutMode) => void;
  options?: LayoutModeOption[];
  className?: string;
  size?: 'sm' | 'default';
  ariaLabel?: string;
}

/**
 * LayoutModeSwitcher: Accessible, reusable Liquid Glass segmented control
 * for toggling view layouts (Grid, Table/Dense List, Split Inspector).
 * Implements WCAG 2.2 AA (role="radiogroup", roving tabindex, keyboard navigation).
 */
export const LayoutModeSwitcher: React.FC<LayoutModeSwitcherProps> = ({
  value,
  onChange,
  options = DEFAULT_LAYOUT_OPTIONS,
  className,
  size = 'sm',
  ariaLabel = 'View layout mode',
}) => {
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (index + 1) % options.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (index - 1 + options.length) % options.length;
    }

    if (nextIndex !== index) {
      const nextMode = options[nextIndex].id;
      onChange(nextMode);
      // Focus the newly active button
      const target = document.getElementById(`layout-mode-${nextMode}`);
      target?.focus();
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-0.5 p-0.5 rounded-lg border transition-colors',
        'bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-white/25 dark:border-white/10 shadow-xs',
        className
      )}
    >
      {options.map((opt, idx) => {
        const isSelected = value === opt.id;
        const IconComponent = opt.icon;

        return (
          <button
            key={opt.id}
            id={`layout-mode-${opt.id}`}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(opt.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            title={`${opt.label}${opt.description ? `: ${opt.description}` : ''}`}
            aria-label={opt.label}
            className={cn(
              'relative flex items-center justify-center rounded-md font-medium transition-all outline-none',
              'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
              size === 'sm' ? 'h-7 px-2 text-xs gap-1.5' : 'h-8 px-2.5 text-sm gap-2',
              isSelected
                ? 'bg-white dark:bg-slate-800 text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/40 dark:hover:bg-white/5'
            )}
          >
            <IconComponent
              className={cn(
                size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4',
                isSelected ? 'text-primary' : 'text-muted-foreground'
              )}
            />
            <span className="hidden sm:inline">{opt.label.replace(' View', '')}</span>
          </button>
        );
      })}
    </div>
  );
};

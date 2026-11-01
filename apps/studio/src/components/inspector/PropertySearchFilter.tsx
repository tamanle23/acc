import React from 'react';
import { Search, X } from 'lucide-react';
import { Badge } from '../ui/badge';

export interface PropertySearchFilterProps {
  query: string;
  onQueryChange: (nextQuery: string) => void;
  matchCount?: number;
  onClose?: () => void;
}

/**
 * PropertySearchFilter:
 * Real-time parameter filter bar mounted above inspector sections to quickly
 * locate properties (e.g. "blur", "opacity", "scale", "volume") across complex modifier pipelines.
 */
export const PropertySearchFilter: React.FC<PropertySearchFilterProps> = ({
  query,
  onQueryChange,
  matchCount,
  onClose,
}) => {
  return (
    <div className="px-3 py-1.5 border-b border-glass-border bg-glass-surface/30 flex items-center gap-2">
      <Search className="w-3.5 h-3.5 text-accent-theme shrink-0" />
      <input
        type="text"
        placeholder="Filter properties (e.g. blur, opacity, scale)..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        className="flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground outline-none font-sans"
        autoFocus
      />
      {matchCount !== undefined && query.trim() !== '' && (
        <Badge
          variant="outline"
          className="text-[9px] font-mono px-1 py-0 border-accent-theme/30 text-accent-theme bg-accent-theme/10"
        >
          {matchCount} match{matchCount === 1 ? '' : 'es'}
        </Badge>
      )}
      <button
        type="button"
        onClick={() => {
          onQueryChange('');
          if (onClose) onClose();
        }}
        className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        title="Clear filter"
        aria-label="Clear property filter"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

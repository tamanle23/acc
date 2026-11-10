import { Show } from 'solid-js';
import { Search, X } from 'lucide-solid';
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
export function PropertySearchFilter(props: PropertySearchFilterProps) {
  return (
    <div class="px-3 py-1.5 border-b border-glass-border bg-glass-surface/30 flex items-center gap-2">
      <Search class="w-3.5 h-3.5 text-accent-theme shrink-0" />
      <input
        type="text"
        placeholder="Filter properties (e.g. blur, opacity, scale)..."
        value={props.query}
        onInput={(e) => props.onQueryChange(e.currentTarget.value)}
        class="flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground outline-none font-sans"
        autofocus
      />
      <Show when={props.matchCount !== undefined && props.query.trim() !== ''}>
        <Badge
          variant="outline"
          class="text-[9px] font-mono px-1 py-0 border-accent-theme/30 text-accent-theme bg-accent-theme/10"
        >
          {props.matchCount} match{props.matchCount === 1 ? '' : 'es'}
        </Badge>
      </Show>
      <button
        type="button"
        onClick={() => {
          props.onQueryChange('');
          props.onClose?.();
        }}
        class="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        title="Clear filter"
        aria-label="Clear property filter"
      >
        <X class="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

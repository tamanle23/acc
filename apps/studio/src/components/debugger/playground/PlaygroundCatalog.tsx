import { createSignal, createMemo, For, Show } from 'solid-js';
import { Search, X, Layers, Sparkles, Film, Activity, Type, Square, Scissors, Volume2 } from 'lucide-solid';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { ModifierPluginRegistry, type ModifierPlugin } from '@acc/ir';
import type { PlaygroundEngine } from './usePlaygroundEngine';

export interface PlaygroundCatalogProps {
  engine: PlaygroundEngine;
  class?: string;
}

type CatalogCategory =
  | 'all'
  | 'vfx'
  | 'overlay'
  | 'time_space'
  | 'motion'
  | 'text'
  | 'shapes'
  | 'editorial'
  | 'audio';

interface PluginCardItem {
  type: string;
  name: string;
  category: CatalogCategory;
  categoryLabel: string;
  plugin: ModifierPlugin<any>;
}

export function PlaygroundCatalog(props: PlaygroundCatalogProps) {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [activeCategory, setActiveCategory] = createSignal<CatalogCategory>('all');

  const registry = ModifierPluginRegistry.getInstance();

  // Helper to categorize any plugin type
  const categorizeType = (type: string, plugin: ModifierPlugin<any>): { category: CatalogCategory; label: string } => {
    const pCat = plugin.schema?.category;
    if (pCat === 'vfx' || type.startsWith('vfx/')) return { category: 'vfx', label: 'VFX' };
    if (pCat === 'overlay' || type.startsWith('overlay/') || type.startsWith('generator/') || type.startsWith('timeline/')) {
      return { category: 'overlay', label: 'Overlays' };
    }
    if (pCat === 'time_space' || type.startsWith('time_space')) return { category: 'time_space', label: 'TimeSpace' };
    if (pCat === 'motion' || type.startsWith('motion/') || type === 'transform') return { category: 'motion', label: 'Motion' };
    if (pCat === 'text' || pCat === 'typography' || type.startsWith('text/') || type.startsWith('timed_text/')) {
      return { category: 'text', label: 'Text' };
    }
    if (pCat === 'shapes' || type.startsWith('shape/')) return { category: 'shapes', label: 'Shapes' };
    if (pCat === 'editorial' || type.startsWith('editorial/') || type.startsWith('transition/') || type === 'transition') {
      return { category: 'editorial', label: 'Editorial' };
    }
    if (pCat === 'audio' || pCat === 'sfx' || type.startsWith('audio/') || type.startsWith('sfx/')) {
      return { category: 'audio', label: 'Audio' };
    }
    return { category: 'vfx', label: 'VFX' };
  };

  // Build unified catalog items
  const allPluginItems = createMemo<PluginCardItem[]>(() => {
    const types = registry.listTypes();
    return types.map((type) => {
      const plugin = registry.get(type)!;
      const { category, label } = categorizeType(type, plugin);
      const name =
        plugin.schema?.displayName ||
        type
          .split('/')
          .pop()!
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
      return {
        type,
        name,
        category,
        categoryLabel: label,
        plugin,
      };
    });
  });

  // Category counts
  const categoryCounts = createMemo(() => {
    const counts: Record<string, number> = { all: allPluginItems().length };
    for (const item of allPluginItems()) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  });

  // Filtered plugin items
  const filteredPlugins = createMemo(() => {
    const q = searchQuery().trim().toLowerCase();
    const cat = activeCategory();

    return allPluginItems().filter((item) => {
      const matchesCategory = cat === 'all' || item.category === cat;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q)
      );
    });
  });

  const categories: Array<{ id: CatalogCategory; label: string; icon: any }> = [
    { id: 'all', label: 'All', icon: Layers },
    { id: 'vfx', label: 'VFX', icon: Sparkles },
    { id: 'overlay', label: 'Overlays', icon: Film },
    { id: 'time_space', label: 'TimeSpace', icon: Activity },
    { id: 'motion', label: 'Motion', icon: Activity },
    { id: 'text', label: 'Text', icon: Type },
    { id: 'shapes', label: 'Shapes', icon: Square },
    { id: 'editorial', label: 'Editorial', icon: Scissors },
    { id: 'audio', label: 'Audio', icon: Volume2 },
  ];

  return (
    <div
      class={`flex flex-col h-full w-full min-h-0 min-w-0 bg-background/70 border-r border-glass-border select-none ${
        props.class || ''
      }`}
    >
      {/* Search Header */}
      <div class="p-3 border-b border-glass-border flex flex-col gap-2 shrink-0 bg-glass-surface/40">
        <div class="relative">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Search 50+ IR modifiers..."
            class="pl-8 pr-7 h-8 text-xs font-mono bg-glass-surface/60 border-glass-border focus-visible:ring-accent-theme"
          />
          <Show when={searchQuery().length > 0}>
            <button
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
              onClick={() => setSearchQuery('')}
            >
              <X class="w-3 h-3" />
            </button>
          </Show>
        </div>

        {/* Category Filter Pills (Horizontal Scroll) */}
        <div class="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          <For each={categories}>
            {(cat) => {
              const count = () => categoryCounts()[cat.id] || 0;
              const isSelected = () => activeCategory() === cat.id;
              return (
                <button
                  type="button"
                  class={`px-2 py-1 rounded-md text-[11px] font-mono shrink-0 transition-all flex items-center gap-1 border ${
                    isSelected()
                      ? 'bg-accent-theme/20 text-accent-theme border-accent-theme/40 font-semibold shadow-xs'
                      : 'bg-glass-surface/40 text-muted-foreground border-transparent hover:text-foreground hover:bg-glass-surface/80'
                  }`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  <span>{cat.label}</span>
                  <span class="opacity-60 text-[10px]">({count()})</span>
                </button>
              );
            }}
          </For>
        </div>
      </div>

      {/* Plugin Cards List */}
      <div class="flex-1 min-h-0 overflow-y-auto p-2.5 flex flex-col gap-1.5 focus:outline-none">
        <Show
          when={filteredPlugins().length > 0}
          fallback={
            <div class="flex flex-col items-center justify-center p-8 text-center text-muted-foreground gap-2">
              <Layers class="w-8 h-8 opacity-30" />
              <p class="text-xs">No modifier plugins match your search</p>
              <Button
                variant="outline"
                size="sm"
                class="text-xs h-7 mt-1 border-glass-border"
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('all');
                }}
              >
                Reset Search
              </Button>
            </div>
          }
        >
          <For each={filteredPlugins()}>
            {(item) => {
              const isSelected = () => props.engine.state.selectedPluginType === item.type;
              return (
                <div
                  role="button"
                  tabIndex={0}
                  data-testid={`plugin-card-${item.type}`}
                  class={`group flex flex-col gap-1 p-2.5 rounded-xl cursor-pointer text-left transition-all border ${
                    isSelected()
                      ? 'bg-accent-theme/15 border-accent-theme/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]'
                      : 'bg-glass-surface/30 border-transparent hover:bg-glass-surface/60 hover:border-glass-border/60'
                  }`}
                  onClick={() => props.engine.selectPlugin(item.type)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      props.engine.selectPlugin(item.type);
                    }
                  }}
                >
                  <div class="flex items-center justify-between gap-1.5">
                    <span
                      class={`text-xs font-semibold truncate transition-colors ${
                        isSelected() ? 'text-accent-theme font-bold' : 'text-foreground'
                      }`}
                    >
                      {item.name}
                    </span>
                    <Badge
                      variant="outline"
                      class="font-mono text-[9px] px-1 py-0 uppercase border-glass-border text-muted-foreground shrink-0"
                    >
                      {item.categoryLabel}
                    </Badge>
                  </div>

                  <span class="font-mono text-[10px] text-muted-foreground/80 truncate">
                    {item.type}
                  </span>

                  <div class="flex items-center gap-1.5 mt-0.5">
                    <Show when={item.plugin.targetPhase}>
                      {(phase) => (
                        <span class="font-mono text-[9px] px-1 rounded bg-black/20 text-muted-foreground">
                          P{phase()}
                        </span>
                      )}
                    </Show>
                    <Show when={item.plugin.targetScope}>
                      {(scope) => (
                        <span class="font-mono text-[9px] px-1 rounded bg-black/20 text-muted-foreground">
                          {scope()}
                        </span>
                      )}
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </Show>
      </div>
    </div>
  );
}

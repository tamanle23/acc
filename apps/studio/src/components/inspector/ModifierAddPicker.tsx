import { createSignal, createMemo, createEffect, Show, For, type JSX } from 'solid-js';
import {
  Search,
  Check,
  Move,
  Sparkles,
  Film,
  Volume2,
  Type,
  FolderPlus,
  Layers,
  X,
} from 'lucide-solid';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
} from '../ui/popover';
import { Badge } from '../ui/badge';
import type { ModifierNode } from '@acc/ir';
import type {
  AvailableModifierDef,
  ModifierIconComponent,
} from './modifierCatalog';

export interface ModifierAddPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relevantModifiers: AvailableModifierDef[];
  activeEntityModifiers: ModifierNode[];
  isDisabled?: boolean;
  onSelectModifier: (mod: AvailableModifierDef) => void;
  children?: JSX.Element;
}

const CATEGORY_MAP: Record<string, { label: string; icon: any }> = {
  all: { label: 'All', icon: Layers },
  motion: { label: 'Motion', icon: Move },
  vfx: { label: 'VFX', icon: Sparkles },
  transitions: { label: 'Transitions', icon: Film },
  audio: { label: 'Audio', icon: Volume2 },
  text: { label: 'Typography', icon: Type },
  custom: { label: 'Custom', icon: FolderPlus },
};

/**
 * ModifierAddPicker:
 * Studio-grade searchable popover command palette for discovering and attaching
 * VideoIR modifiers and visual effects.
 */
export function ModifierAddPicker(props: ModifierAddPickerProps) {
  let searchInputRef: HTMLInputElement | undefined;
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedCategory, setSelectedCategory] = createSignal<string>('all');

  createEffect(() => {
    if (props.open) {
      setTimeout(() => {
        searchInputRef?.focus();
      }, 50);
    }
  });

  const filteredModifiers = createMemo(() => {
    const q = searchQuery().toLowerCase().trim();
    const selCat = selectedCategory();

    return props.relevantModifiers.filter((mod) => {
      // Category filter
      if (selCat !== 'all') {
        const cat = mod.category || 'custom';
        if (cat !== selCat) return false;
      }
      // Search query filter
      if (q) {
        const matchesName = mod.name.toLowerCase().includes(q);
        const matchesType = mod.type.toLowerCase().includes(q);
        const matchesCategory = (mod.category || '').toLowerCase().includes(q);
        if (!matchesName && !matchesType && !matchesCategory) return false;
      }
      return true;
    });
  });

  const handleSelect = (mod: AvailableModifierDef) => {
    props.onSelectModifier(mod);
    props.onOpenChange(false);
    setSearchQuery('');
  };

  return (
    <Popover open={props.open} onOpenChange={props.onOpenChange}>
      <Show
        when={props.children}
        fallback={<PopoverAnchor class="absolute top-10 right-3 w-1 h-1 pointer-events-none" />}
      >
        <PopoverTrigger asChild>{props.children}</PopoverTrigger>
      </Show>
      <PopoverContent
        align="end"
        sideOffset={6}
        class="w-80 p-0 glass-card bg-popover/95 backdrop-blur-md border border-glass-border shadow-2xl overflow-hidden z-50 flex flex-col max-h-[420px]"
      >
        {/* Search Input Bar */}
        <div class="p-2 border-b border-glass-border bg-glass-surface/50 flex items-center gap-2">
          <Search class="w-3.5 h-3.5 text-accent-theme shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search effects & modifiers..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none font-sans"
          />
          <Show when={searchQuery()}>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              class="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Clear search"
            >
              <X class="w-3 h-3" />
            </button>
          </Show>
        </div>

        {/* Category Pills */}
        <div class="flex items-center gap-1 p-1.5 border-b border-glass-border/40 overflow-x-auto scrollbar-none bg-muted/20">
          <For each={Object.entries(CATEGORY_MAP)}>
            {([key, cat]) => {
              const Icon = cat.icon;
              const isSelected = () => selectedCategory() === key;
              return (
                <button
                  type="button"
                  onClick={() => setSelectedCategory(key)}
                  class={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors shrink-0 cursor-pointer ${
                    isSelected()
                      ? 'bg-accent-theme text-primary-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-glass-surface'
                  }`}
                >
                  <Icon class="w-2.5 h-2.5" />
                  <span>{cat.label}</span>
                </button>
              );
            }}
          </For>
        </div>

        {/* Modifier List */}
        <div class="flex-1 overflow-y-auto p-1.5 space-y-1">
          <Show
            when={filteredModifiers().length > 0}
            fallback={
              <div class="py-8 text-center text-xs text-muted-foreground">
                No matching modifiers found.
              </div>
            }
          >
            <For each={filteredModifiers()}>
              {(mod) => {
                const isAttached = () => props.activeEntityModifiers.some((m) => m.type === mod.type);
                const Icon = mod.icon || Sparkles;
                const isActionDisabled = () => props.isDisabled || isAttached();

                return (
                  <div
                    onClick={() => !isActionDisabled() && handleSelect(mod)}
                    class={`flex items-center justify-between p-2 rounded-md transition-all text-xs ${
                      isAttached()
                        ? 'bg-accent-theme/10 border border-accent-theme/20 text-muted-foreground cursor-default'
                        : isActionDisabled()
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-glass-surface/80 hover:border-accent-theme/40 border border-transparent cursor-pointer text-foreground'
                    }`}
                  >
                    <div class="flex items-center gap-2 min-w-0">
                      <div class="w-6 h-6 rounded flex items-center justify-center bg-accent-theme/15 text-accent-theme shrink-0">
                        <Icon class="w-3.5 h-3.5" />
                      </div>
                      <div class="truncate">
                        <div class="font-semibold text-[11px] truncate">{mod.name}</div>
                        <div class="font-mono text-[9px] text-muted-foreground truncate">
                          {mod.type}
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center gap-1.5 shrink-0 pl-1">
                      <Show when={mod.targetScope === 'standalone'}>
                        <Badge
                          variant="outline"
                          class="font-mono text-[8px] uppercase border-purple-500/40 text-purple-400 bg-purple-500/10 px-1 py-0"
                        >
                          Gen
                        </Badge>
                      </Show>
                      <Show
                        when={isAttached()}
                        fallback={
                          <Badge
                            variant="secondary"
                            class="font-mono text-[8px] uppercase text-muted-foreground px-1 py-0"
                          >
                            {mod.category || 'fx'}
                          </Badge>
                        }
                      >
                        <div class="flex items-center gap-1 text-[10px] text-accent-theme font-mono">
                          <Check class="w-3 h-3 text-accent-theme" />
                          <span>Attached</span>
                        </div>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </Show>
        </div>
      </PopoverContent>
    </Popover>
  );
}

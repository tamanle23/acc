import {
  createSignal,
  createMemo,
  createEffect,
  onCleanup,
  For,
  Show,
  type Component,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { Search, X, Check, Sparkles } from 'lucide-solid';
import { useStudio } from '@/context/studio-context';
import { BRAND_ARCHETYPES } from '@/constants/archetypes';
import {
  ARCHETYPE_META,
  ARCHETYPE_FAMILY_TABS,
  type ArchetypeFamily,
} from '@/constants/archetype-categories';
import { cn } from '@/lib/utils';
import type { BrandArchetype } from '@/types/preset';

export interface ArchetypePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: HTMLElement;
}

export const ArchetypePopover: Component<ArchetypePopoverProps> = (props) => {
  const studio = useStudio();
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedFamily, setSelectedFamily] = createSignal<ArchetypeFamily>('all');
  let popoverRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  // Focus search input on open
  createEffect(() => {
    if (props.isOpen) {
      setTimeout(() => inputRef?.focus(), 50);
    } else {
      setSearchQuery('');
      setSelectedFamily('all');
    }
  });

  // Close on Escape or click outside
  createEffect(() => {
    if (!props.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        props.onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef && !popoverRef.contains(e.target as Node)) {
        props.onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    });
  });

  // Filtered archetypes
  const filteredArchetypes = createMemo(() => {
    const q = searchQuery().toLowerCase().trim();
    const family = selectedFamily();

    return BRAND_ARCHETYPES.filter((arch) => {
      const meta = ARCHETYPE_META[arch.id];
      const matchesFamily =
        family === 'all' || (meta && meta.family === family);
      const matchesSearch =
        q === '' ||
        arch.name.toLowerCase().includes(q) ||
        arch.id.toLowerCase().includes(q) ||
        (meta && meta.badge.toLowerCase().includes(q));

      return matchesFamily && matchesSearch;
    });
  });

  const handleSelect = (arch: BrandArchetype) => {
    studio.patchState({ archetypeId: arch.id, ...arch.patch });
    studio.triggerToast(`Archetype: ${arch.name}`);
    props.onClose();
  };

  return (
    <Show when={props.isOpen}>
      <Portal mount={typeof document !== 'undefined' ? document.body : undefined}>
        <div class="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/60 backdrop-blur-sm px-4">
          <div
            ref={popoverRef}
            role="dialog"
            aria-modal="true"
            aria-label="Brand Archetype Catalog"
            class="w-full max-w-2xl bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header Bar */}
            <div class="p-3 border-b border-border flex items-center justify-between gap-3 bg-muted/30">
              <div class="flex items-center gap-2">
                <Sparkles class="w-4 h-4 text-primary" />
                <h2 class="text-xs font-mono font-bold tracking-wider text-foreground uppercase">
                  Brand Archetype Vault ({BRAND_ARCHETYPES.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={props.onClose}
                aria-label="Close dialog"
                class="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-accent transition-colors"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            {/* Search & Filter Strip */}
            <div class="p-3 border-b border-border bg-popover flex flex-col gap-2.5">
              {/* Search Input */}
              <div class="relative">
                <Search class="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  placeholder="Search by archetype name, category, or shader..."
                  class="w-full pl-9 pr-8 py-1.5 bg-background border border-border rounded-md text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
                <Show when={searchQuery()}>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X class="w-3.5 h-3.5" />
                  </button>
                </Show>
              </div>

              {/* Family Tabs */}
              <div class="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                <For each={ARCHETYPE_FAMILY_TABS}>
                  {(tab) => {
                    const active = () => selectedFamily() === tab.id;
                    return (
                      <button
                        type="button"
                        onClick={() => setSelectedFamily(tab.id)}
                        class={cn(
                          'px-2.5 py-1 rounded text-xs font-mono whitespace-nowrap transition-all border cursor-pointer shrink-0',
                          active()
                            ? 'bg-primary/15 text-primary border-primary font-semibold'
                            : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-accent/50'
                        )}
                      >
                        {tab.label}
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>

            {/* Archetype Cards Grid */}
            <div class="flex-1 overflow-y-auto p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              <Show
                when={filteredArchetypes().length > 0}
                fallback={
                  <div class="col-span-full py-12 text-center text-muted-foreground font-mono text-xs">
                    No matching archetypes found for &ldquo;{searchQuery()}&rdquo;.
                  </div>
                }
              >
                <For each={filteredArchetypes()}>
                  {(arch) => {
                    const active = () => studio.state.archetypeId === arch.id;
                    const meta = ARCHETYPE_META[arch.id] || {
                      badge: 'STUDIO',
                      tagColor: arch.accent,
                    };

                    return (
                      <button
                        type="button"
                        onClick={() => handleSelect(arch)}
                        class={cn(
                          'p-2.5 rounded-lg border text-left transition-all relative flex flex-col justify-between gap-2 group cursor-pointer',
                          active()
                            ? 'bg-accent/30 border-primary ring-1 ring-primary/50 text-foreground'
                            : 'bg-card border-border hover:bg-accent/50 hover:border-border text-card-foreground'
                        )}
                      >
                        {/* Top Row: Swatch & Badge */}
                        <div class="flex items-center justify-between gap-1 w-full">
                          <div class="flex items-center gap-1.5 min-w-0">
                            <span
                              class="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                              style={{
                                'background-color': arch.accent,
                                'box-shadow': `0 0 8px ${arch.accent}66`,
                              }}
                            />
                            <span class="font-mono text-xs font-semibold text-foreground truncate">
                              {arch.name}
                            </span>
                          </div>
                          <Show
                            when={active()}
                            fallback={
                              <span class="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground group-hover:text-foreground">
                                {meta.badge}
                              </span>
                            }
                          >
                            <span class="flex items-center gap-1 text-xs font-mono font-bold text-primary shrink-0">
                              <Check class="w-3 h-3 stroke-[3]" />
                            </span>
                          </Show>
                        </div>

                        {/* Bottom Row: Micro Preview Specs */}
                        <div class="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-1 border-t border-border/60">
                          <span class="truncate">
                            {String(arch.patch.shaderId || 'shader')}
                          </span>
                          <span class="text-muted-foreground shrink-0">
                            {String(arch.patch.heroId || 'hero')}
                          </span>
                        </div>
                      </button>
                    );
                  }}
                </For>
              </Show>
            </div>

            {/* Footer Info */}
            <div class="p-2.5 border-t border-border bg-muted/30 flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>
                Active:{' '}
                <strong class="text-foreground">
                  {BRAND_ARCHETYPES.find((a) => a.id === studio.state.archetypeId)?.name}
                </strong>
              </span>
              <span class="text-muted-foreground">Press [ESC] to close</span>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
};

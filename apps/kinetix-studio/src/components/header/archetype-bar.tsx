import { createSignal, createEffect, onMount, onCleanup, Switch, Match, For, Show, Component } from 'solid-js';
import { ChevronLeft, ChevronRight, ChevronDown, Sparkles } from 'lucide-solid';
import { useStudio } from '@/context/studio-context';
import { BRAND_ARCHETYPES } from '@/constants/archetypes';
import { ARCHETYPE_META } from '@/constants/archetype-categories';
import { ArchetypePopover } from './archetype-popover';
import { cn } from '@/lib/utils';
import type { HeaderLodLevel } from '@/hooks/use-adaptive-lod';

export interface ArchetypeBarProps {
  lod?: HeaderLodLevel;
  class?: string;
  className?: string;
}

export const ArchetypeBar: Component<ArchetypeBarProps> = (props) => {
  const { state, patchState, triggerToast } = useStudio();
  let scrollContainerRef: HTMLDivElement | undefined;
  const [popoverOpen, setPopoverOpen] = createSignal(false);
  const [canScrollLeft, setCanScrollLeft] = createSignal(false);
  const [canScrollRight, setCanScrollRight] = createSignal(false);

  const activeArch = () =>
    BRAND_ARCHETYPES.find((a) => a.id === state.archetypeId) ||
    BRAND_ARCHETYPES[0];
  const activeMeta = () =>
    ARCHETYPE_META[activeArch().id] || {
      badge: 'STUDIO',
      tagColor: activeArch().accent,
    };

  const checkScroll = () => {
    if (!scrollContainerRef) return;
    setCanScrollLeft(scrollContainerRef.scrollLeft > 4);
    setCanScrollRight(
      scrollContainerRef.scrollLeft + scrollContainerRef.clientWidth <
        scrollContainerRef.scrollWidth - 4
    );
  };

  onMount(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    onCleanup(() => window.removeEventListener('resize', checkScroll));
  });

  createEffect(() => {
    // Tracking archetypeId and lod
    void state.archetypeId;
    void props.lod;
    if (!scrollContainerRef) return;
    const activeBtn = scrollContainerRef.querySelector(
      '[data-active="true"]'
    ) as HTMLElement | null;
    if (activeBtn) {
      activeBtn.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
    checkScroll();
  });

  const handleScroll = (dir: 'left' | 'right') => {
    if (!scrollContainerRef) return;
    const amount = dir === 'left' ? -220 : 220;
    scrollContainerRef.scrollBy({ left: amount, behavior: 'smooth' });
    setTimeout(checkScroll, 250);
  };

  const customClass = () => props.class || props.className || '';

  return (
    <Switch>
      {/* LOD 3: MINIMAL */}
      <Match when={(props.lod ?? 0) === 3}>
        <div class={cn('flex items-center min-w-0', customClass())}>
          <button
            type="button"
            onClick={() => setPopoverOpen(true)}
            title={`Active: ${activeArch().name} (${activeMeta().badge}) - Click to browse all 18 archetypes`}
            aria-haspopup="dialog"
            aria-expanded={popoverOpen()}
            class="h-7 px-2.5 rounded-md bg-card border border-border hover:border-primary/60 transition-all flex items-center gap-1.5 cursor-pointer max-w-[190px] group shadow-sm text-card-foreground"
          >
            <span
              class="w-2 h-2 rounded-full shrink-0 shadow-sm"
              style={{
                "background-color": activeArch().accent,
                "box-shadow": `0 0 6px ${activeArch().accent}99`,
              }}
            />
            <span class="font-mono text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {activeArch().name}
            </span>
            <span class="text-[11px] font-mono font-bold text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded shrink-0">
              {activeMeta().badge}
            </span>
            <ChevronDown class="w-3 h-3 text-muted-foreground shrink-0 group-hover:text-foreground transition-transform" />
          </button>

          <ArchetypePopover
            isOpen={popoverOpen()}
            onClose={() => setPopoverOpen(false)}
          />
        </div>
      </Match>

      {/* LOD 2: COMPACT */}
      <Match when={(props.lod ?? 0) === 2}>
        <div class={cn('flex items-center gap-2 min-w-0 flex-1', customClass())}>
          <button
            type="button"
            onClick={() => setPopoverOpen(true)}
            title={`Active: ${activeArch().name} - Open Archetype Vault`}
            class="h-7 px-2.5 rounded-md bg-card border border-primary/60 shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0 transition-all hover:bg-accent"
          >
            <span
              class="w-2 h-2 rounded-full shrink-0 animate-pulse"
              style={{
                "background-color": activeArch().accent,
                "box-shadow": `0 0 6px ${activeArch().accent}`,
              }}
            />
            <span class="font-mono text-xs font-bold text-foreground whitespace-nowrap">
              {activeArch().name}
            </span>
          </button>

          <div class="flex items-center gap-1 overflow-hidden min-w-0">
            <For each={BRAND_ARCHETYPES}>
              {(arch) => {
                const active = () => state.archetypeId === arch.id;
                const meta = ARCHETYPE_META[arch.id];
                return (
                  <button
                    type="button"
                    onClick={() => {
                      patchState({ archetypeId: arch.id, ...arch.patch });
                      triggerToast(`Archetype: ${arch.name}`);
                    }}
                    title={`${arch.name} (${meta?.badge || 'Archetype'})`}
                    class={cn(
                      'w-4 h-4 rounded-full transition-all shrink-0 cursor-pointer flex items-center justify-center border',
                      active()
                        ? 'scale-125 border-primary ring-2 ring-primary shadow-sm z-10'
                        : 'border-border hover:scale-125 hover:border-primary/50 opacity-60 hover:opacity-100'
                    )}
                    style={{ "background-color": arch.accent }}
                  />
                );
              }}
            </For>
          </div>

          <button
            type="button"
            onClick={() => setPopoverOpen(true)}
            title="Browse all 18 Brand Archetypes in Vault modal"
            class="h-7 px-2.5 rounded-md bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent/50 text-xs font-mono flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
          >
            <Sparkles class="w-3 h-3 text-primary" />
            <span>(18)</span>
            <ChevronDown class="w-3 h-3" />
          </button>

          <ArchetypePopover
            isOpen={popoverOpen()}
            onClose={() => setPopoverOpen(false)}
          />
        </div>
      </Match>

      {/* LOD 0 & 1: FULL & STANDARD */}
      <Match when={true}>
        <div class={cn('relative flex items-center min-w-0 flex-1 group/bar', customClass())}>
          <Show when={canScrollLeft()}>
            <button
              type="button"
              onClick={() => handleScroll('left')}
              aria-label="Scroll archetypes left"
              class="absolute left-0 z-20 h-7 w-6 bg-card/90 hover:bg-accent border border-border rounded-l flex items-center justify-center text-muted-foreground hover:text-foreground shadow-md backdrop-blur-sm transition-colors cursor-pointer"
            >
              <ChevronLeft class="w-3.5 h-3.5" />
            </button>
            <div class="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-card to-transparent pointer-events-none z-10" />
          </Show>

          <div
            ref={scrollContainerRef}
            onScroll={checkScroll}
            class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 scroll-smooth w-full px-1"
          >
            <For each={BRAND_ARCHETYPES}>
              {(arch) => {
                const active = () => state.archetypeId === arch.id;
                const meta = ARCHETYPE_META[arch.id] || {
                  badge: 'STUDIO',
                  tagColor: arch.accent,
                };
                const isFullLod = () => (props.lod ?? 0) === 0;

                return (
                  <button
                    type="button"
                    data-active={active()}
                    onClick={() => {
                      patchState({ archetypeId: arch.id, ...arch.patch });
                      triggerToast(`Archetype: ${arch.name}`);
                    }}
                    class={cn(
                      'h-7 px-2.5 rounded-md font-mono whitespace-nowrap transition-all flex items-center gap-1.5 border cursor-pointer shrink-0 select-none group',
                      isFullLod() ? 'text-xs' : 'text-xs',
                      active()
                        ? 'bg-primary/15 text-primary border-primary shadow-sm font-semibold ring-1 ring-primary/40'
                        : 'bg-card/60 text-muted-foreground border-border hover:bg-accent/50 hover:text-foreground'
                    )}
                  >
                    <span
                      class={cn(
                        'rounded-full shrink-0 transition-transform',
                        isFullLod() ? 'w-2 h-2' : 'w-1.5 h-1.5',
                        active() ? 'scale-110 shadow-sm' : 'group-hover:scale-110'
                      )}
                      style={{
                        "background-color": arch.accent,
                        "box-shadow": active() ? `0 0 8px ${arch.accent}` : undefined,
                      }}
                    />
                    <span>{arch.name}</span>
                    <Show when={isFullLod()}>
                      <span
                        class={cn(
                          'text-[11px] font-bold tracking-wider px-1.5 py-0.5 rounded transition-colors',
                          active()
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted text-muted-foreground group-hover:text-foreground'
                        )}
                      >
                        {meta.badge}
                      </span>
                    </Show>
                  </button>
                );
              }}
            </For>

            <button
              type="button"
              onClick={() => setPopoverOpen(true)}
              title="Open complete Brand Archetype Vault"
              class="h-7 px-2.5 rounded-md bg-card border border-border text-muted-foreground hover:text-primary hover:border-border text-xs font-mono flex items-center gap-1 shrink-0 cursor-pointer transition-colors ml-0.5"
            >
              <Sparkles class="w-3 h-3 text-primary" />
              <span>All (18)</span>
              <ChevronDown class="w-3 h-3" />
            </button>
          </div>

          <Show when={canScrollRight()}>
            <div class="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-card pointer-events-none z-10" />
            <button
              type="button"
              onClick={() => handleScroll('right')}
              aria-label="Scroll archetypes right"
              class="absolute right-0 z-20 h-7 w-6 bg-card/90 hover:bg-accent border border-border rounded-r flex items-center justify-center text-muted-foreground hover:text-foreground shadow-md backdrop-blur-sm transition-colors cursor-pointer"
            >
              <ChevronRight class="w-3.5 h-3.5" />
            </button>
          </Show>

          <ArchetypePopover
            isOpen={popoverOpen()}
            onClose={() => setPopoverOpen(false)}
          />
        </div>
      </Match>
    </Switch>
  );
};

import {
  createSignal,
  createMemo,
  onMount,
  onCleanup,
  For,
  Show,
  type Component,
} from 'solid-js';
import { Sun, Moon, Monitor, Check, Palette, ChevronDown } from 'lucide-solid';
import { useTheme } from '@/context/theme-context';
import { STUDIO_THEME_PRESETS } from '@/constants/theme-presets';
import { cn } from '@/lib/utils';

export interface ThemeSelectorProps {
  onOpenThemeModal?: () => void;
}

export const ThemeSelector: Component<ThemeSelectorProps> = (props) => {
  const theme = useTheme();

  const [isOpen, setIsOpen] = createSignal(false);
  const [filterMode, setFilterMode] = createSignal<'all' | 'dark' | 'light'>('all');
  let containerRef: HTMLDivElement | undefined;

  // Close on outside click or escape
  onMount(() => {
    const handleDown = (e: MouseEvent) => {
      if (containerRef && !containerRef.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleDown);
    window.addEventListener('keydown', handleKey);
    onCleanup(() => {
      document.removeEventListener('mousedown', handleDown);
      window.removeEventListener('keydown', handleKey);
    });
  });

  const allThemes = createMemo(() => [...STUDIO_THEME_PRESETS, ...theme.customThemes]);
  const displayedThemes = createMemo(() => {
    return allThemes().filter((t) => {
      if (filterMode() === 'all') return true;
      return t.mode === filterMode();
    });
  });

  return (
    <div ref={containerRef} class="relative shrink-0">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        class={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-mono transition-colors cursor-pointer',
          isOpen()
            ? 'bg-accent border-primary text-foreground'
            : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent/50'
        )}
        title={`Studio UI Theme: ${theme.activeTheme.name} (${theme.mode})`}
      >
        <Show
          when={theme.resolvedMode === 'dark'}
          fallback={<Sun class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />}
        >
          <Moon class="w-3.5 h-3.5 text-primary shrink-0" />
        </Show>

        <span class="hidden sm:inline-block max-w-[100px] truncate text-xs font-semibold text-foreground">
          {theme.activeTheme.name}
        </span>

        {/* 3-Dot Active Theme Color Preview */}
        <div class="flex items-center gap-0.5 ml-0.5">
          <div
            class="w-2 h-2 rounded-full border border-black/20"
            style={{ 'background-color': theme.activeTheme.tokens.background }}
          />
          <div
            class="w-2 h-2 rounded-full border border-black/20"
            style={{ 'background-color': theme.activeTheme.tokens.card }}
          />
          <div
            class="w-2 h-2 rounded-full border border-black/20"
            style={{ 'background-color': theme.activeTheme.tokens.primary }}
          />
        </div>

        <ChevronDown class="w-3 h-3 opacity-60 ml-0.5" />
      </button>

      {/* Dropdown Menu */}
      <Show when={isOpen()}>
        <div class="absolute right-0 top-full mt-1.5 w-76 bg-popover border border-border rounded-lg shadow-2xl p-2 z-50 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-100">
          {/* Header & Quick Mode Switch */}
          <div class="flex items-center justify-between pb-1.5 border-b border-border">
            <span class="text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold">
              Studio UI Theme
            </span>

            {/* Mode Switcher Segment (Dark / Light / System) */}
            <div class="flex items-center bg-muted p-0.5 rounded-md border border-border text-xs font-mono">
              <button
                type="button"
                onClick={() => theme.setMode('dark')}
                class={cn(
                  'px-1.5 py-0.5 rounded flex items-center gap-1 transition-all cursor-pointer',
                  theme.mode === 'dark'
                    ? 'bg-card text-primary font-bold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Force Dark Mode"
              >
                <Moon class="w-3 h-3" />
                <span>Dark</span>
              </button>

              <button
                type="button"
                onClick={() => theme.setMode('light')}
                class={cn(
                  'px-1.5 py-0.5 rounded flex items-center gap-1 transition-all cursor-pointer',
                  theme.mode === 'light'
                    ? 'bg-card text-amber-600 dark:text-amber-400 font-bold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Force Light Mode"
              >
                <Sun class="w-3 h-3" />
                <span>Light</span>
              </button>

              <button
                type="button"
                onClick={() => theme.setMode('system')}
                class={cn(
                  'px-1.5 py-0.5 rounded flex items-center gap-1 transition-all cursor-pointer',
                  theme.mode === 'system'
                    ? 'bg-card text-foreground font-bold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Sync with System OS Mode"
              >
                <Monitor class="w-3 h-3" />
                <span>Auto</span>
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div class="flex items-center gap-1 text-xs font-mono">
            <For each={['all', 'dark', 'light'] as const}>
              {(m) => (
                <button
                  type="button"
                  onClick={() => setFilterMode(m)}
                  class={cn(
                    'px-2 py-0.5 rounded border capitalize transition-all cursor-pointer',
                    filterMode() === m
                      ? 'bg-primary/15 border-primary text-primary font-bold'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {m === 'all' ? `All (${allThemes().length})` : m}
                </button>
              )}
            </For>
          </div>

          {/* Theme Presets List (Scrollable) */}
          <div class="max-h-56 overflow-y-auto space-y-1 pr-1 font-mono text-xs">
            <For each={displayedThemes()}>
              {(preset) => {
                const isActive = () => theme.activeThemeId === preset.id;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      theme.setThemePreset(preset.id);
                      setIsOpen(false);
                    }}
                    class={cn(
                      'w-full text-left px-2 py-1.5 rounded-md flex items-center justify-between gap-2 border transition-all cursor-pointer',
                      isActive()
                        ? 'bg-primary/10 border-primary text-foreground font-bold'
                        : 'bg-card/60 border-border/80 text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    )}
                  >
                    <div class="flex items-center gap-2 min-w-0">
                      {/* Swatch Preview Dots */}
                      <div class="flex items-center gap-0.5 shrink-0">
                        <div
                          class="w-2.5 h-2.5 rounded-full border border-black/30 shadow-sm"
                          style={{ 'background-color': preset.tokens.background }}
                        />
                        <div
                          class="w-2.5 h-2.5 rounded-full border border-black/30 shadow-sm"
                          style={{ 'background-color': preset.tokens.card }}
                        />
                        <div
                          class="w-2.5 h-2.5 rounded-full border border-black/30 shadow-sm"
                          style={{ 'background-color': preset.tokens.primary }}
                        />
                      </div>

                      <div class="flex flex-col truncate">
                        <span class="text-xs font-medium truncate flex items-center gap-1.5">
                          {preset.name}
                          <Show when={preset.isCustom}>
                            <span class="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold">
                              Custom
                            </span>
                          </Show>
                        </span>
                        <span class="text-[11px] text-muted-foreground uppercase font-mono">
                          {preset.mode} // {preset.category}
                        </span>
                      </div>
                    </div>

                    <Show when={isActive()}>
                      <Check class="w-3.5 h-3.5 text-primary shrink-0" />
                    </Show>
                  </button>
                );
              }}
            </For>
          </div>

          {/* Footer Jump to Full Theme Manager Modal */}
          <Show when={props.onOpenThemeModal}>
            <div class="pt-1.5 border-t border-border flex items-center justify-between text-xs font-mono">
              <span class="text-muted-foreground">Custom themes & colors</span>
              <button
                type="button"
                onClick={() => {
                  props.onOpenThemeModal?.();
                  setIsOpen(false);
                }}
                class="text-primary hover:underline flex items-center gap-1 cursor-pointer font-bold"
              >
                <Palette class="w-3 h-3" />
                <span>Customize Themes...</span>
              </button>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

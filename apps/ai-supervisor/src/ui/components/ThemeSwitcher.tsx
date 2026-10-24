import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { Palette, Check, Sun, Moon } from "lucide-solid";
import type { createThemeStore, ThemePreset } from "../stores/themeStore";

interface ThemeSwitcherProps {
  themeStore: ReturnType<typeof createThemeStore>;
}

export function ThemeSwitcher(props: ThemeSwitcherProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;

  const current = () => props.themeStore.currentTheme();

  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));
  });

  return (
    <div class="relative" ref={containerRef} data-testid="theme-switcher">
      <button
        onClick={() => setIsOpen(!isOpen())}
        title={`Current Theme: ${current().name}`}
        class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-all cursor-pointer shadow-xs"
        aria-label="Open Theme Presets"
        aria-expanded={isOpen()}
        data-testid="theme-switcher-button"
      >
        <span
          class="w-3.5 h-3.5 rounded-full border border-black/30 shadow-xs shrink-0"
          style={{ "background-color": current().primaryColor }}
        />
        <span class="inline-block whitespace-nowrap text-[var(--text-primary)]">
          {current().name}
        </span>
        <Palette class="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
      </button>

      <Show when={isOpen()}>
        <div
          class="absolute right-0 mt-2 w-64 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 backdrop-blur-md"
          data-testid="theme-dropdown"
        >
          <div class="px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between border-b border-[var(--border-subtle)] mb-1">
            <span>Theme Presets</span>
            <span class="text-[10px] font-normal">{props.themeStore.presets.length} options</span>
          </div>

          <div class="space-y-1 max-h-72 overflow-y-auto py-1">
            <For each={props.themeStore.presets}>
              {(preset: ThemePreset) => {
                const isSelected = () => props.themeStore.activeThemeId() === preset.id;
                return (
                  <button
                    onClick={() => {
                      props.themeStore.setTheme(preset.id);
                      setIsOpen(false);
                    }}
                    class={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                      isSelected()
                        ? "bg-[var(--accent-subtle)] text-[var(--text-primary)] font-semibold border border-[var(--accent-primary)]/40 shadow-xs"
                        : "text-[var(--text-primary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <div class="flex items-center gap-2.5">
                      <div class="flex items-center -space-x-1">
                        <span
                          class="w-3.5 h-3.5 rounded-full border border-black/30 shadow-xs"
                          style={{ "background-color": preset.primaryColor }}
                        />
                        <span
                          class="w-3.5 h-3.5 rounded-full border border-black/30 shadow-xs"
                          style={{ "background-color": preset.accentColor }}
                        />
                      </div>
                      <span class="text-left">{preset.name}</span>
                    </div>

                    <div class="flex items-center gap-1.5 text-[var(--text-muted)]">
                      {preset.category === "dark" ? (
                        <Moon class="w-3 h-3 text-[var(--text-muted)]" />
                      ) : (
                        <Sun class="w-3 h-3 text-amber-500" />
                      )}
                      <Show when={isSelected()}>
                        <Check class="w-3.5 h-3.5 text-[var(--accent-primary)] font-bold" />
                      </Show>
                    </div>
                  </button>
                );
              }}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}

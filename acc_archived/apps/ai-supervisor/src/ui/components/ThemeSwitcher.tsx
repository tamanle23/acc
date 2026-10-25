import { For, Show } from "solid-js";
import { Menu } from "@ark-ui/solid";
import { Palette, Check, Sun, Moon } from "lucide-solid";
import type { createThemeStore, ThemePreset } from "../stores/themeStore";

interface ThemeSwitcherProps {
  themeStore: ReturnType<typeof createThemeStore>;
}

export function ThemeSwitcher(props: ThemeSwitcherProps) {
  const current = () => props.themeStore.currentTheme();

  return (
    <Menu.Root
      positioning={{ placement: "bottom-end", gutter: 8 }}
      onSelect={(details) => {
        if (details.value) {
          props.themeStore.setTheme(details.value as any);
        }
      }}
    >
      <Menu.Trigger
        title={`Current Theme: ${current().name}`}
        class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-all cursor-pointer shadow-xs focus-visible:outline-none focus-visible:border-[var(--border-focus)]"
        aria-label="Open Theme Presets"
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
      </Menu.Trigger>

      <Menu.Positioner class="z-50">
        <Menu.Content
          class="w-64 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] p-2 shadow-2xl animate-in fade-in zoom-in-95 backdrop-blur-md outline-none"
          style={{
            "box-shadow": "var(--card-shadow)",
            "backdrop-filter": "var(--surface-backdrop)",
            "-webkit-backdrop-filter": "var(--surface-backdrop)",
          }}
          data-testid="theme-dropdown"
        >
          <div class="px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between border-b border-[var(--border-subtle)] mb-1">
            <span>Theme Presets</span>
            <span class="text-[10px] font-normal">{props.themeStore.presets.length} options</span>
          </div>

          <Menu.ItemGroup class="space-y-1 max-h-72 overflow-y-auto py-1">
            <For each={props.themeStore.presets}>
              {(preset: ThemePreset) => {
                const isSelected = () => props.themeStore.activeThemeId() === preset.id;
                return (
                  <Menu.Item
                    value={preset.id}
                    class={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer outline-none ${
                      isSelected()
                        ? "bg-[var(--accent-subtle)] text-[var(--text-primary)] font-semibold border border-[var(--accent-primary)]/40 shadow-xs"
                        : "text-[var(--text-primary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] focus:bg-[var(--bg-surface)]"
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
                  </Menu.Item>
                );
              }}
            </For>
          </Menu.ItemGroup>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
}

import { createSignal, createMemo, Show, For, Component } from 'solid-js';
import {
  Sun,
  Moon,
  Monitor,
  Check,
  Palette,
  Plus,
  Trash2,
  Copy,
  Upload,
  Sparkles,
} from 'lucide-solid';
import { useTheme } from '@/context/theme-context';
import { useStudio } from '@/context/studio-context';
import type { StudioThemeTokens, ThemeCategory } from '@/types/theme';
import { cn } from '@/lib/utils';

export interface ThemeManagerDeckProps {
  class?: string;
  className?: string;
  inModal?: boolean;
}

export const ThemeManagerDeck: Component<ThemeManagerDeckProps> = (props) => {
  const theme = useTheme();
  const { triggerToast } = useStudio();

  // Filter state
  const [selectedCategory, setSelectedCategory] = createSignal<
    'all' | 'dark' | 'light' | 'custom' | ThemeCategory
  >('all');

  // Custom Theme Builder State
  const [builderOpen, setBuilderOpen] = createSignal(false);
  const [draftName, setDraftName] = createSignal('My Custom Theme');
  const [draftTokens, setDraftTokens] = createSignal<StudioThemeTokens>({
    ...theme.activeTheme.tokens,
  });

  const handleOpenBuilderWithCurrent = () => {
    setDraftTokens({ ...theme.activeTheme.tokens });
    setDraftName(`${theme.activeTheme.name} (Custom)`);
    setBuilderOpen(true);
  };

  const handleUpdateDraftToken = (key: keyof StudioThemeTokens, value: string) => {
    setDraftTokens((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveCustom = () => {
    const name = draftName().trim();
    if (!name) {
      triggerToast('Please provide a name for your custom theme');
      return;
    }
    const created = theme.saveCustomTheme(name, draftTokens());
    triggerToast(`Saved Custom Theme: "${created.name}"`);
    setBuilderOpen(false);
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(draftTokens(), null, 2));
      triggerToast('Copied Theme JSON to clipboard');
    } catch {
      triggerToast('Failed to copy to clipboard');
    }
  };

  const handleImportJson = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (typeof parsed === 'object' && parsed.background && parsed.primary) {
          setDraftTokens((prev) => ({ ...prev, ...parsed }));
          triggerToast('Imported Theme JSON into builder');
        } else {
          triggerToast('Invalid theme JSON structure');
        }
      } catch {
        triggerToast('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
    target.value = '';
  };

  // Filtered preset list
  const filteredPresets = createMemo(() => {
    const cat = selectedCategory();
    return theme.allPresets.filter((p) => {
      if (cat === 'all') return true;
      if (cat === 'dark') return p.mode === 'dark';
      if (cat === 'light') return p.mode === 'light';
      if (cat === 'custom') return p.isCustom;
      return p.category === cat;
    });
  });

  const customClass = () => props.class || props.className || '';

  return (
    <div
      class={cn(
        'p-3 rounded-lg border border-border bg-card/60 space-y-3.5',
        props.inModal && 'border-none bg-transparent p-0',
        customClass()
      )}
    >
      {/* 1. Header with Mode Controls */}
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Palette class="w-4 h-4 text-primary shrink-0" />
          <span class="text-xs font-mono font-bold tracking-wider uppercase text-foreground">
            Studio UI Theme Manager
          </span>
        </div>

        {/* Mode Selector Segment */}
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
            title="Force Dark UI Mode"
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
            title="Force Light UI Mode"
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

      {/* 2. Active Theme Banner */}
      <div class="p-2 rounded border border-border bg-background flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          {/* Swatch Mini Preview Bar */}
          <div class="flex items-center gap-1 shrink-0 p-1 rounded bg-card border border-border">
            <div
              class="w-3.5 h-3.5 rounded-sm border border-black/20"
              style={{ "background-color": theme.activeTheme.tokens.background }}
              title={`Background: ${theme.activeTheme.tokens.background}`}
            />
            <div
              class="w-3.5 h-3.5 rounded-sm border border-black/20"
              style={{ "background-color": theme.activeTheme.tokens.card }}
              title={`Card: ${theme.activeTheme.tokens.card}`}
            />
            <div
              class="w-3.5 h-3.5 rounded-sm border border-black/20"
              style={{ "background-color": theme.activeTheme.tokens.border }}
              title={`Border: ${theme.activeTheme.tokens.border}`}
            />
            <div
              class="w-3.5 h-3.5 rounded-sm border border-black/20"
              style={{ "background-color": theme.activeTheme.tokens.foreground }}
              title={`Foreground Text: ${theme.activeTheme.tokens.foreground}`}
            />
            <div
              class="w-3.5 h-3.5 rounded-sm border border-black/20 shadow-sm"
              style={{ "background-color": theme.activeTheme.tokens.primary }}
              title={`Primary Accent: ${theme.activeTheme.tokens.primary}`}
            />
          </div>

          <div class="flex flex-col min-w-0">
            <span class="text-xs font-mono font-bold text-foreground truncate">
              {theme.activeTheme.name}
            </span>
            <span class="text-xs font-mono text-muted-foreground truncate">
              {theme.activeTheme.description}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenBuilderWithCurrent}
          class="px-2 py-1 rounded border border-border bg-card text-xs font-mono hover:border-primary hover:text-primary transition-all cursor-pointer shrink-0 flex items-center gap-1"
          title="Clone and edit this theme in the Custom Builder"
        >
          <Sparkles class="w-3 h-3" />
          <span>Tune Theme</span>
        </button>
      </div>

      {/* 3. Category Filter Chips */}
      <div class="flex items-center gap-1 overflow-x-auto pb-1 text-xs font-mono">
        <For
          each={[
            ['all', `All (${theme.allPresets.length})`],
            ['dark', `Dark (10)`],
            ['light', `Light (10)`],
            ['custom', `Custom (${theme.customThemes.length})`],
            ['modern', 'Modern'],
            ['tech', 'Tech'],
            ['minimal', 'Minimal'],
            ['editorial', 'Editorial'],
            ['vibrant', 'Vibrant'],
          ] as const}
        >
          {([catId, label]) => {
            const isSelected = () => selectedCategory() === catId;
            return (
              <button
                type="button"
                onClick={() => setSelectedCategory(catId)}
                class={cn(
                  'px-2 py-0.5 rounded border whitespace-nowrap transition-all cursor-pointer',
                  isSelected()
                    ? 'bg-primary/15 border-primary text-primary font-bold'
                    : 'bg-background border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            );
          }}
        </For>
      </div>

      {/* 4. Grid of 20 Curated Theme Swatch Cards */}
      <div
        class={cn(
          'grid gap-2 max-h-64 overflow-y-auto pr-1',
          props.inModal
            ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 max-h-[46vh]'
            : 'grid-cols-2'
        )}
      >
        <For each={filteredPresets()}>
          {(preset) => {
            const isActive = () => theme.activeThemeId === preset.id;
            return (
              <div
                onClick={() => theme.setThemePreset(preset.id)}
                class={cn(
                  'p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 relative group select-none',
                  isActive()
                    ? 'bg-primary/10 border-primary ring-1 ring-primary shadow-sm'
                    : 'bg-background/80 border-border hover:border-muted-foreground/50 hover:bg-card'
                )}
              >
                {/* Top: Name & Badges */}
                <div class="flex items-start justify-between gap-1">
                  <div class="flex flex-col min-w-0">
                    <span class="text-xs font-mono font-bold text-foreground truncate flex items-center gap-1">
                      {preset.name}
                    </span>
                    <span class="text-[11px] font-mono text-muted-foreground uppercase font-medium">
                      {preset.mode} // {preset.category}
                    </span>
                  </div>

                  <Show
                    when={isActive()}
                    fallback={
                      <Show when={preset.isCustom}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            theme.deleteCustomTheme(preset.id);
                            triggerToast(`Deleted custom theme "${preset.name}"`);
                          }}
                          class="opacity-0 group-hover:opacity-100 p-0.5 rounded text-destructive hover:bg-destructive/10 transition-opacity cursor-pointer"
                          title="Delete Custom Theme"
                        >
                          <Trash2 class="w-3 h-3" />
                        </button>
                      </Show>
                    }
                  >
                    <div class="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Check class="w-2.5 h-2.5 text-primary-foreground stroke-[3]" />
                    </div>
                  </Show>
                </div>

                {/* Bottom: 5-Stripe Color Swatch Bar */}
                <div class="h-3.5 w-full rounded flex overflow-hidden border border-border shadow-inner">
                  <div
                    class="flex-1"
                    style={{ "background-color": preset.tokens.background }}
                    title={`Background: ${preset.tokens.background}`}
                  />
                  <div
                    class="flex-1"
                    style={{ "background-color": preset.tokens.card }}
                    title={`Card: ${preset.tokens.card}`}
                  />
                  <div
                    class="flex-1"
                    style={{ "background-color": preset.tokens.border }}
                    title={`Border: ${preset.tokens.border}`}
                  />
                  <div
                    class="flex-1"
                    style={{ "background-color": preset.tokens.foreground }}
                    title={`Text: ${preset.tokens.foreground}`}
                  />
                  <div
                    class="flex-1"
                    style={{ "background-color": preset.tokens.primary }}
                    title={`Primary Accent: ${preset.tokens.primary}`}
                  />
                </div>
              </div>
            );
          }}
        </For>
      </div>

      {/* 5. Custom Theme Builder Accordion */}
      <div class="pt-2 border-t border-border">
        <Show
          when={builderOpen()}
          fallback={
            <button
              type="button"
              onClick={() => setBuilderOpen(true)}
              class="w-full py-1.5 px-2 rounded-md border border-dashed border-border text-xs font-mono text-muted-foreground hover:text-foreground hover:border-primary flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-card/40"
            >
              <Plus class="w-3.5 h-3.5 text-primary" />
              <span>Open Custom Theme Builder</span>
            </button>
          }
        >
          <div class="p-3 rounded-lg border border-primary/50 bg-background space-y-3 animate-in fade-in zoom-in-98 duration-150">
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles class="w-3.5 h-3.5 text-primary" />
                Custom Theme Builder
              </span>
              <button
                type="button"
                onClick={() => setBuilderOpen(false)}
                class="text-xs font-mono text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Theme Name Input */}
            <div>
              <label class="text-xs font-mono text-muted-foreground uppercase block mb-1">
                Custom Theme Name
              </label>
              <input
                type="text"
                value={draftName()}
                onInput={(e) => setDraftName(e.currentTarget.value)}
                placeholder="e.g. Cyberpunk Magenta"
                class="w-full px-2 py-1 rounded bg-card border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            {/* Token Pickers Grid */}
            <div class="grid grid-cols-2 gap-2 text-xs font-mono">
              <For
                each={[
                  { key: 'background', label: 'Background' },
                  { key: 'card', label: 'Card / Surface' },
                  { key: 'border', label: 'Border / Outline' },
                  { key: 'foreground', label: 'Text / Heading' },
                  { key: 'primary', label: 'Primary Accent' },
                  { key: 'muted', label: 'Muted Neutral' },
                  { key: 'accent', label: 'Accent Hover' },
                  { key: 'destructive', label: 'Destructive' },
                ]}
              >
                {({ key, label }) => {
                  const colorVal = () =>
                    draftTokens()[key as keyof StudioThemeTokens];
                  return (
                    <div class="p-1.5 rounded border border-border bg-card/60 flex items-center justify-between gap-1.5">
                      <div class="flex flex-col min-w-0">
                        <span class="text-xs text-muted-foreground truncate">
                          {label}
                        </span>
                        <span class="text-xs font-bold text-foreground">
                          {colorVal()}
                        </span>
                      </div>

                      <input
                        type="color"
                        value={colorVal()}
                        onChange={(e) =>
                          handleUpdateDraftToken(
                            key as keyof StudioThemeTokens,
                            e.currentTarget.value
                          )
                        }
                        class="w-6 h-6 rounded border border-border bg-transparent cursor-pointer p-0"
                      />
                    </div>
                  );
                }}
              </For>
            </div>

            {/* Live Component Preview Card */}
            <div
              class="p-2.5 rounded-lg border text-xs font-mono space-y-1.5"
              style={{
                "background-color": draftTokens().card,
                "border-color": draftTokens().border,
                color: draftTokens().foreground,
              }}
            >
              <div class="flex items-center justify-between text-xs opacity-80">
                <span>UI PREVIEW</span>
                <span style={{ color: draftTokens().primary }}>● LIVE</span>
              </div>
              <div class="font-bold">Card Component Headline</div>
              <div class="text-xs opacity-80">
                This simulates buttons and surfaces using your custom tokens.
              </div>
              <div class="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  style={{
                    "background-color": draftTokens().primary,
                    color: draftTokens().primaryForeground || '#000000',
                  }}
                  class="px-2 py-0.5 rounded text-xs font-bold"
                >
                  Primary Action
                </button>
                <button
                  type="button"
                  style={{
                    "background-color": draftTokens().secondary,
                    color: draftTokens().foreground,
                    "border-color": draftTokens().border,
                  }}
                  class="px-2 py-0.5 rounded border text-xs"
                >
                  Secondary
                </button>
              </div>
            </div>

            {/* Action Buttons: Save, Copy JSON, Import */}
            <div class="flex items-center justify-between gap-2 pt-1 border-t border-border">
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  class="p-1.5 rounded border border-border bg-card text-muted-foreground hover:text-foreground text-xs font-mono cursor-pointer flex items-center gap-1"
                  title="Copy Theme JSON"
                >
                  <Copy class="w-3 h-3" />
                  <span class="hidden sm:inline">JSON</span>
                </button>

                <label
                  class="p-1.5 rounded border border-border bg-card text-muted-foreground hover:text-foreground text-xs font-mono cursor-pointer flex items-center gap-1"
                  title="Import Theme JSON"
                >
                  <Upload class="w-3 h-3" />
                  <span class="hidden sm:inline">Import</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJson}
                    class="hidden"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleSaveCustom}
                class="px-3 py-1 rounded bg-primary text-primary-foreground font-mono font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1"
              >
                <Check class="w-3.5 h-3.5" />
                <span>Save Theme</span>
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};

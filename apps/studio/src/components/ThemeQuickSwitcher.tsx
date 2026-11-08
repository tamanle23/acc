import { createSignal, createMemo, For } from 'solid-js';
import { Palette, Check, Search, Sliders, Sun, Moon } from 'lucide-solid';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from './ui/popover';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { Input } from './ui/input';
import {
  useTheme,
  STUDIO_THEME_PRESETS,
  type ThemePresetCategory,
} from '../lib/theme';

export function ThemeQuickSwitcher() {
  const theme = useTheme();
  const [isOpen, setIsOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedCategory, setSelectedCategory] = createSignal<ThemePresetCategory | 'all'>('all');

  const filteredPresets = createMemo(() => {
    return STUDIO_THEME_PRESETS.filter((p) => {
      const matchesCategory =
        selectedCategory() === 'all' || p.category === selectedCategory();
      const q = searchQuery().toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  });

  const categories: Array<{ id: ThemePresetCategory | 'all'; label: string }> = [
    { id: 'all', label: 'All (20)' },
    { id: 'dark', label: 'Dark' },
    { id: 'light', label: 'Light' },
    { id: 'cyber', label: 'Cyber' },
    { id: 'creative', label: 'Creative' },
    { id: 'minimal', label: 'Minimal' },
  ];

  return (
    <Popover open={isOpen()} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger>
          <PopoverTrigger>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Switch Theme Preset"
              class="h-8 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-glass-border rounded-lg transition-all"
            >
              <div
                class="w-3.5 h-3.5 rounded-full border border-glass-border flex items-center justify-center shrink-0 shadow-2xs"
                style={{
                  background: theme.activePreset.preview.primary,
                  "box-shadow": `0 0 8px ${theme.activePreset.preview.primary}55`,
                }}
              >
                <Palette class="w-2.5 h-2.5 text-black/70 mix-blend-overlay" />
              </div>
              <span class="hidden xl:inline font-medium text-[11px] truncate max-w-[90px]">
                {theme.activePreset.name}
              </span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Quick Theme Switcher (20 Presets)</TooltipContent>
      </Tooltip>

      <PopoverContent
        class="w-[360px] p-3 glass-panel bg-glass-surface border-glass-border shadow-glass rounded-2xl flex flex-col gap-2.5 z-50"
      >
        {/* Header */}
        <div class="flex items-center justify-between border-b border-glass-border pb-2">
          <div class="flex items-center gap-2">
            <Palette class="w-4 h-4 text-accent-theme" />
            <span class="text-xs font-bold text-foreground tracking-wide">
              Theme Presets
            </span>
          </div>
          <Badge
            variant="outline"
            class="font-mono text-[10px] px-1.5 py-0.5 border-accent-theme/40 text-accent-theme bg-accent-theme/10"
          >
            {theme.activePreset.name}
          </Badge>
        </div>

        {/* Live Search */}
        <div class="relative">
          <Search class="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={searchQuery()}
            onInput={(e: any) => setSearchQuery(e.target.value)}
            placeholder="Search themes (e.g. tokyo, oled, nord)..."
            class="h-7 text-xs pl-8 bg-muted/30 border-glass-border rounded-lg"
          />
        </div>

        {/* Category Filter Pills */}
        <div class="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          <For each={categories}>
            {(cat) => (
              <button
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                class={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all shrink-0 cursor-pointer ${
                  selectedCategory() === cat.id
                    ? 'bg-accent-theme text-primary-foreground font-semibold shadow-accent-glow'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                {cat.label}
              </button>
            )}
          </For>
        </div>

        {/* 2-Column Preset Grid */}
        <div
          role="listbox"
          aria-label="Theme presets"
          class="grid grid-cols-2 gap-1.5 max-h-[260px] overflow-y-auto pr-1 select-none"
        >
          <For each={filteredPresets()}>
            {(preset) => {
              const isSelected = () => preset.id === (theme.preferences.presetId || 'obsidian');
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected()}
                  onClick={() => {
                    theme.selectPreset(preset.id);
                  }}
                  class={`flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer border ${
                    isSelected()
                      ? 'border-accent-theme bg-accent-theme/15 shadow-accent-glow text-foreground'
                      : 'border-glass-border/60 hover:border-accent-theme/50 hover:bg-muted/30 text-foreground/80'
                  }`}
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <div
                      class="w-5 h-5 rounded-md border border-white/20 shadow-2xs shrink-0 flex items-center justify-center relative overflow-hidden"
                      style={{ "background-color": preset.preview.bg }}
                    >
                      <div
                        class="absolute inset-x-0 bottom-0 h-2"
                        style={{ "background-color": preset.preview.primary }}
                      />
                      {preset.mode === 'light' ? (
                        <Sun class="w-2.5 h-2.5 text-amber-500 absolute top-0.5" />
                      ) : (
                        <Moon class="w-2.5 h-2.5 text-white/70 absolute top-0.5" />
                      )}
                    </div>

                    <div class="truncate">
                      <div class="text-[11px] font-semibold leading-tight truncate">
                        {preset.name}
                      </div>
                      <div class="text-[9px] text-muted-foreground capitalize leading-tight">
                        {preset.category}
                      </div>
                    </div>
                  </div>

                  {isSelected() && (
                    <Check class="w-3.5 h-3.5 text-accent-theme shrink-0 ml-1" />
                  )}
                </button>
              );
            }}
          </For>
        </div>

        {/* Footer Link to Full Settings */}
        <div class="pt-2 border-t border-glass-border flex items-center justify-between">
          <span class="text-[10px] text-muted-foreground">
            {filteredPresets().length} of 20 Presets
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsOpen(false);
              theme.setIsSettingsOpen(true);
            }}
            class="h-6 text-[10px] gap-1 px-2 text-accent-theme hover:bg-accent-theme/10"
          >
            <Sliders class="w-3 h-3" />
            Glass & Gallery Settings
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

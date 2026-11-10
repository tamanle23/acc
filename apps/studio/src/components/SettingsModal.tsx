import { createSignal, createMemo, For, Show } from 'solid-js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import {
  useTheme,
  STUDIO_THEME_PRESETS,
  type ThemeMode,
  type GlassStyle,
  type BlurIntensity,
  type ThemePresetCategory,
  type StudioThemePreset,
} from '../lib/theme';
import {
  Sliders,
  Sun,
  Moon,
  Sparkles,
  RefreshCw,
  Layers,
  Check,
  HardDrive,
  Trash2,
  Search,
  Palette,
} from 'lucide-solid';
import { toast } from './ui/sonner';
import { ContentCacheRegistry, CacheNamespace } from '@acc/core-isomorphic';
import { clearWaveSurferPeakCache } from './timeline/WaveSurferWaveform';
import { OpfsExplorerModal } from './debugger/opfs/OpfsExplorerModal';

const GLASS_STYLES: { id: GlassStyle; label: string; desc: string }[] = [
  { id: 'specular', label: 'Specular Sheen', desc: 'Sharpened top-edge highlight with rim reflection' },
  { id: 'frosted', label: 'Frosted Matte', desc: 'Soft diffused surface with zero specular distraction' },
  { id: 'cyber', label: 'Cyber Glow', desc: 'Vibrant edge emission tuned for futuristic interfaces' },
];

const BLUR_INTENSITIES: { id: BlurIntensity; label: string; px: string }[] = [
  { id: 'low', label: 'Low', px: '6px' },
  { id: 'medium', label: 'Medium', px: '18px' },
  { id: 'high', label: 'High', px: '40px' },
];

export function SettingsModal() {
  const theme = useTheme();
  const [isOpfsOpen, setIsOpfsOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedCategory, setSelectedCategory] = createSignal<ThemePresetCategory | 'all'>('all');

  const categories: Array<{ id: ThemePresetCategory | 'all'; label: string }> = [
    { id: 'all', label: 'All (20)' },
    { id: 'dark', label: 'Dark' },
    { id: 'light', label: 'Light' },
    { id: 'cyber', label: 'Cyber' },
    { id: 'creative', label: 'Creative' },
    { id: 'minimal', label: 'Minimal' },
  ];

  const filteredPresets = createMemo(() => {
    const cat = selectedCategory();
    const q = searchQuery().toLowerCase().trim();
    return STUDIO_THEME_PRESETS.filter((p) => {
      const matchesCategory = cat === 'all' || p.category === cat;
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  });

  const currentPresetId = () => theme.preferences.presetId || 'obsidian';

  return (
    <Dialog open={theme.isSettingsOpen} onOpenChange={theme.setIsSettingsOpen}>
      <DialogContent class="sm:max-w-3xl max-w-2xl max-h-[88vh] overflow-y-auto glass-panel bg-glass-surface text-foreground border-glass-border border-t-glass-border-highlight p-6 rounded-2xl shadow-glass">
        <DialogHeader class="pb-3 border-b border-glass-border">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="h-8 w-8 rounded-lg glass-badge-accent flex items-center justify-center">
                <Sliders class="w-4 h-4" />
              </div>
              <div>
                <DialogTitle class="text-base font-semibold text-foreground flex items-center gap-2">
                  Studio Theme & Optical Glass Settings
                  <Badge variant="secondary" class="font-mono text-[10px] glass-badge-accent">
                    20 Presets Live
                  </Badge>
                </DialogTitle>
                <DialogDescription class="text-xs text-muted-foreground">
                  Switch between 20 curated themes and customize decoupled optical glass refraction in real-time.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div class="space-y-6 py-4 text-xs">
          {/* 1. Theme Presets Gallery (20 Iconic Presets) */}
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="font-semibold text-foreground/90 tracking-wide uppercase text-[11px] flex items-center gap-1.5">
                <Palette class="w-3.5 h-3.5 text-accent-theme" />
                Theme Presets ({STUDIO_THEME_PRESETS.length} Curated)
              </label>
              <div class="flex items-center gap-2">
                <div class="flex items-center gap-1 p-0.5 rounded-lg border border-glass-border bg-black/20">
                  <button
                    type="button"
                    onClick={() => theme.toggleMode()}
                    aria-pressed={theme.preferences.mode === 'dark'}
                    aria-label="Dark Mode"
                    class={`px-2 py-0.5 rounded-md text-[10px] font-mono flex items-center gap-1 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-theme ${
                      theme.preferences.mode === 'dark'
                        ? 'bg-accent-theme/20 text-accent-theme font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Moon class="w-2.5 h-2.5" /> Dark
                  </button>
                  <button
                    type="button"
                    onClick={() => theme.toggleMode()}
                    aria-pressed={theme.preferences.mode === 'light'}
                    aria-label="Light Mode"
                    class={`px-2 py-0.5 rounded-md text-[10px] font-mono flex items-center gap-1 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-theme ${
                      theme.preferences.mode === 'light'
                        ? 'bg-accent-theme/20 text-accent-theme font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Sun class="w-2.5 h-2.5" /> Light
                  </button>
                </div>
                <Badge variant="outline" class="font-mono text-[10px] border-accent-theme/40 text-accent-theme bg-accent-theme/10">
                  Active: {theme.activePreset.name}
                </Badge>
              </div>
            </div>

            {/* Filter Pills & Search Bar */}
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 justify-between">
              <div class="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                <For each={categories}>
                  {(cat) => (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      class={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all shrink-0 cursor-pointer ${
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

              <div class="relative w-full sm:w-56 shrink-0">
                <Search class="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  value={searchQuery()}
                  onInput={(e: InputEvent & { currentTarget: HTMLInputElement }) => setSearchQuery(e.currentTarget.value)}
                  placeholder="Filter 20 themes..."
                  class="h-7 text-xs pl-8 bg-muted/30 border-glass-border rounded-lg"
                />
              </div>
            </div>

            {/* Visual Swatch Cards Grid */}
            <div
              role="listbox"
              aria-label="Studio theme presets"
              class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[300px] overflow-y-auto pr-1"
            >
              <For each={filteredPresets()}>
                {(preset) => {
                  const isSelected = () => preset.id === currentPresetId();
                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected()}
                      onClick={() => theme.selectPreset(preset.id)}
                      class={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        isSelected()
                          ? 'border-accent-theme bg-accent-theme/15 shadow-accent-glow'
                          : 'border-glass-border/70 hover:border-accent-theme/50 hover:bg-muted/30'
                      }`}
                    >
                      <div class="flex items-center justify-between w-full mb-2">
                        <div class="flex items-center gap-1.5 min-w-0">
                          <span class="font-semibold text-foreground text-xs truncate">
                            {preset.name}
                          </span>
                          <span class="text-[9px] text-muted-foreground capitalize font-mono">
                            • {preset.category}
                          </span>
                        </div>
                        <Show
                          when={isSelected()}
                          fallback={
                            <Show
                              when={preset.mode === 'light'}
                              fallback={<Moon class="w-3 h-3 text-muted-foreground shrink-0 opacity-70" />}
                            >
                              <Sun class="w-3 h-3 text-amber-500 shrink-0 opacity-70" />
                            </Show>
                          }
                        >
                          <Check class="w-3.5 h-3.5 text-accent-theme shrink-0 ml-1" />
                        </Show>
                      </div>

                      <p class="text-[10px] text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
                        {preset.description}
                      </p>

                      {/* 4-Color Swatch Strip */}
                      <div class="flex items-center gap-1.5 h-4 w-full rounded-md p-1 border border-glass-border bg-black/20 overflow-hidden">
                        <div
                          class="flex-1 h-full rounded-xs shadow-2xs"
                          style={{ "background-color": preset.preview.bg }}
                          title="Background"
                        />
                        <div
                          class="flex-1 h-full rounded-xs shadow-2xs"
                          style={{ "background-color": preset.preview.surface }}
                          title="Surface / Card"
                        />
                        <div
                          class="flex-1 h-full rounded-xs shadow-2xs"
                          style={{ "background-color": preset.preview.primary }}
                          title="Primary Brand"
                        />
                        <div
                          class="flex-1 h-full rounded-xs shadow-2xs"
                          style={{ "background-color": preset.preview.accent }}
                          title="Accent Glow"
                        />
                      </div>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>

          <div class="border-t border-glass-border pt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 2. Decoupled Optical Glass Finish */}
            <div class="space-y-2">
              <label class="font-semibold text-foreground/90 tracking-wide uppercase text-[11px] flex items-center gap-1.5">
                <Layers class="w-3.5 h-3.5 text-accent-theme" />
                Optical Glass Finish (Decoupled)
              </label>
              <div class="grid grid-cols-3 gap-1.5">
                <For each={GLASS_STYLES}>
                  {(style) => {
                    const isStyleActive = () => theme.preferences.glassStyle === style.id;
                    return (
                      <button
                        type="button"
                        onClick={() => theme.setTheme({ glassStyle: style.id })}
                        aria-pressed={isStyleActive()}
                        data-active={isStyleActive()}
                        class="glass-pill p-2 rounded-lg text-left flex flex-col justify-between cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-theme focus-visible:outline-hidden"
                      >
                        <div class="font-semibold text-foreground text-[11px] flex items-center justify-between mb-0.5">
                          <span>{style.label}</span>
                          <Show when={isStyleActive()}>
                            <Check class="w-3 h-3 text-accent-theme" />
                          </Show>
                        </div>
                        <p class="text-[9px] text-muted-foreground line-clamp-2 leading-tight">
                          {style.desc}
                        </p>
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>

            {/* 3. Acrylic Blur Intensity */}
            <div class="space-y-2">
              <label class="font-semibold text-foreground/90 tracking-wide uppercase text-[11px] flex items-center gap-1.5">
                <Sparkles class="w-3.5 h-3.5 text-accent-theme" />
                Acrylic Blur Intensity
              </label>
              <div class="grid grid-cols-3 gap-1.5">
                <For each={BLUR_INTENSITIES}>
                  {(blur) => {
                    const isBlurActive = () => theme.preferences.blurIntensity === blur.id;
                    return (
                      <button
                        type="button"
                        onClick={() => theme.setTheme({ blurIntensity: blur.id })}
                        aria-pressed={isBlurActive()}
                        data-active={isBlurActive()}
                        class="glass-pill py-2 px-2.5 rounded-lg text-center flex flex-col items-center justify-center cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-theme focus-visible:outline-hidden"
                      >
                        <span class="font-semibold text-foreground capitalize text-xs">
                          {blur.label}
                        </span>
                        <span class="text-[10px] text-muted-foreground font-mono">
                          {blur.px}
                        </span>
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>

            {/* Live Material & Optical Finish Specimen */}
            <div class="col-span-1 md:col-span-2 p-3.5 rounded-xl border border-glass-border relative overflow-hidden bg-black/20">
              <div class="absolute inset-0 liquid-ambient-mesh opacity-80 pointer-events-none" />
              <div class="relative z-10 flex items-center justify-between mb-2">
                <span class="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles class="w-3 h-3 text-accent-theme" />
                  Live Material Specimen (Physics Parity)
                </span>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent-theme/15 text-accent-theme border border-accent-theme/30 capitalize">
                  {theme.preferences.glassStyle} • {theme.preferences.blurIntensity} ({theme.preferences.blurIntensity === 'low' ? '6px' : theme.preferences.blurIntensity === 'high' ? '40px' : '18px'})
                </span>
              </div>
              <div class="relative z-10 p-3.5 rounded-xl glass-panel shadow-glass flex items-center justify-between transition-all duration-200">
                <div class="flex items-center gap-3">
                  <div
                    class="w-8 h-8 rounded-lg flex items-center justify-center border border-accent-theme/40 shadow-accent-glow"
                    style={{ background: 'color-mix(in srgb, var(--accent-primary) 20%, transparent)' }}
                  >
                    <Layers class="w-4 h-4 text-accent-theme" />
                  </div>
                  <div>
                    <div class="text-xs font-semibold text-foreground flex items-center gap-2">
                      <span>
                        {theme.preferences.glassStyle === 'specular' && 'Specular Sheen Active'}
                        {theme.preferences.glassStyle === 'frosted' && 'Frosted Matte Active'}
                        {theme.preferences.glassStyle === 'cyber' && 'Cyber Glow Emission Active'}
                      </span>
                      <span class="text-[10px] font-normal text-muted-foreground capitalize">
                        • {theme.activePreset.name} Palette
                      </span>
                    </div>
                    <div class="text-[10px] text-muted-foreground mt-0.5">
                      {theme.preferences.glassStyle === 'specular' &&
                        'Sharpened rim reflection with high-refraction specular highlight.'}
                      {theme.preferences.glassStyle === 'frosted' &&
                        'Diffused matte refraction with zero specular sheen and subtle soft shadow.'}
                      {theme.preferences.glassStyle === 'cyber' &&
                        'High-tech neon perimeter lighting and accent chromatic shadow emission.'}
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <div class="w-2.5 h-2.5 rounded-full bg-accent-theme shadow-accent-glow animate-pulse" />
                  <span class="text-[10px] font-mono font-semibold text-accent-theme uppercase">
                    ACTIVE
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Cache & Storage Maintenance */}
          <div class="space-y-2 border-t border-glass-border pt-4">
            <label class="font-semibold text-foreground/90 tracking-wide uppercase text-[11px] flex items-center gap-1.5">
              <HardDrive class="w-3.5 h-3.5 text-accent-theme" />
              Cache & Storage Maintenance
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div class="glass-card p-3 rounded-lg flex items-center justify-between border border-glass-border">
                <div>
                  <div class="font-semibold text-foreground text-xs">OPFS Storage Explorer</div>
                  <div class="text-[10px] text-muted-foreground">
                    Inspect Origin Private File System cache folders
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOpfsOpen(true)}
                  class="h-7 text-[11px] gap-1 px-2.5 border-glass-border"
                >
                  <HardDrive class="w-3 h-3 text-accent-theme" />
                  Inspect OPFS
                </Button>
              </div>

              <div class="glass-card p-3 rounded-lg flex items-center justify-between border border-glass-border">
                <div>
                  <div class="font-semibold text-foreground text-xs">Purge Waveform LRU</div>
                  <div class="text-[10px] text-muted-foreground">
                    Clear in-memory audio peaks cache
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    clearWaveSurferPeakCache();
                    try {
                      const cache = ContentCacheRegistry.namespace(CacheNamespace.Assets);
                      await cache.clear();
                    } catch { }
                    toast.success('Cache cleared successfully');
                  }}
                  class="h-7 text-[11px] gap-1 px-2.5 border-glass-border hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 class="w-3 h-3" />
                  Purge Cache
                </Button>
              </div>
            </div>
          </div>

          {/* Live Material Inspection Preview */}
          <div class="pt-2">
            <label class="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider block mb-1.5">
              Live Material Inspection
            </label>
            <div class="glass-card p-3.5 rounded-xl relative overflow-hidden flex items-center justify-between border border-[var(--glass-border)]">
              <div>
                <div class="font-semibold text-foreground text-xs">
                  {theme.activePreset.name} ({theme.preferences.mode.toUpperCase()})
                </div>
                <div class="text-[11px] text-muted-foreground font-mono mt-0.5">
                  preset: {theme.activePreset.name} • glass: {theme.preferences.glassStyle} • blur: {theme.preferences.blurIntensity}
                </div>
              </div>
              <button
                type="button"
                class="glass-button text-xs px-3 py-1 rounded-lg text-foreground font-medium cursor-pointer"
              >
                Sample Action
              </button>
            </div>
          </div>
        </div>

        <DialogFooter class="pt-3 border-t border-[var(--glass-border)] flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={theme.resetTheme}
            class="text-xs gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <RefreshCw class="w-3.5 h-3.5" />
            Reset Defaults
          </Button>
          <Button
            variant="accent"
            size="sm"
            onClick={() => theme.setIsSettingsOpen(false)}
            class="px-5 cursor-pointer"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
      <OpfsExplorerModal open={isOpfsOpen()} onOpenChange={setIsOpfsOpen} />
    </Dialog>
  );
}

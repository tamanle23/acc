import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Badge,
  Input,
} from './ui';
import {
  useTheme,
  STUDIO_THEME_PRESETS,
  type ThemeMode,
  type GlassStyle,
  type BlurIntensity,
  type AccentColor,
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
} from 'lucide-react';
import { toast } from 'sonner';
import { ContentCacheRegistry, CacheNamespace } from '@acc/core-isomorphic';
import { clearWaveSurferPeakCache } from './timeline/WaveSurferWaveform';
import { OpfsDebuggerModal } from './debugger/opfs/OpfsDebuggerModal';

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

const ACCENT_COLORS: { id: AccentColor; label: string; hex: string }[] = [
  { id: 'cyan', label: 'Cyan', hex: '#06b6d4' },
  { id: 'violet', label: 'Violet', hex: '#8b5cf6' },
  { id: 'emerald', label: 'Emerald', hex: '#10b981' },
  { id: 'amber', label: 'Amber', hex: '#f59e0b' },
  { id: 'rose', label: 'Rose', hex: '#f43f5e' },
];

export function SettingsModal() {
  const {
    preferences,
    activePreset,
    setTheme,
    selectPreset,
    resetTheme,
    isSettingsOpen,
    setIsSettingsOpen,
  } = useTheme();
  const [isOpfsOpen, setIsOpfsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ThemePresetCategory | 'all'>('all');

  const categories: Array<{ id: ThemePresetCategory | 'all'; label: string }> = [
    { id: 'all', label: 'All (20)' },
    { id: 'dark', label: 'Dark' },
    { id: 'light', label: 'Light' },
    { id: 'cyber', label: 'Cyber' },
    { id: 'creative', label: 'Creative' },
    { id: 'minimal', label: 'Minimal' },
  ];

  const filteredPresets = useMemo(() => {
    return STUDIO_THEME_PRESETS.filter((p) => {
      const matchesCategory =
        selectedCategory === 'all' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const currentPresetId = preferences.presetId || 'obsidian';

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
      <DialogContent className="sm:max-w-3xl max-w-2xl max-h-[88vh] overflow-y-auto glass-panel bg-glass-surface text-foreground border-glass-border border-t-glass-border-highlight p-6 rounded-2xl shadow-glass">
        <DialogHeader className="pb-3 border-b border-glass-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg glass-badge-accent flex items-center justify-center">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  Studio Theme & Optical Glass Settings
                  <Badge variant="secondary" className="font-mono text-[10px] glass-badge-accent">
                    20 Presets Live
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Switch between 20 curated themes and customize decoupled optical glass refraction in real-time.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4 text-xs">
          {/* 1. Theme Presets Gallery (20 Iconic Presets) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-foreground/90 tracking-wide uppercase text-[11px] flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-accent-theme" />
                Theme Presets ({STUDIO_THEME_PRESETS.length} Curated)
              </label>
              <Badge variant="outline" className="font-mono text-[10px] border-accent-theme/40 text-accent-theme bg-accent-theme/10">
                Active: {activePreset.name}
              </Badge>
            </div>

            {/* Filter Pills & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 justify-between">
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all shrink-0 cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'bg-accent-theme text-primary-foreground font-semibold shadow-accent-glow'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-56 shrink-0">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter 20 themes..."
                  className="h-7 text-xs pl-8 bg-muted/30 border-glass-border rounded-lg"
                />
              </div>
            </div>

            {/* Visual Swatch Cards Grid */}
            <div
              role="listbox"
              aria-label="Studio theme presets"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[300px] overflow-y-auto pr-1"
            >
              {filteredPresets.map((preset) => {
                const isSelected = preset.id === currentPresetId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectPreset(preset.id)}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-accent-theme bg-accent-theme/15 shadow-accent-glow'
                        : 'border-glass-border/70 hover:border-accent-theme/50 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-foreground text-xs truncate">
                          {preset.name}
                        </span>
                        <span className="text-[9px] text-muted-foreground capitalize font-mono">
                          • {preset.category}
                        </span>
                      </div>
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-accent-theme shrink-0 ml-1" />
                      ) : preset.mode === 'light' ? (
                        <Sun className="w-3 h-3 text-amber-500 shrink-0 opacity-70" />
                      ) : (
                        <Moon className="w-3 h-3 text-muted-foreground shrink-0 opacity-70" />
                      )}
                    </div>

                    <p className="text-[10px] text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
                      {preset.description}
                    </p>

                    {/* 4-Color Swatch Strip */}
                    <div className="flex items-center gap-1.5 h-4 w-full rounded-md p-1 border border-glass-border bg-black/20 overflow-hidden">
                      <div
                        className="flex-1 h-full rounded-xs shadow-2xs"
                        style={{ backgroundColor: preset.preview.bg }}
                        title="Background"
                      />
                      <div
                        className="flex-1 h-full rounded-xs shadow-2xs"
                        style={{ backgroundColor: preset.preview.surface }}
                        title="Surface / Card"
                      />
                      <div
                        className="flex-1 h-full rounded-xs shadow-2xs"
                        style={{ backgroundColor: preset.preview.primary }}
                        title="Primary Brand"
                      />
                      <div
                        className="flex-1 h-full rounded-xs shadow-2xs"
                        style={{ backgroundColor: preset.preview.accent }}
                        title="Accent Glow"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-glass-border pt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 2. Decoupled Optical Glass Finish */}
            <div className="space-y-2">
              <label className="font-semibold text-foreground/90 tracking-wide uppercase text-[11px] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-accent-theme" />
                Optical Glass Finish (Decoupled)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {GLASS_STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setTheme({ glassStyle: style.id })}
                    aria-pressed={preferences.glassStyle === style.id}
                    data-active={preferences.glassStyle === style.id}
                    className="glass-pill p-2 rounded-lg text-left flex flex-col justify-between cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-theme focus-visible:outline-hidden"
                  >
                    <div className="font-semibold text-foreground text-[11px] flex items-center justify-between mb-0.5">
                      <span>{style.label}</span>
                      {preferences.glassStyle === style.id && (
                        <Check className="w-3 h-3 text-accent-theme" />
                      )}
                    </div>
                    <p className="text-[9px] text-muted-foreground line-clamp-2 leading-tight">
                      {style.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Acrylic Blur Intensity */}
            <div className="space-y-2">
              <label className="font-semibold text-foreground/90 tracking-wide uppercase text-[11px] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-accent-theme" />
                Acrylic Blur Intensity
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {BLUR_INTENSITIES.map((blur) => (
                  <button
                    key={blur.id}
                    type="button"
                    onClick={() => setTheme({ blurIntensity: blur.id })}
                    aria-pressed={preferences.blurIntensity === blur.id}
                    data-active={preferences.blurIntensity === blur.id}
                    className="glass-pill py-2 px-2.5 rounded-lg text-center flex flex-col items-center justify-center cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-theme focus-visible:outline-hidden"
                  >
                    <span className="font-semibold text-foreground capitalize text-xs">
                      {blur.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {blur.px}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Material & Optical Finish Specimen */}
            <div className="col-span-1 md:col-span-2 p-3.5 rounded-xl border border-glass-border relative overflow-hidden bg-black/20">
              <div className="absolute inset-0 liquid-ambient-mesh opacity-80 pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-accent-theme" />
                  Live Material Specimen (Physics Parity)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent-theme/15 text-accent-theme border border-accent-theme/30 capitalize">
                  {preferences.glassStyle} • {preferences.blurIntensity} ({preferences.blurIntensity === 'low' ? '6px' : preferences.blurIntensity === 'high' ? '40px' : '18px'})
                </span>
              </div>
              <div className="relative z-10 p-3.5 rounded-xl glass-panel shadow-glass flex items-center justify-between transition-all duration-200">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center border border-accent-theme/40 shadow-accent-glow"
                    style={{ background: 'color-mix(in srgb, var(--accent-primary) 20%, transparent)' }}
                  >
                    <Layers className="w-4 h-4 text-accent-theme" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                      <span>
                        {preferences.glassStyle === 'specular' && 'Specular Sheen Active'}
                        {preferences.glassStyle === 'frosted' && 'Frosted Matte Active'}
                        {preferences.glassStyle === 'cyber' && 'Cyber Glow Emission Active'}
                      </span>
                      <span className="text-[10px] font-normal text-muted-foreground capitalize">
                        • {activePreset.name} Palette
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {preferences.glassStyle === 'specular' &&
                        'Sharpened rim reflection with high-refraction specular highlight.'}
                      {preferences.glassStyle === 'frosted' &&
                        'Diffused matte refraction with zero specular sheen and subtle soft shadow.'}
                      {preferences.glassStyle === 'cyber' &&
                        'High-tech neon perimeter lighting and accent chromatic shadow emission.'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-accent-theme shadow-accent-glow animate-pulse" />
                  <span className="text-[10px] font-mono font-semibold text-accent-theme uppercase">
                    ACTIVE
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Accent Color Overrides */}
          <div className="space-y-2 border-t border-glass-border pt-4">
            <label className="font-semibold text-foreground/90 tracking-wide uppercase text-[11px] flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent-theme shadow-accent-glow" />
              Dynamic Accent Color Override
            </label>
            <div className="grid grid-cols-5 gap-2">
              {ACCENT_COLORS.map((accent) => (
                <button
                  key={accent.id}
                  type="button"
                  onClick={() => setTheme({ accentColor: accent.id })}
                  aria-pressed={preferences.accentColor === accent.id}
                  data-active={preferences.accentColor === accent.id}
                  className="glass-pill p-2 rounded-lg flex items-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-theme focus-visible:outline-hidden transition-all"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-glass-border shrink-0 shadow-xs"
                    style={{ backgroundColor: accent.hex }}
                  />
                  <span className="font-medium text-foreground text-[11px] truncate">
                    {accent.label}
                  </span>
                  {preferences.accentColor === accent.id && (
                    <Check className="w-3 h-3 text-accent-theme ml-auto shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Cache & Storage Maintenance */}
          <div className="space-y-2 border-t border-glass-border pt-4">
            <label className="font-semibold text-foreground/90 tracking-wide uppercase text-[11px] flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-accent-theme" />
              Cache & Storage Maintenance
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="glass-card p-3 rounded-lg flex items-center justify-between border border-glass-border">
                <div>
                  <div className="font-semibold text-foreground text-xs">OPFS Storage Explorer</div>
                  <div className="text-[10px] text-muted-foreground">
                    Inspect Origin Private File System cache folders
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOpfsOpen(true)}
                  className="h-7 text-[11px] gap-1 px-2.5 border-glass-border"
                >
                  <HardDrive className="w-3 h-3 text-accent-theme" />
                  Inspect OPFS
                </Button>
              </div>

              <div className="glass-card p-3 rounded-lg flex items-center justify-between border border-glass-border">
                <div>
                  <div className="font-semibold text-foreground text-xs">Purge Waveform LRU</div>
                  <div className="text-[10px] text-muted-foreground">
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
                    } catch {}
                    toast.success('Cache cleared successfully');
                  }}
                  className="h-7 text-[11px] gap-1 px-2.5 border-glass-border hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                  Purge Cache
                </Button>
              </div>
            </div>
          </div>

          {/* Live Material Inspection Preview */}
          <div className="pt-2">
            <label className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider block mb-1.5">
              Live Material Inspection
            </label>
            <div className="glass-card p-3.5 rounded-xl relative overflow-hidden flex items-center justify-between border border-[var(--glass-border)]">
              <div>
                <div className="font-semibold text-foreground text-xs">
                  {activePreset.name} ({preferences.mode.toUpperCase()})
                </div>
                <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  glass: {preferences.glassStyle} • blur: {preferences.blurIntensity} • accent: {preferences.accentColor}
                </div>
              </div>
              <button
                type="button"
                className="glass-button text-xs px-3 py-1 rounded-lg text-foreground font-medium cursor-pointer"
              >
                Sample Action
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-[var(--glass-border)] flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetTheme}
            className="text-xs gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Defaults
          </Button>
          <Button
            variant="accent"
            size="sm"
            onClick={() => setIsSettingsOpen(false)}
            className="px-5 cursor-pointer"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
      <OpfsDebuggerModal open={isOpfsOpen} onOpenChange={setIsOpfsOpen} />
    </Dialog>
  );
}

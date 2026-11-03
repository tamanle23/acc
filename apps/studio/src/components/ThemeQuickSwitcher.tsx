import React, { useState, useMemo } from 'react';
import { Palette, Check, Search, Sliders, Sun, Moon } from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from './ui/popover';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tooltip } from './ui/tooltip';
import { Input } from './ui/input';
import {
  useTheme,
  STUDIO_THEME_PRESETS,
  type ThemePresetCategory,
  type StudioThemePreset,
} from '../lib/theme';

export function ThemeQuickSwitcher() {
  const { preferences, activePreset, selectPreset, setIsSettingsOpen } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ThemePresetCategory | 'all'>('all');

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

  const categories: Array<{ id: ThemePresetCategory | 'all'; label: string }> = [
    { id: 'all', label: 'All (20)' },
    { id: 'dark', label: 'Dark' },
    { id: 'light', label: 'Light' },
    { id: 'cyber', label: 'Cyber' },
    { id: 'creative', label: 'Creative' },
    { id: 'minimal', label: 'Minimal' },
  ];

  const currentPresetId = preferences.presetId || 'obsidian';

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip content="Quick Theme Switcher (20 Presets)">
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Switch Theme Preset"
            className="h-8 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-glass-border rounded-lg transition-all"
          >
            <div
              className="w-3.5 h-3.5 rounded-full border border-glass-border flex items-center justify-center shrink-0 shadow-2xs"
              style={{
                background: activePreset.preview.primary,
                boxShadow: `0 0 8px ${activePreset.preview.primary}55`,
              }}
            >
              <Palette className="w-2.5 h-2.5 text-black/70 mix-blend-overlay" />
            </div>
            <span className="hidden xl:inline font-medium text-[11px] truncate max-w-[90px]">
              {activePreset.name}
            </span>
          </Button>
        </PopoverTrigger>
      </Tooltip>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[360px] p-3 glass-panel border-glass-border shadow-2xl backdrop-blur-2xl rounded-2xl flex flex-col gap-2.5 z-50"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-glass-border pb-2">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-accent-theme" />
            <span className="text-xs font-bold text-foreground tracking-wide">
              Theme Presets
            </span>
          </div>
          <Badge
            variant="outline"
            className="font-mono text-[10px] px-1.5 py-0.5 border-accent-theme/40 text-accent-theme bg-accent-theme/10"
          >
            {activePreset.name}
          </Badge>
        </div>

        {/* Live Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search themes (e.g. tokyo, oled, nord)..."
            className="h-7 text-xs pl-8 bg-muted/30 border-glass-border rounded-lg"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all shrink-0 cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-accent-theme text-primary-foreground font-semibold shadow-accent-glow'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 2-Column Preset Grid */}
        <div
          role="listbox"
          aria-label="Theme presets"
          className="grid grid-cols-2 gap-1.5 max-h-[260px] overflow-y-auto pr-1 select-none"
        >
          {filteredPresets.map((preset) => {
            const isSelected = preset.id === currentPresetId;
            return (
              <button
                key={preset.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  selectPreset(preset.id);
                }}
                className={`flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer border ${
                  isSelected
                    ? 'border-accent-theme bg-accent-theme/15 shadow-accent-glow text-foreground'
                    : 'border-glass-border/60 hover:border-accent-theme/50 hover:bg-muted/30 text-foreground/80'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {/* Swatch Pill */}
                  <div
                    className="w-5 h-5 rounded-md border border-white/20 shadow-2xs shrink-0 flex items-center justify-center relative overflow-hidden"
                    style={{ backgroundColor: preset.preview.bg }}
                  >
                    <div
                      className="absolute inset-x-0 bottom-0 h-2"
                      style={{ backgroundColor: preset.preview.primary }}
                    />
                    {preset.mode === 'light' ? (
                      <Sun className="w-2.5 h-2.5 text-amber-500 absolute top-0.5" />
                    ) : (
                      <Moon className="w-2.5 h-2.5 text-white/70 absolute top-0.5" />
                    )}
                  </div>

                  <div className="truncate">
                    <div className="text-[11px] font-semibold leading-tight truncate">
                      {preset.name}
                    </div>
                    <div className="text-[9px] text-muted-foreground capitalize leading-tight">
                      {preset.category}
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-accent-theme shrink-0 ml-1" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer Link to Full Settings */}
        <div className="pt-2 border-t border-glass-border flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {filteredPresets.length} of 20 Presets
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsOpen(false);
              setIsSettingsOpen(true);
            }}
            className="h-6 text-[10px] gap-1 px-2 text-accent-theme hover:bg-accent-theme/10"
          >
            <Sliders className="w-3 h-3" />
            Glass & Gallery Settings
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

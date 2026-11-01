import React, { useState, useMemo } from 'react';
import {
  Search,
  Check,
  Move,
  Sparkles,
  Film,
  Volume2,
  Type,
  FolderPlus,
  Layers,
  X,
} from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
} from '../ui/popover';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { ModifierNode } from '@acc/ir';
import type {
  AvailableModifierDef,
  ModifierCategory,
  ModifierIconComponent,
} from './modifierCatalog';

export interface ModifierAddPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relevantModifiers: AvailableModifierDef[];
  activeEntityModifiers: ModifierNode[];
  isDisabled?: boolean;
  onSelectModifier: (mod: AvailableModifierDef) => void;
  children?: React.ReactNode;
}

const CATEGORY_MAP: Record<string, { label: string; icon: ModifierIconComponent }> = {
  all: { label: 'All', icon: Layers },
  motion: { label: 'Motion', icon: Move },
  vfx: { label: 'VFX', icon: Sparkles },
  transitions: { label: 'Transitions', icon: Film },
  audio: { label: 'Audio', icon: Volume2 },
  text: { label: 'Typography', icon: Type },
  custom: { label: 'Custom', icon: FolderPlus },
};

/**
 * ModifierAddPicker:
 * Studio-grade searchable popover command palette for discovering and attaching
 * VideoIR modifiers and visual effects.
 */
export const ModifierAddPicker: React.FC<ModifierAddPickerProps> = ({
  open,
  onOpenChange,
  relevantModifiers,
  activeEntityModifiers,
  isDisabled = false,
  onSelectModifier,
  children,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredModifiers = useMemo(() => {
    return relevantModifiers.filter((mod) => {
      // Category filter
      if (selectedCategory !== 'all') {
        const cat = mod.category || 'custom';
        if (cat !== selectedCategory) return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = mod.name.toLowerCase().includes(q);
        const matchesType = mod.type.toLowerCase().includes(q);
        const matchesCategory = (mod.category || '').toLowerCase().includes(q);
        if (!matchesName && !matchesType && !matchesCategory) return false;
      }
      return true;
    });
  }, [relevantModifiers, selectedCategory, searchQuery]);

  const handleSelect = (mod: AvailableModifierDef) => {
    onSelectModifier(mod);
    onOpenChange(false);
    setSearchQuery('');
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {children ? (
        <PopoverTrigger asChild>{children}</PopoverTrigger>
      ) : (
        <PopoverAnchor className="absolute top-10 right-3 w-1 h-1 pointer-events-none" />
      )}
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-80 p-0 glass-card bg-popover/95 backdrop-blur-md border border-glass-border shadow-2xl overflow-hidden z-50 flex flex-col max-h-[420px]"
      >
        {/* Search Input Bar */}
        <div className="p-2 border-b border-glass-border bg-glass-surface/50 flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-accent-theme shrink-0" />
          <input
            type="text"
            placeholder="Search effects & modifiers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none font-sans"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1 p-1.5 border-b border-glass-border/40 overflow-x-auto scrollbar-none bg-muted/20">
          {Object.entries(CATEGORY_MAP).map(([key, cat]) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedCategory(key)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-accent-theme text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-glass-surface'
                }`}
              >
                <Icon className="w-2.5 h-2.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modifier List */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
          {filteredModifiers.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No matching modifiers found.
            </div>
          ) : (
            filteredModifiers.map((mod) => {
              const isAttached = activeEntityModifiers.some(
                (m) => m.type === mod.type
              );
              const Icon = mod.icon || Sparkles;
              const isActionDisabled = isDisabled || isAttached;

              return (
                <div
                  key={mod.type}
                  onClick={() => !isActionDisabled && handleSelect(mod)}
                  className={`flex items-center justify-between p-2 rounded-md transition-all text-xs ${
                    isAttached
                      ? 'bg-accent-theme/10 border border-accent-theme/20 text-muted-foreground cursor-default'
                      : isActionDisabled
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-glass-surface/80 hover:border-accent-theme/40 border border-transparent cursor-pointer text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded flex items-center justify-center bg-accent-theme/15 text-accent-theme shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <div className="font-semibold text-[11px] truncate">{mod.name}</div>
                      <div className="font-mono text-[9px] text-muted-foreground truncate">
                        {mod.type}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pl-1">
                    {mod.targetScope === 'standalone' && (
                      <Badge
                        variant="outline"
                        className="font-mono text-[8px] uppercase border-purple-500/40 text-purple-400 bg-purple-500/10 px-1 py-0"
                      >
                        Gen
                      </Badge>
                    )}
                    {isAttached ? (
                      <div className="flex items-center gap-1 text-[10px] text-accent-theme font-mono">
                        <Check className="w-3 h-3 text-accent-theme" />
                        <span>Attached</span>
                      </div>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="font-mono text-[8px] uppercase text-muted-foreground px-1 py-0"
                      >
                        {mod.category || 'fx'}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

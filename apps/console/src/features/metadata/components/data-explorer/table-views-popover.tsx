import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutGrid,
  Check,
  Plus,
  Trash2,
  Users,
  User,
  Sliders,
  Rows,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { VisibilityState } from '@tanstack/react-table';

export type GridDensity = 'compact' | 'comfortable' | 'spacious';

export interface ViewPreset {
  id: string;
  name: string;
  isTeamView?: boolean;
  density: GridDensity;
  columnVisibility?: VisibilityState;
  columnOrder?: string[];
}

interface TableViewsPopoverProps {
  entityTypeId: string | number;
  currentDensity: GridDensity;
  onDensityChange: (density: GridDensity) => void;
  currentVisibility: VisibilityState;
  onVisibilityChange: (vis: VisibilityState) => void;
  currentColumnOrder?: string[];
  onColumnOrderChange?: (order: string[]) => void;
  activePresetId?: string | null;
  onSelectPreset?: (preset: ViewPreset) => void;
}

export const TableViewsPopover: React.FC<TableViewsPopoverProps> = ({
  entityTypeId,
  currentDensity,
  onDensityChange,
  currentVisibility,
  onVisibilityChange,
  currentColumnOrder,
  onColumnOrderChange,
  activePresetId,
  onSelectPreset,
}) => {
  const [open, setOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const storageKey = `unipost_view_presets_${entityTypeId}`;

  const defaultPresets: ViewPreset[] = [
    {
      id: 'team-default-overview',
      name: 'Default Overview',
      isTeamView: true,
      density: 'comfortable',
    },
    {
      id: 'team-compact-grid',
      name: 'Compact High-Density',
      isTeamView: true,
      density: 'compact',
    },
    {
      id: 'team-spacious-audit',
      name: 'Spacious Detail View',
      isTeamView: true,
      density: 'spacious',
    },
  ];

  const [presets, setPresets] = useState<ViewPreset[]>(() => {
    if (typeof window === 'undefined') return defaultPresets;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return [...defaultPresets, ...parsed];
      }
    } catch {
      // fallback
    }
    return defaultPresets;
  });

  const saveCustomPresets = (all: ViewPreset[]) => {
    const customOnly = all.filter((p) => !p.isTeamView);
    try {
      localStorage.setItem(storageKey, JSON.stringify(customOnly));
    } catch {
      // Ignore storage errors
    }
  };

  const handleCreatePreset = () => {
    if (!newPresetName.trim()) {
      toast.error('Preset name cannot be empty');
      return;
    }
    const newPreset: ViewPreset = {
      id: `custom-preset-${Date.now()}`,
      name: newPresetName.trim(),
      isTeamView: false,
      density: currentDensity,
      columnVisibility: currentVisibility,
      columnOrder: currentColumnOrder,
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    saveCustomPresets(updated);
    setNewPresetName('');
    setIsSaving(false);
    onSelectPreset?.(newPreset);
    toast.success(`Preset "${newPreset.name}" saved successfully`);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    saveCustomPresets(updated);
    toast.info('Preset removed');
  };

  const handleApplyPreset = (preset: ViewPreset) => {
    onDensityChange(preset.density);
    if (preset.columnVisibility) {
      onVisibilityChange(preset.columnVisibility);
    }
    if (preset.columnOrder && onColumnOrderChange) {
      onColumnOrderChange(preset.columnOrder);
    }
    onSelectPreset?.(preset);
    toast.success(`Applied view preset: ${preset.name}`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs bg-white/40 dark:bg-white/5 border-white/20 hover:bg-muted/60"
        >
          <LayoutGrid className="size-3.5 text-primary" />
          <span>Views & Density</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-3 rounded-2xl border border-white/20 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl shadow-2xl space-y-3"
      >
        {/* Density Selector */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            <Rows className="size-3.5 text-primary" /> Row Density
          </div>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-muted/30 border border-border/50 text-xs">
            {(
              [
                { id: 'compact', label: 'Compact', px: '36px' },
                { id: 'comfortable', label: 'Comfort', px: '48px' },
                { id: 'spacious', label: 'Spacious', px: '60px' },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onDensityChange(d.id)}
                className={cn(
                  'flex flex-col items-center py-1.5 px-2 rounded-lg font-medium transition-all text-center',
                  currentDensity === d.id
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span>{d.label}</span>
                <span className="text-[10px] opacity-75 font-mono">{d.px}</span>
              </button>
            ))}
          </div>
        </div>

        {/* View Presets List */}
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            <span className="flex items-center gap-1.5">
              <Sliders className="size-3.5 text-primary" /> Saved Views & Presets
            </span>
          </div>

          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {presets.map((p) => {
              const isSelected = activePresetId === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => handleApplyPreset(p)}
                  className={cn(
                    'group flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer border transition-colors',
                    isSelected
                      ? 'border-primary/50 bg-primary/10 text-primary font-medium'
                      : 'border-border/40 hover:bg-muted/50 text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {p.isTeamView ? (
                      <Users className="size-3.5 text-blue-500 shrink-0" />
                    ) : (
                      <User className="size-3.5 text-emerald-500 shrink-0" />
                    )}
                    <span className="truncate">{p.name}</span>
                    {p.isTeamView && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
                        Team
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isSelected && <Check className="size-3.5 text-primary" />}
                    {!p.isTeamView && (
                      <button
                        type="button"
                        onClick={(e) => handleDeletePreset(p.id, e)}
                        className="opacity-0 group-hover:opacity-100 hover:text-destructive p-0.5"
                        title="Delete Preset"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Save Current View Form */}
        <div className="pt-2 border-t border-border/50">
          {!isSaving ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSaving(true)}
              className="w-full text-xs h-8 gap-1.5 justify-center text-primary hover:text-primary hover:bg-primary/10"
            >
              <Plus className="size-3.5" /> Save Current View as Preset
            </Button>
          ) : (
            <div className="flex items-center gap-1.5">
              <Input
                value={newPresetName}
                placeholder="Preset name..."
                onChange={(e) => setNewPresetName(e.target.value)}
                className="h-8 text-xs flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreatePreset();
                  if (e.key === 'Escape') setIsSaving(false);
                }}
              />
              <Button size="sm" onClick={handleCreatePreset} className="h-8 px-2 text-xs">
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSaving(false)}
                className="h-8 px-2 text-xs"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

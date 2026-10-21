import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { PALETTE_ITEMS, CATEGORIES, type PaletteItem } from './dag-palette';
import { type DagNodeType, type DagNodeData } from './dag-node';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export interface DagQuickInsertPopoverProps {
  position: { x: number; y: number };
  onSelectNodeType?: (type: DagNodeType, defaultData?: Partial<DagNodeData>) => void;
  onSelect?: (type: DagNodeType, label?: string, defaultData?: Partial<DagNodeData>) => void;
  onClose: () => void;
}

export const DagQuickInsertPopover: React.FC<DagQuickInsertPopoverProps> = ({
  position,
  onSelectNodeType,
  onSelect,
  onClose,
}) => {
  const handleSelectType = useCallback(
    (type: DagNodeType, defaultData?: Partial<DagNodeData>, label?: string) => {
      if (onSelectNodeType) {
        onSelectNodeType(type, defaultData);
      } else if (onSelect) {
        onSelect(type, label, defaultData);
      }
    },
    [onSelectNodeType, onSelect]
  );
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Auto-focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Filter items based on active category and query
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return PALETTE_ITEMS.filter((item) => {
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      const matchesQuery =
        !q ||
        item.label.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [searchQuery, activeCategory]);

  // Keep selected index in bounds when list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery, activeCategory]);

  // Handle keyboard navigation (ArrowUp, ArrowDown, Enter, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : Math.max(0, filteredItems.length - 1)));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          const item = filteredItems[selectedIndex];
          handleSelectType(item.type, item.defaultData, item.label);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredItems, selectedIndex, handleSelectType, onClose]);

  // Handle outside click to close
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  // Clamp position within viewport boundaries
  const clampedX = Math.max(16, Math.min(position.x - 160, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 340));
  const clampedY = Math.max(16, Math.min(position.y + 12, (typeof window !== 'undefined' ? window.innerHeight : 800) - 440));

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        left: `${clampedX}px`,
        top: `${clampedY}px`,
      }}
      className={cn(
        'z-50 w-80 max-h-[420px] flex flex-col rounded-2xl overflow-hidden',
        'backdrop-blur-2xl bg-white/95 dark:bg-slate-900/95 border border-white/40 dark:border-white/10 shadow-2xl',
        'animate-in fade-in-0 zoom-in-95 duration-150'
      )}
      data-testid="dag-quick-insert-popover"
      role="dialog"
      aria-label="Quick insert task node"
    >
      {/* Header with Title and Close Button */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-border/40">
        <span className="text-xs font-bold text-foreground tracking-wide uppercase">
          Insert Task Node
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground rounded-lg p-1 hover:bg-muted/50 transition-colors"
          aria-label="Close insert menu"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-2.5 pb-1.5">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search 23 task node types..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs bg-muted/40 border-border/50 rounded-xl focus-visible:ring-1"
            data-testid="dag-quick-insert-search-input"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 px-2.5 pb-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={cn(
            'px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors',
            activeCategory === 'all'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted/40 text-muted-foreground hover:bg-muted/80'
          )}
        >
          All (23)
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors',
              activeCategory === cat.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/40 text-muted-foreground hover:bg-muted/80'
            )}
          >
            {cat.label.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Filtered Items List */}
      <div
        className="flex-1 overflow-y-auto p-2 pt-0 space-y-1 max-h-[260px]"
        role="listbox"
        data-testid="dag-quick-insert-listbox"
      >
        {filteredItems.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No matching task node types found.
          </div>
        ) : (
          filteredItems.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <div
                key={item.type}
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
                onClick={() => handleSelectType(item.type, item.defaultData, item.label)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  'flex items-center gap-2.5 p-2 rounded-xl cursor-pointer text-left transition-all',
                  isSelected
                    ? 'bg-primary/10 border border-primary/30 text-primary shadow-xs'
                    : 'hover:bg-muted/40 text-foreground border border-transparent'
                )}
                data-testid={`dag-quick-insert-item-${item.type}`}
              >
                <div
                  className={cn(
                    'p-1.5 rounded-lg shrink-0 flex items-center justify-center transition-colors',
                    isSelected
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted/60 text-muted-foreground'
                  )}
                >
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold truncate leading-tight">
                      {item.label}
                    </span>
                    <span className="text-[9px] font-mono opacity-60 uppercase shrink-0 ml-1">
                      {item.type}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate leading-normal">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

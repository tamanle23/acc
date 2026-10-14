import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  useBlueprintCatalog,
  useProvisionTenantBlueprint,
} from '../../api/use-blueprints';
import { useMetadataUiStore } from '../../store/use-metadata-ui-store';
import { BlueprintCard } from './blueprint-card';
import { BlueprintTableView } from './blueprint-table-view';
import { BlueprintSplitView } from './blueprint-split-view';
import { TemplatePreviewModal } from './template-preview-modal';
import { LayoutModeSwitcher, type LayoutMode } from '@/components/layout-switcher';
import { DialogResizeHandles } from '@/components/dialog-resize-handles';
import { useResizableDialog } from '@/hooks/use-resizable-dialog';
import { Search, BookTemplate, Sparkles, Filter, X, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY_LAYOUT = 'console:layout:blueprint-catalog';

export const BlueprintGalleryDialog: React.FC = () => {
  const {
    isBlueprintGalleryOpen,
    closeBlueprintGallery,
    activeTenantId,
    activeTenantName,
  } = useMetadataUiStore();

  const { data: blueprints = [], isLoading } = useBlueprintCatalog();
  const provisionMutation = useProvisionTenantBlueprint();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [previewBlueprintId, setPreviewBlueprintId] = useState<string | null>(null);

  // Modal Resizing & Maximize / Restore Controls
  const {
    size,
    isMaximized,
    isResizing,
    toggleMaximize,
    resetToDefault,
    startResize,
    dialogStyle,
  } = useResizableDialog({
    storageKey: 'console:dialog:blueprint-catalog:dimensions',
    defaultWidth: 1150,
    defaultHeight: 780,
    minWidth: 640,
    minHeight: 480,
  });

  // Initialize layout mode from localStorage or fallback to 'grid'
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_LAYOUT);
      if (stored === 'grid' || stored === 'table' || stored === 'split') {
        return stored;
      }
    } catch {
      // LocalStorage unavailable
    }
    return 'grid';
  });

  const handleLayoutChange = (mode: LayoutMode) => {
    setLayoutMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY_LAYOUT, mode);
    } catch {
      // Ignore storage errors
    }
  };

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    blueprints.forEach((b) => {
      if (b.category) set.add(b.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [blueprints]);

  const filteredBlueprints = useMemo(() => {
    return blueprints.filter((b) => {
      const matchesSearch =
        !search.trim() ||
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        b.description.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        selectedCategory === 'ALL' || b.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [blueprints, search, selectedCategory]);

  const handleSelectBlueprint = async (blueprintId: string) => {
    await provisionMutation.mutateAsync({
      tenantId: activeTenantId,
      tenantName: activeTenantName,
      blueprintId,
    });
    closeBlueprintGallery();
  };

  return (
    <>
      <Dialog
        open={isBlueprintGalleryOpen}
        onOpenChange={(open) => !open && closeBlueprintGallery()}
      >
        <DialogContent
          style={dialogStyle}
          className={cn(
            'flex flex-col p-4 sm:p-6 rounded-3xl bg-white/90 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-2xl relative select-none',
            isResizing && 'transition-none select-none cursor-grabbing',
            !isResizing && 'transition-[width,height] duration-150 ease-out'
          )}
        >
          {/* Freeform Edge & Corner Resize Drag Handles */}
          <DialogResizeHandles onStartResize={startResize} isMaximized={isMaximized} />

          <DialogHeader className="space-y-1 shrink-0 pb-3 border-b border-border/40 pr-16">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                  <BookTemplate className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 truncate">
                    <span>Domain Blueprint Catalog</span>
                    <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                      Sub-250ms Seeding
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground truncate">
                    Jump-start your workspace with production-ready schemas, attributes, and graph relationships.
                  </DialogDescription>
                </div>
              </div>

              {/* Window Controls: Maximize/Restore & Reset Dimensions */}
              <div className="flex items-center gap-1 shrink-0 -mr-6">
                {!isMaximized && (size.width !== 1150 || size.height !== 780) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={resetToDefault}
                    title="Reset to default window size"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                    aria-label="Reset window size"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={toggleMaximize}
                  title={isMaximized ? 'Restore window size' : 'Maximize window'}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                  aria-label={isMaximized ? 'Restore window size' : 'Maximize window'}
                >
                  {isMaximized ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Search, Category Filter, and Layout Switcher Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 shrink-0">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search templates (e.g. CMS, Fleet)..."
                  className="pl-8 pr-7 h-8 text-xs bg-white/50 dark:bg-white/5 border-white/20"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-2 p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Layout Mode Segmented Control */}
              <LayoutModeSwitcher
                value={layoutMode}
                onChange={handleLayoutChange}
                ariaLabel="Blueprint catalog view layout"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 border',
                    selectedCategory === cat
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-white/40 dark:bg-white/5 border-white/20 text-muted-foreground hover:text-foreground'
                  )}
                >
                  {cat === 'ALL'
                    ? 'All Blueprints'
                    : cat === 'MEDIA_PUBLISHING'
                    ? 'Publishing & Media'
                    : cat === 'OPERATIONS'
                    ? 'Logistics & Fleet'
                    : cat === 'COMMERCE'
                    ? 'Commerce & Billing'
                    : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Catalog View Container */}
          <div
            className={cn(
              'flex-1 min-h-0 mt-2 pr-1',
              layoutMode === 'split' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'
            )}
          >
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-16 gap-3 text-muted-foreground">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-xs">Fetching domain blueprint templates...</span>
              </div>
            ) : filteredBlueprints.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 text-center text-muted-foreground">
                <Sparkles className="h-8 w-8 mb-2 opacity-40" />
                <h4 className="font-semibold text-sm text-foreground">No blueprints match your search</h4>
                <p className="text-xs mt-1">Try clearing your search query or choosing another category.</p>
              </div>
            ) : layoutMode === 'table' ? (
              <BlueprintTableView
                blueprints={filteredBlueprints}
                onPreview={(id) => setPreviewBlueprintId(id)}
                onSelect={handleSelectBlueprint}
                isImporting={provisionMutation.isPending}
              />
            ) : layoutMode === 'split' ? (
              <BlueprintSplitView
                blueprints={filteredBlueprints}
                onSelect={handleSelectBlueprint}
                isImporting={provisionMutation.isPending}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-2">
                {filteredBlueprints.map((bp) => (
                  <BlueprintCard
                    key={bp.id}
                    blueprint={bp}
                    onPreview={(id) => setPreviewBlueprintId(id)}
                    onSelect={handleSelectBlueprint}
                    isImporting={provisionMutation.isPending}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Embedded Preview Modal */}
      <TemplatePreviewModal
        blueprintId={previewBlueprintId}
        isOpen={Boolean(previewBlueprintId)}
        onClose={() => setPreviewBlueprintId(null)}
      />
    </>
  );
};

import React, { useMemo, useState, useEffect } from 'react';
import { useEntityTypes } from '../../api/metadata-api';
import { useMetadataUiStore } from '../../store/use-metadata-ui-store';
import type { EntityType } from '../../api/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Database,
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useTenantBilling } from '../../api/use-billing';
import { usePermissions } from '@/features/spring-auth';
import { cn } from '@/lib/utils';

export const EntityTypeSidebar: React.FC = () => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [compositeOnly, setCompositeOnly] = useState(false);

  const {
    selectedEntityTypeId,
    setSelectedEntityTypeId,
    canManageSchema,
    openCreateEntityTypeDialog,
    openEditEntityTypeDialog,
    openDeleteEntityTypeDialog,
    openBlueprintGallery,
  } = useMetadataUiStore();


  const [isMobileExpanded, setIsMobileExpanded] = useState(!selectedEntityTypeId);

  // Debounce search query (300ms) and reset page to 1
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const { data: entityTypesResponse, isLoading } = useEntityTypes({
    number: page,
    size: pageSize,
    search: debouncedSearch,
  });

  const entityTypes = useMemo(() => {
    return entityTypesResponse?.content || [];
  }, [entityTypesResponse]);

  const compositeCount = useMemo(() => {
    return entityTypes.filter((et: EntityType) => Boolean(et.isComposite)).length;
  }, [entityTypes]);

  const displayedEntityTypes = useMemo(() => {
    if (!compositeOnly) return entityTypes;
    return entityTypes.filter((et: EntityType) => Boolean(et.isComposite));
  }, [entityTypes, compositeOnly]);

  const totalElements = entityTypesResponse?.totalElements ?? entityTypes.length;
  const totalPages = entityTypesResponse?.totalPages ?? (Math.ceil(totalElements / pageSize) || 1);

  const handleToggleCompositeOnly = (checked: boolean) => {
    setCompositeOnly(checked);
    if (checked) {
      const firstComp = entityTypes.find((et: EntityType) => Boolean(et.isComposite));
      if (firstComp) {
        setSelectedEntityTypeId(String(firstComp.id));
      }
    }
  };

  // If no model is selected or current selection is filtered out in compositeOnly mode, select first item
  useEffect(() => {
    if (displayedEntityTypes.length > 0) {
      const currentExists = displayedEntityTypes.some((et) => String(et.id) === String(selectedEntityTypeId));
      if (!currentExists || !selectedEntityTypeId) {
        setSelectedEntityTypeId(String(displayedEntityTypes[0].id));
      }
    }
  }, [selectedEntityTypeId, displayedEntityTypes, setSelectedEntityTypeId]);

  const { data: billing } = useTenantBilling();
  const { isSovereignCustodian } = usePermissions();
  const maxSchemas = isSovereignCustodian ? -1 : (billing?.quotas?.maxSchemas ?? 50);
  const isUnlimitedSchemas = maxSchemas === -1;
  const isQuotaExceeded = !isUnlimitedSchemas && totalElements >= maxSchemas;

  return (
    <aside aria-label="Entity Models Rail" className="w-full lg:w-76 shrink-0 flex flex-col gap-3 p-4 rounded-2xl bg-white/45 dark:bg-slate-900/45 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/25 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Database className="h-5 w-5 text-primary shrink-0" />
          <h2 className="font-bold text-foreground text-sm tracking-tight truncate">Entity Models</h2>
          <Badge 
            variant={isQuotaExceeded ? "destructive" : "secondary"} 
            className="text-[10px] h-5 px-1.5 font-mono shrink-0 flex items-center gap-0.5"
            title={
              isUnlimitedSchemas
                ? `Unlimited models tier (${totalElements} active)`
                : isQuotaExceeded
                ? `Maximum limit of ${maxSchemas} models reached`
                : `${totalElements} of ${maxSchemas} models used`
            }
          >
            <span>{totalElements}</span>
            <span>/</span>
            {isUnlimitedSchemas ? (
              <InfinityIcon className="h-3 w-3 inline text-emerald-500" />
            ) : (
              <span>{maxSchemas}</span>
            )}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsMobileExpanded((prev) => !prev)}
            className="h-8 px-2 text-xs lg:hidden text-muted-foreground hover:text-foreground"
            title={isMobileExpanded ? 'Collapse Models Rail' : 'Expand Models Rail'}
          >
            {isMobileExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          {canManageSchema() && (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={openBlueprintGallery}
                disabled={isQuotaExceeded}
                className="h-8 px-2 gap-1 text-xs bg-white/40 dark:bg-white/5 border-white/20 shrink-0 text-blue-600 dark:text-blue-400 hover:text-blue-700 disabled:opacity-50"
                title={isQuotaExceeded ? `Model quota reached (${maxSchemas} max)` : "Browse Domain Blueprint Catalog"}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Templates</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={openCreateEntityTypeDialog}
                disabled={isQuotaExceeded}
                className="h-8 px-2 gap-1 text-xs bg-white/40 dark:bg-white/5 border-white/20 shrink-0 disabled:opacity-50"
                title={isQuotaExceeded ? `Model quota reached (${maxSchemas} max)` : "Create New Entity Model"}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New</span>
              </Button>
            </div>
          )}
        </div>
      </div>


      <div className={cn('flex flex-col gap-3 flex-1 min-h-0', !isMobileExpanded && 'max-lg:hidden')}>
        {/* Search Filter */}
      <div className="relative shrink-0">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter models (e.g. cluster, vpc)..."
          className="pl-8 pr-7 h-8 text-xs bg-white/50 dark:bg-white/5 border-white/20"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2 top-2 p-0.5 text-muted-foreground hover:text-foreground"
            title="Clear filter"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Composite Entities Filter Toggle */}
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-white/15 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-foreground">Composite Entities</span>
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] font-mono px-1.5 py-0 h-4 rounded-md',
              compositeCount > 0
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'text-muted-foreground border-border'
            )}
          >
            {compositeCount}
          </Badge>
        </div>
        <Switch
          checked={compositeOnly}
          onCheckedChange={handleToggleCompositeOnly}
          aria-label="Filter Composite Entities Only"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 min-h-[220px] max-h-[400px] lg:max-h-none pr-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-8 text-xs text-muted-foreground gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Loading models...</span>
          </div>
        ) : displayedEntityTypes.length === 0 ? (
          <div className="text-xs text-muted-foreground p-6 text-center">
            {compositeOnly
              ? 'No composite entities found.'
              : debouncedSearch
              ? `No models matching "${debouncedSearch}".`
              : 'No entity models yet.'}
          </div>
        ) : (
          displayedEntityTypes.map((et: EntityType) => {
            const isSelected = String(selectedEntityTypeId) === String(et.id);

            return (
              <div
                key={et.id}
                onClick={() => {
                  setSelectedEntityTypeId(String(et.id));
                  setIsMobileExpanded(false);
                }}
                className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-all ${
                  isSelected
                    ? 'bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20'
                    : 'hover:bg-white/40 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex flex-col gap-0.5 truncate pr-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="truncate">{et.name}</span>
                    {et.isComposite && (
                      <span
                        className={cn(
                          'text-[9px] font-mono font-semibold px-1 py-0.2 rounded uppercase tracking-wider shrink-0 border',
                          isSelected
                            ? 'bg-white/20 text-white border-white/30'
                            : 'bg-primary/10 text-primary border-primary/20'
                        )}
                      >
                        Composite
                      </span>
                    )}
                  </div>
                  <span
                    className={`font-mono text-[10px] truncate ${
                      isSelected ? 'text-primary-foreground/75' : 'text-muted-foreground/80'
                    }`}
                  >
                    {et.systemName}
                  </span>
                </div>

                {canManageSchema() && (
                  <div
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={`p-1 rounded min-h-[28px] min-w-[28px] flex items-center justify-center hover:bg-white/20 ${
                            isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
                          }`}
                          aria-label={`Actions for ${et.name}`}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs">
                        <DropdownMenuItem
                          onClick={() => openEditEntityTypeDialog(et)}
                          className="gap-2"
                        >
                          <Edit2 className="h-3.5 w-3.5" /> Edit Model
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openDeleteEntityTypeDialog(et)}
                          className="gap-2 text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete Model
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Compact Sidebar Pagination Footer */}
      <div className="pt-2 border-t border-white/20 dark:border-white/10 flex items-center justify-between text-xs select-none shrink-0">
        {/* Left: Compact page size & page position */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Select
            value={String(pageSize)}
            onValueChange={(val) => {
              setPageSize(Number(val));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-6 w-[54px] text-[11px] px-1.5 py-0 bg-white/40 dark:bg-white/5 border-white/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="text-xs min-w-[3.5rem]">
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[11px] font-mono text-muted-foreground">
            {page}/{totalPages}
          </span>
        </div>

        {/* Right: Streamlined Navigation (First, Prev, Next, Last) */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage(1)}
            disabled={page <= 1}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground disabled:opacity-25"
            title="First page"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground disabled:opacity-25"
            title="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground disabled:opacity-25"
            title="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground disabled:opacity-25"
            title="Last page"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      </div>
    </aside>
  );
};

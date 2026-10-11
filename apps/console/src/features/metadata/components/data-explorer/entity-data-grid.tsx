import React, { useMemo, useState } from 'react';
import {
  useEntityRecords,
  useAttributeDefinitions,
  useEntityType,
  useSchemaDriftAnalysis,
  useExecuteSchemaBackfill,
  useEntityFacets,
} from '../../api/metadata-api';
import { useMetadataUiStore, type AttributeFilterClause } from '../../store/use-metadata-ui-store';
import type { AttributeDefinition, EntityRecord } from '../../api/types';
import { RecordEditorDialog } from './record-editor-dialog';
import { RecordDeleteDialog } from './record-delete-dialog';
import { RawJsonDialog } from './raw-json-dialog';
import { AdvancedFilterPopover } from './advanced-filter-popover';
import { FacetedSearchSidebar } from './faceted-search-sidebar';
import { SchemaBackfillDialog } from './schema-backfill-dialog';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Search,
  Download,
  MoreVertical,
  Edit2,
  Trash2,
  Code,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Database,
  X,
  GitFork,
  Link2,
  SlidersHorizontal,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

interface Props {
  entityTypeId: string | number;
  showFacetedSidebar?: boolean;
  defaultFacetOpen?: boolean;
}

const columnHelper = createColumnHelper<EntityRecord>();

export const EntityDataGrid: React.FC<Props> = ({
  entityTypeId,
  showFacetedSidebar = true,
  defaultFacetOpen = false,
}) => {
  const [isFacetOpen, setIsFacetOpen] = useState(defaultFacetOpen);
  const {
    openCreateRecordDialog,
    openEditRecordDialog,
    openDeleteRecordDialog,
    openRecordRelationshipsInspector,
    gridStateByModel,
    setGridState,
  } = useMetadataUiStore();

  // Read current model's grid state or fallback to defaults
  const currentGridState = gridStateByModel[String(entityTypeId)] || {
    searchFilter: '',
    attributeFilters: [],
    page: 1,
    pageSize: 10,
    sortField: null,
    sortDirection: 'asc' as const,
  };

  const page = currentGridState.page;
  const pageSize = currentGridState.pageSize;
  const searchFilter = currentGridState.searchFilter;
  const attributeFilters = useMemo(
    () => currentGridState.attributeFilters || [],
    [currentGridState.attributeFilters]
  );
  const sortField = currentGridState.sortField;
  const sortDirection = currentGridState.sortDirection;

  // Local immediate input state to prevent typing lag and rapid re-renders
  const [localSearchInput, setLocalSearchInput] = useState(searchFilter);
  const [debouncedSearch, setDebouncedSearch] = useState(searchFilter);
  const [inspectingRecord, setInspectingRecord] = useState<EntityRecord | null>(null);

  // Keep local search input synchronized if searchFilter changes externally
  React.useEffect(() => {
    setLocalSearchInput(searchFilter);
  }, [searchFilter]);

  const { data: attributesResponse, isLoading: schemaLoading } =
    useAttributeDefinitions(entityTypeId);
  const { data: entityType } = useEntityType(entityTypeId);
  const { data: driftAnalysis } = useSchemaDriftAnalysis(entityTypeId);
  const backfillMutation = useExecuteSchemaBackfill(entityTypeId);
  const [backfillFeedback, setBackfillFeedback] = useState<string | null>(null);
  const [isBackfillDialogOpen, setIsBackfillDialogOpen] = useState<boolean>(false);

  const attributes = useMemo(() => {
    return attributesResponse?.content || [];
  }, [attributesResponse]);

  const handleConfirmBackfill = async (batchSize: number) => {
    setBackfillFeedback(null);
    try {
      const res = await backfillMutation.mutateAsync(batchSize);
      setBackfillFeedback(
        `Successfully backfilled ${res.migratedRecords} record(s) to Schema v${res.targetSchemaVersion}.`
      );
    } catch (err: unknown) {
      setBackfillFeedback(err instanceof Error ? err.message : 'Backfill failed.');
    }
  };

  // Debounce search filter input (600ms comfortable cadence)
  React.useEffect(() => {
    const handler = setTimeout(() => {
      const trimmed = localSearchInput.trim();
      setDebouncedSearch(trimmed);
      if (trimmed !== searchFilter) {
        setGridState(entityTypeId, { searchFilter: trimmed, page: 1 });
      }
    }, 600);
    return () => clearTimeout(handler);
  }, [localSearchInput, searchFilter, entityTypeId, setGridState]);

  const handleSearchChange = (val: string) => {
    setLocalSearchInput(val);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = localSearchInput.trim();
      setDebouncedSearch(trimmed);
      setGridState(entityTypeId, { searchFilter: trimmed, page: 1 });
    }
  };

  const handleClearSearch = () => {
    setLocalSearchInput('');
    setDebouncedSearch('');
    setGridState(entityTypeId, { searchFilter: '', page: 1 });
  };

  const handleAttributeFiltersChange = (newFilters: AttributeFilterClause[]) => {
    setGridState(entityTypeId, { attributeFilters: newFilters, page: 1 });
  };

  const handleRemoveAttributeFilter = (filterId: string) => {
    const updated = attributeFilters.filter((f) => f.id !== filterId);
    setGridState(entityTypeId, { attributeFilters: updated, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    setGridState(entityTypeId, { page: newPage });
  };

  const handlePageSizeChange = (newSize: number) => {
    setGridState(entityTypeId, { pageSize: newSize, page: 1 });
  };

  // Construct server-side filters & sort
  const queryParams = useMemo(() => {
    const params: {
      number: number;
      size: number;
      sort?: string;
      tenantId?: string;
      filters?: Record<string, string | Record<string, string>>;
    } = {
      number: page,
      size: pageSize,
    };

    if (sortField) {
      params.sort = `${sortField},${sortDirection}`;
    }

    const filtersObj: Record<string, Record<string, string>> = {};

    // 1. Incorporate compound attribute filters & facets
    const fieldValuesMap: Record<string, { eqValues: string[]; otherOps: Record<string, string> }> = {};

    attributeFilters.forEach((clause) => {
      if (!clause.field || clause.value === undefined || clause.value === '') return;

      if (!fieldValuesMap[clause.field]) {
        fieldValuesMap[clause.field] = { eqValues: [], otherOps: {} };
      }
      if (clause.operator === 'eq') {
        fieldValuesMap[clause.field].eqValues.push(clause.value);
      } else {
        fieldValuesMap[clause.field].otherOps[clause.operator] = clause.value;
      }
    });

    Object.entries(fieldValuesMap).forEach(([field, { eqValues, otherOps }]) => {
      if (!filtersObj[field]) {
        filtersObj[field] = {};
      }
      if (eqValues.length === 1) {
        filtersObj[field].eq = eqValues[0];
      } else if (eqValues.length > 1) {
        filtersObj[field].in = eqValues.join(',');
      }
      Object.entries(otherOps).forEach(([op, val]) => {
        filtersObj[field][op] = val;
      });
    });

    // 2. Incorporate quick search filter
    if (debouncedSearch) {
      // Find searchable string attributes to apply server filter
      const stringAttrs = attributes.filter(
        (a) => !a.isArchived && (a.dataType === 'STRING' || a.uiComponent === 'text')
      );
      if (stringAttrs.length > 0) {
        const targetAttr =
          stringAttrs.find((a) =>
            ['name', 'legal_name', 'title', 'code', 'label'].includes(a.systemName.toLowerCase())
          ) || stringAttrs[0];
        if (!filtersObj[targetAttr.systemName]) {
          filtersObj[targetAttr.systemName] = {};
        }
        filtersObj[targetAttr.systemName].contains = debouncedSearch;
      } else {
        if (!filtersObj.id) {
          filtersObj.id = {};
        }
        filtersObj.id.eq = debouncedSearch;
      }
    }

    if (Object.keys(filtersObj).length > 0) {
      params.filters = filtersObj;
    }

    return params;
  }, [page, pageSize, sortField, sortDirection, debouncedSearch, attributeFilters, attributes]);

  const { data: recordsResponse, isLoading: recordsLoading } = useEntityRecords(
    entityTypeId,
    queryParams
  );

  // Fetch server-aggregated facet counts if enabled/available
  const { data: serverFacets } = useEntityFacets(
    isFacetOpen ? entityTypeId : null
  );

  const records = useMemo(() => {
    return recordsResponse?.content || [];
  }, [recordsResponse]);

  const handleSortToggle = (field: string) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setGridState(entityTypeId, { sortField: field, sortDirection: 'desc', page: 1 });
      } else {
        setGridState(entityTypeId, { sortField: null, sortDirection: 'asc', page: 1 });
      }
    } else {
      setGridState(entityTypeId, { sortField: field, sortDirection: 'asc', page: 1 });
    }
  };

  const columns = useMemo(() => {
    const baseCols = [
      columnHelper.accessor('id', {
        header: () => (
          <button
            type="button"
            onClick={() => handleSortToggle('id')}
            aria-label={`Sort by ID ${sortField === 'id' ? (sortDirection === 'asc' ? 'descending' : 'ascending') : 'ascending'}`}
            className="flex items-center gap-1.5 font-semibold text-muted-foreground uppercase tracking-wider text-[11px] hover:text-foreground transition-colors group"
          >
            <span>ID</span>
            {sortField === 'id' ? (
              sortDirection === 'asc' ? (
                <ArrowUp className="h-3 w-3 text-primary" aria-hidden="true" />
              ) : (
                <ArrowDown className="h-3 w-3 text-primary" aria-hidden="true" />
              )
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" aria-hidden="true" />
            )}
          </button>
        ),
        cell: (info) => (
          <code className="font-mono text-xs text-muted-foreground bg-muted/60 dark:bg-white/5 px-1.5 py-0.5 rounded">
            #{String(info.getValue())}
          </code>
        ),
      }),
    ];

    const dynamicCols = attributes
      .filter((attr) => !attr.isArchived)
      .map((attr: AttributeDefinition) =>
        columnHelper.accessor(
          (row) => row.attributes?.[attr.systemName],
          {
            id: attr.systemName,
            header: () => (
              <button
                type="button"
                onClick={() => handleSortToggle(attr.systemName)}
                aria-label={`Sort by ${attr.name} ${sortField === attr.systemName ? (sortDirection === 'asc' ? 'descending' : 'ascending') : 'ascending'}`}
                className="flex items-center gap-1.5 font-semibold text-muted-foreground uppercase tracking-wider text-[11px] hover:text-foreground transition-colors group"
              >
                <span>{attr.name}</span>
                {sortField === attr.systemName ? (
                  sortDirection === 'asc' ? (
                    <ArrowUp className="h-3 w-3 text-primary" aria-hidden="true" />
                  ) : (
                    <ArrowDown className="h-3 w-3 text-primary" aria-hidden="true" />
                  )
                ) : (
                  <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" aria-hidden="true" />
                )}
              </button>
            ),
            cell: (info) => {
              const val = info.getValue();
              if (val === null || val === undefined || val === '') {
                return <span className="text-muted-foreground/60 text-xs">-</span>;
              }

              if (typeof val === 'boolean') {
                return (
                  <Badge
                    variant={val ? 'secondary' : 'outline'}
                    className={`text-[10px] ${val ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''
                      }`}
                  >
                    {val ? 'True' : 'False'}
                  </Badge>
                );
              }

              if (Array.isArray(val)) {
                return (
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {val.map((item, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 border border-white/10"
                      >
                        {String(item)}
                      </span>
                    ))}
                  </div>
                );
              }

              if (typeof val === 'object') {
                return (
                  <code className="text-[10px] font-mono text-muted-foreground truncate max-w-[120px] inline-block">
                    {JSON.stringify(val)}
                  </code>
                );
              }

              if (attr.uiComponent === 'relation_picker') {
                return (
                  <Badge
                    variant="outline"
                    className="gap-1 font-mono text-[11px] bg-primary/5 hover:bg-primary/10 border-primary/25 text-primary cursor-default"
                  >
                    <Link2 className="h-3 w-3 shrink-0 opacity-70" />
                    <span>#{String(val)}</span>
                  </Badge>
                );
              }

              return (
                <span className="text-xs text-foreground truncate max-w-xs inline-block">
                  {String(val)}
                </span>
              );
            },
          }
        )
      );

    const actionCol = columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Actions for record #${String(row.original.id)}`}
                className="liquid-glass-interactive h-7 w-7 p-0 rounded-lg border border-white/20 dark:border-white/10 text-muted-foreground hover:text-foreground active:scale-95 shadow-xs"
              >
                <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              <DropdownMenuItem
                onClick={() => openEditRecordDialog(row.original)}
                className="gap-2"
              >
                <Edit2 className="h-3.5 w-3.5" /> Edit Record
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => openRecordRelationshipsInspector(row.original)}
                className="gap-2 text-primary focus:text-primary"
              >
                <GitFork className="h-3.5 w-3.5" /> Connected Edges
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setInspectingRecord(row.original)}
                className="gap-2"
              >
                <Code className="h-3.5 w-3.5" /> View Raw JSON
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => openDeleteRecordDialog(row.original)}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Record
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    });

    return [...baseCols, ...dynamicCols, actionCol];
  }, [attributes, sortField, sortDirection, openEditRecordDialog, openDeleteRecordDialog, openRecordRelationshipsInspector]);

  const table = useReactTable({
    data: records,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleExportJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(records, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `${entityType?.systemName || 'records'}_export_${Date.now()}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const totalRecords = recordsResponse?.totalElements ?? records.length;
  const totalPages = recordsResponse?.totalPages ?? (Math.ceil(totalRecords / pageSize) || 1);

  if (recordsLoading || schemaLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm">Loading records and schema...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full min-w-0 flex-1 min-h-0">
      {/* Schema Drift Warning & Backfill Banner */}
      {driftAnalysis && driftAnalysis.outdatedRecords > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 backdrop-blur-xl animate-in fade-in-50 shrink-0">
          <div className="flex items-center gap-2.5 text-xs">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>Schema Drift Detected:</strong> {driftAnalysis.outdatedRecords} of{' '}
              {driftAnalysis.totalRecords} record(s) conform to older schema versions (Current:{' '}
              <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-mono border-amber-500/40">
                v{driftAnalysis.currentSchemaVersion}
              </Badge>
              ).
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {backfillFeedback && (
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                {backfillFeedback}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsBackfillDialogOpen(true)}
              disabled={backfillMutation.isPending}
              className="h-7 px-2.5 text-xs gap-1.5 border-amber-500/30 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200"
              title="Review potential changes and migrate records to current schema version"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', backfillMutation.isPending && 'animate-spin')} />
              <span>{backfillMutation.isPending ? 'Migrating...' : 'Run Backfill'}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Action Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white/45 dark:bg-slate-900/45 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/25 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={localSearchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search (type or press Enter)..."
              className="pl-8 pr-8 h-9 text-xs bg-white/50 dark:bg-white/5 border-white/20"
            />
            {localSearchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Advanced Multi-Attribute Compound Filter Popover */}
          <AdvancedFilterPopover
            attributes={attributes}
            filters={attributeFilters}
            onChange={handleAttributeFiltersChange}
          />

          {/* Faceted Search Sidebar Toggle Button */}
          {showFacetedSidebar && (
            <Button
              variant={isFacetOpen ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsFacetOpen(!isFacetOpen)}
              aria-label="Toggle Faceted Search sidebar"
              className={cn(
                'h-9 gap-1.5 text-xs transition-all font-medium',
                isFacetOpen
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90'
                  : 'bg-white/40 dark:bg-white/5 border-white/20 text-muted-foreground hover:text-foreground'
              )}
              title="Toggle Faceted Search sidebar"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Facets</span>
            </Button>
          )}

          <Badge variant="secondary" className="text-xs">
            {totalRecords} {totalRecords === 1 ? 'Record' : 'Records'}
          </Badge>
          {sortField && (
            <Badge variant="outline" className="text-xs gap-1 font-mono">
              <span>sort: {sortField}</span>
              <span>({sortDirection})</span>
              <button
                type="button"
                onClick={() => {
                  setGridState(entityTypeId, {
                    sortField: null,
                    sortDirection: 'asc',
                    page: 1,
                  });
                }}
                className="ml-1 hover:text-destructive"
                aria-label="Clear active sorting"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJson}
            disabled={records.length === 0}
            aria-label="Export entity records as JSON"
            className="h-9 gap-1.5 text-xs bg-white/40 dark:bg-white/5 border-white/20"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Export JSON</span>
          </Button>

          <Button
            size="sm"
            onClick={openCreateRecordDialog}
            className="h-9 gap-1.5 text-xs shadow-md shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            <span>New Record</span>
          </Button>
        </div>
      </div>

      {/* Active Filter Chips / Pills */}
      {attributeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1 shrink-0">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Active Filters:
          </span>
          {attributeFilters.map((clause) => {
            const attr = attributes.find((a) => a.systemName === clause.field);
            return (
              <Badge
                key={clause.id}
                variant="secondary"
                className="gap-1.5 py-1 px-2.5 text-xs bg-primary/10 text-primary border-primary/20 shadow-xs"
              >
                <span className="font-semibold">{attr?.name || clause.field}</span>
                <span className="text-[10px] opacity-75 font-mono">[{clause.operator}]</span>
                <span className="font-mono text-foreground">{clause.value}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttributeFilter(clause.id)}
                  className="ml-1 hover:text-destructive transition-colors"
                  aria-label={`Remove filter for ${attr?.name || clause.field}`}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </Badge>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleAttributeFiltersChange([])}
            aria-label="Clear all active filters"
            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Table Canvas with Optional Faceted Search Sidebar & Horizontal Overflow */}
      <div className="flex flex-col lg:flex-row items-stretch gap-4 w-full min-w-0 flex-1 min-h-0">
        {showFacetedSidebar && isFacetOpen && (
          <FacetedSearchSidebar
            attributes={attributes}
            records={records}
            activeFilters={attributeFilters}
            onFilterChange={handleAttributeFiltersChange}
            serverFacets={serverFacets}
            onClose={() => setIsFacetOpen(false)}
            className="w-full lg:w-72 shrink-0 animate-in fade-in slide-in-from-left-2 duration-200"
          />
        )}

        <div className="flex-1 min-w-0 w-full rounded-2xl bg-white/45 dark:bg-slate-900/45 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/25 flex flex-col overflow-hidden max-lg:min-h-[420px] lg:min-h-0">
          <div className="overflow-x-auto overflow-y-auto relative w-full flex-1 min-h-0">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md shadow-xs">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr
                    key={headerGroup.id}
                    className="border-b border-border"
                  >
                    {headerGroup.headers.map((header) => {
                      const isAction = header.column.id === 'actions';
                      const colId = header.column.id;
                      const isSortable = colId !== 'actions';
                      const ariaSort = isSortable
                        ? sortField === colId
                          ? sortDirection === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                        : undefined;

                      return (
                        <th
                          key={header.id}
                          scope="col"
                          aria-sort={ariaSort}
                          className={cn(
                            'p-3 font-semibold text-muted-foreground uppercase tracking-wider text-[11px] whitespace-nowrap',
                            isAction &&
                            'sticky right-0 z-20 w-12 backdrop-blur-xl border-l border-white/30 dark:border-white/10 shadow-[-8px_0_20px_-4px_rgba(0,0,0,0.08),inset_1px_0_1px_0_rgba(255,255,255,0.4)] dark:shadow-[-8px_0_20px_-4px_rgba(0,0,0,0.5),inset_1px_0_1px_0_rgba(255,255,255,0.08)]'
                          )}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="group border-b border-white/10 hover:bg-white/40 dark:hover:bg-white/5 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isAction = cell.column.id === 'actions';
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            'p-3 whitespace-nowrap',
                            isAction &&
                            'sticky right-0 z-10 w-12 group-hover:bg-white/85 dark:group-hover:bg-slate-800/85 backdrop-blur-xl border-l border-white/30 dark:border-white/10 shadow-[-8px_0_20px_-4px_rgba(0,0,0,0.08),inset_1px_0_1px_0_rgba(255,255,255,0.4)] dark:shadow-[-8px_0_20px_-4px_rgba(0,0,0,0.5),inset_1px_0_1px_0_rgba(255,255,255,0.08)] transition-[background-color,backdrop-filter] duration-150'
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {table.getRowModel().rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="p-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Database className="h-8 w-8 text-muted-foreground/50 mb-1" />
                        <p className="font-semibold text-sm">No records found</p>
                        <p className="text-xs">
                          {searchFilter
                            ? `No records matching "${searchFilter}".`
                            : 'Create your first entity record using the button above.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t border-white/10 bg-white/30 dark:bg-slate-850/30 shrink-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Show</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  handlePageSizeChange(Number(val));
                }}
              >
                <SelectTrigger className="h-7 w-18 text-xs bg-white/50 dark:bg-white/5 border-white/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span>per page</span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">
                Page <span className="font-semibold text-foreground">{page}</span> of{' '}
                <span className="font-semibold text-foreground">{totalPages}</span>
                {totalRecords > 0 && (
                  <span className="ml-1 text-muted-foreground/80">
                    ({totalRecords.toLocaleString()} {totalRecords === 1 ? 'record' : 'records'})
                  </span>
                )}
              </span>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={page <= 1}
                  aria-label="Go to first page"
                  className="h-7 w-7 p-0 bg-white/40 dark:bg-white/5"
                  title="First page"
                >
                  <ChevronsLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  aria-label="Go to previous page"
                  className="h-7 w-7 p-0 bg-white/40 dark:bg-white/5"
                  title="Previous page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  aria-label="Go to next page"
                  className="h-7 w-7 p-0 bg-white/40 dark:bg-white/5"
                  title="Next page"
                >
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={page >= totalPages}
                  aria-label="Go to last page"
                  className="h-7 w-7 p-0 bg-white/40 dark:bg-white/5"
                  title="Last page"
                >
                  <ChevronsRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <RecordEditorDialog entityTypeId={entityTypeId} />
      <RecordDeleteDialog entityTypeId={entityTypeId} />
      <RawJsonDialog
        record={inspectingRecord}
        open={Boolean(inspectingRecord)}
        onOpenChange={(open) => !open && setInspectingRecord(null)}
      />
      <SchemaBackfillDialog
        open={isBackfillDialogOpen}
        onOpenChange={setIsBackfillDialogOpen}
        entityType={entityType}
        driftAnalysis={driftAnalysis}
        attributes={attributes}
        onConfirm={handleConfirmBackfill}
        isPending={backfillMutation.isPending}
      />
    </div>
  );
};

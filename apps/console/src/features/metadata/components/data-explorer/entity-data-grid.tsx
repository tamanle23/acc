import React, { useMemo, useState } from 'react';
import {
  useEntityRecords,
  useAttributeDefinitions,
  useEntityType,
  useSchemaDriftAnalysis,
  useExecuteSchemaBackfill,
  useEntityFacets,
  useTransitionEntityRecord,
  useCompositeRecords,
} from '../../api/metadata-api';
import { useMetadataUiStore, type AttributeFilterClause } from '../../store/use-metadata-ui-store';
import type { AttributeDefinition, EntityRecord } from '../../api/types';
import { RecordEditorDialog } from './record-editor-dialog';
import { RecordDeleteDialog } from './record-delete-dialog';
import { RawJsonDialog } from './raw-json-dialog';
import { AdvancedFilterPopover } from './advanced-filter-popover';
import { FacetedSearchSidebar } from './faceted-search-sidebar';
import { SchemaBackfillDialog } from './schema-backfill-dialog';
import { RecordAuditHistoryDrawer } from '../records/record-audit-history-drawer';
import { CompositeMasterDetailRow } from './composite-master-detail-row';
import { DynamicQueryBuilder } from './query-builder/dynamic-query-builder';
import { TableViewsPopover, type GridDensity, type ViewPreset } from './table-views-popover';
import { MasterDetailRowInspector } from './master-detail-row-inspector';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type VisibilityState,
  type Header,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DataTableViewOptions } from '@/components/data-table/view-options';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
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
  History,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Database,
  X,
  GitFork,
  Link2,
  SlidersHorizontal,
  RefreshCw,
  ShieldAlert,
  Play,
  CheckCircle2,
  Send,
  Check,
  Zap,
  PauseCircle,
  Archive,
  Ban,
  RotateCcw,
  Rocket,
  ShieldCheck,
  ArrowRight,
  GripVertical,
} from 'lucide-react';

interface DraggableHeaderCellProps {
  header: Header<EntityRecord, unknown>;
  density: GridDensity;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  onSortToggle: (id: string) => void;
}

const DraggableHeaderCell: React.FC<DraggableHeaderCellProps> = ({
  header,
  density,
  sortField,
  sortDirection,
  onSortToggle,
}) => {
  const colId = header.column.id;
  const isPinned = colId === 'actions' || colId === 'row_index' || colId === 'expander';

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: colId,
    disabled: isPinned,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  const isSortable = !isPinned;
  const ariaSort = isSortable
    ? sortField === colId
      ? sortDirection === 'asc'
        ? 'ascending'
        : 'descending'
      : 'none'
    : undefined;

  return (
    <th
      ref={setNodeRef}
      style={style}
      scope="col"
      aria-sort={ariaSort}
      className={cn(
        'font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap bg-white/95 dark:bg-slate-800/95 backdrop-blur-md select-none',
        density === 'compact'
          ? 'py-1.5 px-2 text-[10px]'
          : density === 'spacious'
            ? 'py-3.5 px-3.5 text-xs'
            : 'p-3 text-[11px]',
        colId === 'row_index' &&
          'sticky left-0 z-40 w-12 text-center border-r border-white/20 dark:border-white/10 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.06)]',
        colId === 'actions' &&
          'sticky right-0 z-40 w-12 border-l border-white/30 dark:border-white/10 shadow-[-8px_0_20px_-4px_rgba(0,0,0,0.08),inset_1px_0_1px_0_rgba(255,255,255,0.4)] dark:shadow-[-8px_0_20px_-4px_rgba(0,0,0,0.5),inset_1px_0_1px_0_rgba(255,255,255,0.08)]'
      )}
    >
      <div className="flex items-center gap-1.5">
        {!isPinned && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground p-0.5 rounded"
            title="Drag column header to reorder"
            aria-label={`Drag ${colId} column to reorder`}
          >
            <GripVertical className="size-3" />
          </button>
        )}
        <div className="flex-1">
          {header.isPlaceholder
            ? null
            : flexRender(header.column.columnDef.header, header.getContext())}
        </div>
      </div>
    </th>
  );
};

/**
 * Returns contextual icon and Liquid Glass styling for FSM transition actions.
 */
function getTransitionActionVisual(action: string, targetState: string) {
  const normAction = action.toUpperCase();
  const normTarget = targetState.toUpperCase();

  if (normAction.includes('SUBMIT') || normAction.includes('SEND')) {
    return {
      icon: Send,
      iconClass: 'text-sky-500 dark:text-sky-400',
      badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/20',
    };
  }
  if (normAction.includes('APPROVE') || normAction.includes('VERIFY') || normAction.includes('VALIDATE')) {
    return {
      icon: ShieldCheck,
      iconClass: 'text-emerald-500 dark:text-emerald-400',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
    };
  }
  if (normAction.includes('ACTIVATE') || normAction.includes('PROVISION') || normAction.includes('DEPLOY') || normAction.includes('PUBLISH')) {
    return {
      icon: Rocket,
      iconClass: 'text-indigo-500 dark:text-indigo-400',
      badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20',
    };
  }
  if (normAction.includes('ENFORCE') || normAction.includes('STAGE')) {
    return {
      icon: Zap,
      iconClass: 'text-amber-500 dark:text-amber-400',
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20',
    };
  }
  if (normAction.includes('SUSPEND') || normAction.includes('PAUSE') || normAction.includes('HOLD')) {
    return {
      icon: PauseCircle,
      iconClass: 'text-amber-500 dark:text-amber-400',
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20',
    };
  }
  if (normAction.includes('REACTIVATE') || normAction.includes('RESUME') || normAction.includes('REINSTATE') || normAction.includes('REOPEN') || normAction.includes('REVERT')) {
    return {
      icon: RotateCcw,
      iconClass: 'text-teal-500 dark:text-teal-400',
      badgeClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-300 border-teal-500/20',
    };
  }
  if (normAction.includes('ARCHIVE') || normAction.includes('RETIRE') || normAction.includes('DEPRECATE')) {
    return {
      icon: Archive,
      iconClass: 'text-purple-500 dark:text-purple-400',
      badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/20',
    };
  }
  if (normAction.includes('REJECT') || normAction.includes('CANCEL') || normAction.includes('CLOSE') || normAction.includes('TERMINATE') || normAction.includes('DECOMMISSION')) {
    return {
      icon: Ban,
      iconClass: 'text-rose-500 dark:text-rose-400',
      badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/20',
    };
  }
  if (normTarget.includes('ACTIVE') || normTarget.includes('APPROVED')) {
    return {
      icon: Check,
      iconClass: 'text-emerald-500 dark:text-emerald-400',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
    };
  }

  return {
    icon: Play,
    iconClass: 'text-primary',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
  };
}

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
  const [auditRecord, setAuditRecord] = useState<EntityRecord | null>(null);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string | number>>(new Set());

  // Column visibility state for toggle views
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Grid Density (compact: 36px, comfortable: 48px, spacious: 60px)
  const [density, setDensity] = useState<GridDensity>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('unipost_density_profile');
      if (saved === 'compact' || saved === 'comfortable' || saved === 'spacious') {
        return saved as GridDensity;
      }
    }
    return 'comfortable';
  });

  const handleDensityChange = (newDensity: GridDensity) => {
    setDensity(newDensity);
    if (typeof window !== 'undefined') {
      localStorage.setItem('unipost_density_profile', newDensity);
    }
  };

  // Drag-and-drop column ordering state
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // Master-Detail Row Inspector state & keyboard navigation
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [masterDetailRecord, setMasterDetailRecord] = useState<EntityRecord | null>(null);
  const [isMasterDetailOpen, setIsMasterDetailOpen] = useState(false);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Horizontal scroll cue detection for high-density tables (e.g. 100+ columns)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = React.useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  const toggleRowExpanded = (id: string | number) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Keep local search input synchronized if searchFilter changes externally
  React.useEffect(() => {
    setLocalSearchInput(searchFilter);
  }, [searchFilter]);

  const { data: attributesResponse, isLoading: schemaLoading } =
    useAttributeDefinitions(entityTypeId, { size: 500 });
  const { data: entityType } = useEntityType(entityTypeId);
  const { data: driftAnalysis } = useSchemaDriftAnalysis(entityTypeId);
  const backfillMutation = useExecuteSchemaBackfill(entityTypeId);
  const transitionMutation = useTransitionEntityRecord(entityTypeId);
  const [backfillFeedback, setBackfillFeedback] = useState<string | null>(null);
  const [isBackfillDialogOpen, setIsBackfillDialogOpen] = useState<boolean>(false);

  const handleRecordTransition = async (recordId: string | number, action: string, targetState: string) => {
    try {
      await transitionMutation.mutateAsync({
        recordId,
        action,
      });
      toast.success(`Record transitioned via '${action}' to state: ${targetState}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Failed to transition record via '${action}'`);
    }
  };

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

  const isComposite = Boolean(entityType?.isComposite && entityType?.compositeSpec);

  const { data: standardRecordsResponse, isLoading: standardLoading } = useEntityRecords(
    !isComposite ? entityTypeId : null,
    queryParams
  );
  const { data: compositeRecordsResponse, isLoading: compositeLoading } = useCompositeRecords(
    isComposite ? entityTypeId : null,
    queryParams
  );

  const recordsLoading = isComposite ? compositeLoading : standardLoading;
  const recordsResponse = isComposite ? (compositeRecordsResponse as any) : standardRecordsResponse;

  // Fetch server-aggregated facet counts if enabled/available
  const { data: serverFacets } = useEntityFacets(
    isFacetOpen ? entityTypeId : null
  );

  const records = useMemo(() => {
    return recordsResponse?.content || [];
  }, [recordsResponse]);

  const hasAutoExpandedRef = React.useRef<string | null>(null);

  // Auto-expand the first composite record once on initial load when viewing a composite entity
  React.useEffect(() => {
    if (isComposite && records.length > 0 && hasAutoExpandedRef.current !== entityTypeId) {
      hasAutoExpandedRef.current = entityTypeId;
      setExpandedRowIds(new Set([records[0].id]));
    }
  }, [isComposite, records, entityTypeId]);

  // Dynamic horizontal scroll cue observer for wide columns
  React.useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    const resizeObserver = new ResizeObserver(() => checkScroll());
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', checkScroll);
      resizeObserver.disconnect();
    };
  }, [checkScroll, records.length, attributes.length]);

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
    const expanderCol = isComposite
      ? [
          columnHelper.display({
            id: 'expander',
            header: () => <span className="sr-only">Expand</span>,
            cell: ({ row }) => {
              const rowId = row.original.id;
              const isExpanded = expandedRowIds.has(rowId);
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleRowExpanded(rowId);
                  }}
                  aria-label={
                    isExpanded
                      ? 'Collapse composite sub-collections'
                      : 'Expand composite sub-collections'
                  }
                  className="p-1 rounded-md hover:bg-white/40 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-primary" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              );
            },
            size: 36,
          }),
        ]
      : [];

    const rowIndexCol = [
      columnHelper.display({
        id: 'row_index',
        header: () => (
          <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] font-mono select-none">
            #
          </span>
        ),
        cell: ({ row }) => {
          const calculatedIndex = (page - 1) * pageSize + row.index + 1;
          return (
            <span
              className="font-mono text-[11px] text-muted-foreground/80 font-medium select-none"
              title={`Row #${calculatedIndex}`}
            >
              {calculatedIndex}
            </span>
          );
        },
        enableHiding: false,
        size: 48,
      }),
    ];

    const baseCols = [
      ...expanderCol,
      ...rowIndexCol,
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
                    className={`text-[10px] ${val ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-600/30 font-semibold' : ''
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
      cell: ({ row }) => {
        const lifecycle = entityType?.lifecycleConfig;
        const stateField = lifecycle?.state_field || 'status';
        const currentState =
          (row.original.attributes?.[stateField] as string) ||
          lifecycle?.initial_state ||
          'DRAFT';

        // Filter valid transitions originating from currentState or wildcard '*'
        const availableTransitions = (lifecycle?.transitions || []).filter(
          (t) => t.from === '*' || t.from.toUpperCase() === currentState.toUpperCase()
        );

        return (
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
                {lifecycle && (
                  <>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="gap-2 text-primary focus:text-primary">
                        <Play className="h-3.5 w-3.5" />
                        <span>FSM Transition</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="text-xs min-w-[200px] p-1.5 space-y-0.5">
                        {availableTransitions.length > 0 ? (
                          availableTransitions.map((t) => {
                            const visual = getTransitionActionVisual(t.action, t.to);
                            const ActionIcon = visual.icon;

                            return (
                              <DropdownMenuItem
                                key={t.action}
                                disabled={transitionMutation.isPending}
                                onClick={() =>
                                  handleRecordTransition(row.original.id, t.action, t.to)
                                }
                                className="group flex items-center justify-between gap-2.5 px-2.5 py-2 cursor-pointer rounded-lg hover:bg-accent/80 transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={cn('p-1 rounded-md bg-muted/60 shrink-0 group-hover:scale-105 transition-transform', visual.iconClass)}>
                                    <ActionIcon className="h-3.5 w-3.5" />
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-semibold text-foreground tracking-tight text-xs leading-none">
                                      {t.action}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                      <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" />
                                      <span className="truncate">{t.to}</span>
                                    </span>
                                  </div>
                                </div>
                                <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-mono border shrink-0', visual.badgeClass)}>
                                  {t.to}
                                </span>
                              </DropdownMenuItem>
                            );
                          })
                        ) : (
                          <div className="px-2.5 py-2 text-[11px] text-muted-foreground italic flex items-center gap-1.5">
                            <Ban className="h-3.5 w-3.5 opacity-50 shrink-0" />
                            <span>No transitions from '{currentState}'</span>
                          </div>
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                  </>
                )}
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
                  onClick={() => setAuditRecord(row.original)}
                  className="gap-2 text-blue-600 dark:text-blue-400 focus:text-blue-600"
                >
                  <History className="h-3.5 w-3.5" /> Audit History & Ledger
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
        );
      },
    });

    return [...baseCols, ...dynamicCols, actionCol];
  }, [
    attributes,
    sortField,
    sortDirection,
    entityType,
    transitionMutation.isPending,
    openEditRecordDialog,
    openDeleteRecordDialog,
    openRecordRelationshipsInspector,
    isComposite,
    expandedRowIds,
    page,
    pageSize,
  ]);

  const table = useReactTable({
    data: records,
    columns,
    state: {
      columnVisibility,
      columnOrder,
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
  });

  const { rows } = table.getRowModel();

  const draggableColumnIds = useMemo(() => {
    return table
      .getAllLeafColumns()
      .map((c) => c.id)
      .filter((id) => id !== 'row_index' && id !== 'actions' && id !== 'expander');
  }, [table]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setColumnOrder((currentOrder) => {
      const existingOrder =
        currentOrder.length > 0
          ? currentOrder
          : table.getAllLeafColumns().map((c) => c.id);
      const oldIndex = existingOrder.indexOf(String(active.id));
      const newIndex = existingOrder.indexOf(String(over.id));
      if (oldIndex !== -1 && newIndex !== -1) {
        return arrayMove(existingOrder, oldIndex, newIndex);
      }
      return existingOrder;
    });
  };

  // Keyboard navigation for Master-Detail inspection (j / k row traversal, Enter to expand)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const tag = (activeEl?.tagName || '').toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        activeEl?.getAttribute('role') === 'combobox'
      ) {
        return;
      }

      if (e.key === 'j' || (e.key === 'ArrowDown' && e.altKey)) {
        e.preventDefault();
        setSelectedRowIndex((prev) => {
          const next = prev === null ? 0 : Math.min(rows.length - 1, prev + 1);
          return next;
        });
      } else if (e.key === 'k' || (e.key === 'ArrowUp' && e.altKey)) {
        e.preventDefault();
        setSelectedRowIndex((prev) => {
          const next = prev === null ? 0 : Math.max(0, prev - 1);
          return next;
        });
      } else if (e.key === 'Enter' && selectedRowIndex !== null && rows[selectedRowIndex]) {
        e.preventDefault();
        setMasterDetailRecord(rows[selectedRowIndex].original);
        setIsMasterDetailOpen(true);
      } else if (e.key === 'Escape' && isMasterDetailOpen) {
        setIsMasterDetailOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rows, selectedRowIndex, isMasterDetailOpen]);

  // High-performance DOM virtualization with dynamic row measuring based on density
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => (density === 'compact' ? 36 : density === 'spacious' ? 60 : 48),
    overscan: 10,
    initialRect: { width: 1000, height: 800 },
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

          {/* Dynamic Multi-Condition Query Builder */}
          <DynamicQueryBuilder
            attributes={attributes}
            legacyFilters={attributeFilters}
            onApplyQuery={(_, clauses) => handleAttributeFiltersChange(clauses)}
          />

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
          <TableViewsPopover
            entityTypeId={entityTypeId}
            currentDensity={density}
            onDensityChange={handleDensityChange}
            currentVisibility={columnVisibility}
            onVisibilityChange={setColumnVisibility}
            currentColumnOrder={columnOrder}
            onColumnOrderChange={setColumnOrder}
            activePresetId={activePresetId}
            onSelectPreset={(p) => setActivePresetId(p.id)}
          />

          <DataTableViewOptions table={table} />

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
      <div className="flex flex-col lg:flex-row items-stretch gap-4 w-full min-w-0 flex-1 min-h-[420px] lg:min-h-0">
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

        <div className="group/grid relative flex-1 min-w-0 w-full rounded-2xl bg-white/45 dark:bg-slate-900/45 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/25 flex flex-col overflow-hidden h-full min-h-[420px] lg:min-h-0">
          {/* Dynamic Left Gradient Shadow Cue */}
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-y-0 start-0 z-30 w-8 bg-gradient-to-r from-background/80 via-background/30 to-transparent transition-opacity duration-300',
              canScrollLeft ? 'opacity-100' : 'opacity-0'
            )}
          />

          {/* Dynamic Right Gradient Shadow Cue */}
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-y-0 end-0 z-30 w-8 bg-gradient-to-l from-background/80 via-background/30 to-transparent transition-opacity duration-300',
              canScrollRight ? 'opacity-100' : 'opacity-0'
            )}
          />

          <div
            ref={scrollContainerRef}
            tabIndex={0}
            role="region"
            aria-label="Metadata entity data grid scrollable region"
            className="overflow-x-auto overflow-y-auto relative w-full flex-1 min-h-0 h-full scrollbar-thin focus:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <table className="w-full min-w-max text-left border-collapse text-xs table-auto">
                <thead className="sticky top-0 z-30 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-xs">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <SortableContext
                      key={headerGroup.id}
                      items={draggableColumnIds}
                      strategy={horizontalListSortingStrategy}
                    >
                      <tr className="border-b border-border">
                        {headerGroup.headers.map((header) => (
                          <DraggableHeaderCell
                            key={header.id}
                            header={header}
                            density={density}
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSortToggle={handleSortToggle}
                          />
                        ))}
                      </tr>
                    </SortableContext>
                  ))}
                </thead>
              <tbody>
                {rows.length > 0 ? (
                  <>
                    {(() => {
                      const virtualRows = rowVirtualizer.getVirtualItems();
                      // In headless/jsdom testing environments where scrollHeight/clientHeight is 0,
                      // fallback to rendering initial rows so assertions and SSR render reliably without unvirtualized DOM overhead
                      const itemsToRender =
                        virtualRows.length > 0
                          ? virtualRows
                          : rows.slice(0, Math.min(rows.length, 25)).map((_, index) => ({
                              index,
                              start: index * 45,
                              end: (index + 1) * 45,
                              size: 45,
                              key: index,
                              lane: 0,
                            }));

                      const totalSize = rowVirtualizer.getTotalSize();
                      const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
                      const paddingBottom =
                        virtualRows.length > 0
                          ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
                          : 0;

                      return (
                        <>
                          {paddingTop > 0 && (
                            <tr>
                              <td
                                colSpan={columns.length}
                                style={{ height: `${paddingTop}px` }}
                                className="p-0 border-0"
                              />
                            </tr>
                          )}
                          {itemsToRender.map((virtualRow) => {
                            const row = rows[virtualRow.index];
                            if (!row) return null;
                            const isExpanded = expandedRowIds.has(row.original.id);

                            return (
                              <React.Fragment key={row.id}>
                                <tr
                                  data-index={virtualRow.index}
                                  ref={rowVirtualizer.measureElement}
                                  onClick={() => setSelectedRowIndex(virtualRow.index)}
                                  onDoubleClick={() => {
                                    setMasterDetailRecord(row.original);
                                    setIsMasterDetailOpen(true);
                                  }}
                                  className={cn(
                                    'group border-b border-white/10 transition-colors cursor-pointer',
                                    selectedRowIndex === virtualRow.index
                                      ? 'bg-primary/15 dark:bg-primary/20 ring-1 ring-inset ring-primary/40'
                                      : 'hover:bg-white/40 dark:hover:bg-white/5'
                                  )}
                                >
                                  {row.getVisibleCells().map((cell) => {
                                    const isAction = cell.column.id === 'actions';
                                    const isRowIndex = cell.column.id === 'row_index';
                                    return (
                                      <td
                                        key={cell.id}
                                        className={cn(
                                          'whitespace-nowrap transition-[background-color,backdrop-filter] duration-150',
                                          density === 'compact'
                                            ? 'py-1 px-2 text-xs'
                                            : density === 'spacious'
                                              ? 'py-3.5 px-3.5 text-sm'
                                              : 'p-3 text-xs',
                                          isRowIndex &&
                                          'sticky left-0 z-10 w-12 text-center bg-white/90 group-hover:bg-white/95 dark:bg-slate-900/90 dark:group-hover:bg-slate-800/95 backdrop-blur-xl border-r border-white/20 dark:border-white/10 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.06)]',
                                          isAction &&
                                          'sticky right-0 z-10 w-12 group-hover:bg-white/85 dark:group-hover:bg-slate-800/85 backdrop-blur-xl border-l border-white/30 dark:border-white/10 shadow-[-8px_0_20px_-4px_rgba(0,0,0,0.08),inset_1px_0_1px_0_rgba(255,255,255,0.4)] dark:shadow-[-8px_0_20px_-4px_rgba(0,0,0,0.5),inset_1px_0_1px_0_rgba(255,255,255,0.08)]'
                                        )}
                                      >
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                      </td>
                                    );
                                  })}
                                </tr>
                                {isComposite && isExpanded && entityType?.compositeSpec && (
                                  <tr className="border-b border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
                                    <td colSpan={columns.length} className="p-3 pl-8">
                                      <CompositeMasterDetailRow
                                        record={row.original as any}
                                        compositeSpec={entityType.compositeSpec}
                                      />
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                          {paddingBottom > 0 && (
                            <tr>
                              <td
                                colSpan={columns.length}
                                style={{ height: `${paddingBottom}px` }}
                                className="p-0 border-0"
                              />
                            </tr>
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : (
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
          </DndContext>
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
                <SelectTrigger aria-label="Rows per page" className="h-7 w-18 text-xs bg-white/50 dark:bg-white/5 border-white/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="250">250</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                  <SelectItem value="1000">1000</SelectItem>
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
      <RecordAuditHistoryDrawer
        record={auditRecord}
        entityTypeId={entityTypeId}
        open={Boolean(auditRecord)}
        onClose={() => setAuditRecord(null)}
      />
      <MasterDetailRowInspector
        record={masterDetailRecord}
        entityType={entityType}
        attributes={attributes}
        open={isMasterDetailOpen}
        onOpenChange={setIsMasterDetailOpen}
        onEdit={openEditRecordDialog}
        onInspectEdges={openRecordRelationshipsInspector}
      />
    </div>
  );
};

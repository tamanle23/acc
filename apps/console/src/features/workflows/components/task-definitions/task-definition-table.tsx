import React, { useMemo, useState } from 'react';
import {
  type SortingState,
  type VisibilityState,
  type ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { AuthorizedButton } from '@/components/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  SlidersHorizontal,
  CheckCircle2,
  Clock,
  FileEdit,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronRight,
  Lock,
} from 'lucide-react';
import {
  DataTable,
  DataTablePagination,
  DataTableToolbar,
} from '@/components/data-table';
import { type TaskDefinitionRecord } from '@/features/workflows/api/task-definition-api';
import { createTaskDefinitionColumns } from './task-definition-columns';
import { cn } from '@/lib/utils';

export type TaskScope = 'all' | 'custom' | 'builtin';

export interface TaskDefinitionTableProps {
  data: TaskDefinitionRecord[];
  isLoading: boolean;
  onEditTaskDef: (taskDef: TaskDefinitionRecord) => void;
  onViewHistory: (taskName: string) => void;
  onPublishTaskDef: (name: string, version: number) => void;
  onDeleteDraft: (name: string, version: number) => void;
  onForkDraft?: (taskDef: TaskDefinitionRecord) => void;
  onCreateNew: () => void;
}

export const TaskDefinitionTable: React.FC<TaskDefinitionTableProps> = ({
  data,
  isLoading,
  onEditTaskDef,
  onViewHistory,
  onPublishTaskDef,
  onDeleteDraft,
  onForkDraft,
  onCreateNew,
}) => {
  const [scope, setScope] = useState<TaskScope>('all');
  const [isBuiltInCollapsed, setIsBuiltInCollapsed] = useState(false);

  // Sorting & pagination states for each partitioned sub-table
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const [customSorting, setCustomSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [customPagination, setCustomPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const [builtInSorting, setBuiltInSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [builtInPagination, setBuiltInPagination] = useState({ pageIndex: 0, pageSize: 10 });

  // Separate tasks into Custom definitions vs Built-in platform nodes
  const { customTasks, builtInTasks } = useMemo(() => {
    const custom: TaskDefinitionRecord[] = [];
    const builtIn: TaskDefinitionRecord[] = [];
    for (const item of data) {
      if (item.isBuiltIn || item.tenantId === 'SYSTEM' || item.tenantId === 'system') {
        builtIn.push(item);
      } else {
        custom.push(item);
      }
    }
    return { customTasks: custom, builtInTasks: builtIn };
  }, [data]);

  const columns = useMemo(
    () =>
      createTaskDefinitionColumns({
        onEditTaskDef,
        onViewHistory,
        onPublishTaskDef,
        onDeleteDraft,
        onForkDraft,
      }),
    [onEditTaskDef, onViewHistory, onPublishTaskDef, onDeleteDraft, onForkDraft]
  );

  // Master combined table used to power the shared search and faceted filter toolbar
  // eslint-disable-next-line react-hooks/incompatible-library
  const combinedTable = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // Dedicated custom tasks table
  // eslint-disable-next-line react-hooks/incompatible-library
  const customTable = useReactTable({
    data: customTasks,
    columns,
    state: {
      sorting: customSorting,
      columnVisibility,
      columnFilters,
      globalFilter,
      pagination: customPagination,
    },
    onSortingChange: setCustomSorting,
    onPaginationChange: setCustomPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Dedicated built-in tasks table
  // eslint-disable-next-line react-hooks/incompatible-library
  const builtInTable = useReactTable({
    data: builtInTasks,
    columns,
    state: {
      sorting: builtInSorting,
      columnVisibility,
      columnFilters,
      globalFilter,
      pagination: builtInPagination,
    },
    onSortingChange: setBuiltInSorting,
    onPaginationChange: setBuiltInPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Empty state when entire catalog dataset is empty
  if (!isLoading && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3 text-muted-foreground border border-dashed rounded-xl bg-card/40 backdrop-blur-md">
        <SlidersHorizontal className="h-10 w-10 text-muted-foreground/40" />
        <span className="text-sm font-semibold text-foreground">No task definitions found</span>
        <p className="text-xs text-muted-foreground max-w-sm text-center">
          No task definitions have been registered yet. Define your first task contract to start orchestrating.
        </p>
        <AuthorizedButton
          permission="workflow:definition:manage"
          variant="outline"
          size="sm"
          onClick={onCreateNew}
          className="text-xs mt-1"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Define your first task contract
        </AuthorizedButton>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'max-sm:has-[div[role="toolbar"]]:mb-16',
        'flex flex-1 flex-col gap-4'
      )}
    >
      {/* Top Header: Scope Switcher & Create Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={scope} onValueChange={(val) => setScope(val as TaskScope)}>
          <TabsList className="h-9 bg-muted/40 border border-white/20 dark:border-white/10 backdrop-blur-md p-1">
            <TabsTrigger
              value="all"
              onClick={() => setScope('all')}
              className="text-xs px-3 gap-1.5"
              data-testid="scope-tab-all"
            >
              <Layers className="h-3.5 w-3.5" />
              All Tasks
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1 font-mono">
                {data.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="custom"
              onClick={() => setScope('custom')}
              className="text-xs px-3 gap-1.5"
              data-testid="scope-tab-custom"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Custom Definitions
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1 font-mono">
                {customTasks.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="builtin"
              onClick={() => setScope('builtin')}
              className="text-xs px-3 gap-1.5"
              data-testid="scope-tab-builtin"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
              Built-in System
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 ml-1 font-mono bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
              >
                {builtInTasks.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <AuthorizedButton
          permission="workflow:definition:manage"
          onClick={onCreateNew}
          size="sm"
          className="h-8 gap-1.5 shadow-md shadow-primary/20 text-xs font-medium"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Task Definition
        </AuthorizedButton>
      </div>

      {/* Shared Search & Status Filter Toolbar */}
      <DataTableToolbar
        table={combinedTable}
        searchPlaceholder="Search task definitions by name or description..."
        filters={[
          {
            columnId: 'status',
            title: 'Status',
            options: [
              { label: 'Active', value: 'ACTIVE', icon: CheckCircle2 },
              { label: 'Draft', value: 'DRAFT', icon: FileEdit },
              { label: 'Deprecated', value: 'DEPRECATED', icon: Clock },
            ],
          },
        ]}
      />

      {/* Scope 1: Custom Definitions Only */}
      {scope === 'custom' && (
        <div className="flex flex-col gap-3">
          {customTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 gap-2.5 text-muted-foreground border border-dashed rounded-xl bg-card/40 backdrop-blur-md">
              <SlidersHorizontal className="h-8 w-8 text-muted-foreground/40" />
              <span className="text-sm font-semibold text-foreground">No custom task definitions found</span>
              <p className="text-xs text-muted-foreground max-w-sm text-center">
                You haven&apos;t defined any custom task contracts yet. Create a new custom task or fork from the built-in system contracts.
              </p>
              <AuthorizedButton
                permission="workflow:definition:manage"
                variant="outline"
                size="sm"
                onClick={onCreateNew}
                className="text-xs mt-1"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Define your first task contract
              </AuthorizedButton>
            </div>
          ) : (
            <>
              <DataTable
                showRowIndex
                table={customTable}
                noResultsMessage={
                  isLoading ? (
                    <span className="italic text-muted-foreground">Loading task definitions...</span>
                  ) : (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      No custom tasks match the current search or filters.
                    </div>
                  )
                }
              />
              <DataTablePagination table={customTable} className="mt-auto" />
            </>
          )}
        </div>
      )}

      {/* Scope 2: Built-in System Only */}
      {scope === 'builtin' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-xs text-indigo-700 dark:text-indigo-300 backdrop-blur-md">
            <Lock className="w-4 h-4 shrink-0 text-indigo-500" />
            <span>
              Canonical system task definitions provided by the orchestrator platform. These {builtInTasks.length} contracts are maintained by the platform engine. You can inspect schemas, test payloads in the sandbox, or fork them as custom drafts.
            </span>
          </div>

          <DataTable
            showRowIndex
            table={builtInTable}
            noResultsMessage={
              isLoading ? (
                <span className="italic text-muted-foreground">Loading task definitions...</span>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No built-in tasks match the current search or filters.
                </div>
              )
            }
          />
          <DataTablePagination table={builtInTable} className="mt-auto" />
        </div>
      )}

      {/* Scope 3: All Tasks (Grouped by Origin) */}
      {scope === 'all' && (
        <div className="flex flex-col gap-6">
          {/* Section 1: Custom Task Definitions */}
          <div className="flex flex-col gap-3 rounded-xl border border-white/20 dark:border-white/10 bg-card/60 backdrop-blur-md p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Custom Task Definitions</h3>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {customTasks.length} Custom
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Tenant-specific task workers and contracts defined for workflow steps.
                  </p>
                </div>
              </div>
            </div>

            {customTasks.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg bg-muted/10 flex flex-col items-center gap-1.5">
                <span>No custom task definitions defined yet for this workspace.</span>
                <span className="text-[11px] text-muted-foreground/80">
                  You can create a new task contract or fork any of the built-in system nodes below.
                </span>
              </div>
            ) : (
              <>
                <DataTable
                  showRowIndex
                  table={customTable}
                  noResultsMessage={
                    isLoading ? (
                      <span className="italic text-muted-foreground">Loading task definitions...</span>
                    ) : (
                      <div className="py-6 text-center text-xs text-muted-foreground">
                        No custom tasks match the current search or filters.
                      </div>
                    )
                  }
                />
                {customTasks.length > 10 && (
                  <DataTablePagination table={customTable} className="mt-1" />
                )}
              </>
            )}
          </div>

          {/* Section 2: Built-in System Tasks (Collapsible Group) */}
          {builtInTasks.length > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.02] dark:bg-indigo-950/[0.05] backdrop-blur-md p-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">Built-in System Tasks</h3>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                      >
                        {builtInTasks.length} Built-in
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Canonical platform execution nodes (HTTP, LLM, Kafka, etc.) maintained by the orchestrator engine.
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsBuiltInCollapsed(!isBuiltInCollapsed)}
                  className="text-xs h-7 px-2.5 gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  {isBuiltInCollapsed ? (
                    <>
                      <ChevronRight className="w-3.5 h-3.5" />
                      Show Built-in ({builtInTasks.length})
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      Collapse
                    </>
                  )}
                </Button>
              </div>

              {!isBuiltInCollapsed && (
                <>
                  <DataTable
                    showRowIndex
                    table={builtInTable}
                    noResultsMessage={
                      isLoading ? (
                        <span className="italic text-muted-foreground">Loading task definitions...</span>
                      ) : (
                        <div className="py-6 text-center text-xs text-muted-foreground">
                          No built-in tasks match the current search or filters.
                        </div>
                      )
                    }
                  />
                  {builtInTasks.length > 10 && (
                    <DataTablePagination table={builtInTable} className="mt-1" />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

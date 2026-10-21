import React, { useRef, useState, useEffect, useCallback } from 'react'
import type { ColumnDef, Table as ReactTable } from '@tanstack/react-table'
import { flexRender } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'

export const ROW_INDEX_COLUMN_ID = 'row_index'
export const ROW_SELECT_COLUMN_ID = 'select'

/**
 * Creates a standard column definition for a sticky row order increment column (#).
 * Can be passed directly into TanStack Table column definitions.
 */
export function createRowIndexColumn<TData>(): ColumnDef<TData> {
  return {
    id: ROW_INDEX_COLUMN_ID,
    header: () => (
      <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] font-mono select-none">
        #
      </span>
    ),
    cell: ({ row, table }) => {
      const pageIndex = table.getState().pagination?.pageIndex ?? 0
      const pageSize =
        table.getState().pagination?.pageSize && table.getState().pagination.pageSize > 0
          ? table.getState().pagination.pageSize
          : table.getRowModel().rows.length || 10
      const calculatedIndex = pageIndex * pageSize + row.index + 1
      return (
        <span
          className="font-mono text-[11px] text-muted-foreground/80 font-medium select-none"
          title={`Row #${calculatedIndex}`}
        >
          {calculatedIndex}
        </span>
      )
    },
    enableSorting: false,
    enableHiding: false,
    size: 48,
  }
}

/**
 * Creates a standard column definition for a sticky bulk row selection column with checkboxes.
 * Can be passed directly into TanStack Table column definitions.
 */
export function createRowSelectColumn<TData>(): ColumnDef<TData> {
  return {
    id: ROW_SELECT_COLUMN_ID,
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 48,
  }
}

export type DataTableProps<TData> = {
  table: ReactTable<TData>
  className?: string
  containerClassName?: string
  noResultsMessage?: React.ReactNode
  stickyHeader?: boolean
  onRowClick?: (row: TData) => void
  showRowIndex?: boolean
  rowIndexOffset?: number
  showRowSelection?: boolean
  showRowSelect?: boolean
}

export function DataTable<TData>({
  table,
  className,
  containerClassName,
  noResultsMessage = 'No results.',
  stickyHeader = true,
  onRowClick,
  showRowIndex,
  rowIndexOffset = 0,
  showRowSelection,
  showRowSelect,
}: DataTableProps<TData>) {
  const isSelectActive = Boolean(showRowSelection || showRowSelect)
  const allColumns = table.getAllColumns()
  const columnCount = allColumns.length

  const hasRowIndexColumn = allColumns.some(
    (col) => col.id === 'row_index' || col.id === 'rowIndex'
  )
  const hasRowSelectColumn = allColumns.some(
    (col) => col.id === 'select' || col.id === 'row_select' || col.id === 'rowSelect'
  )

  const shouldInjectRowIndex = Boolean(showRowIndex && !hasRowIndexColumn)
  const shouldInjectRowSelection = Boolean(isSelectActive && !hasRowSelectColumn)

  let extraColCount = 0
  if (shouldInjectRowIndex) extraColCount += 1
  if (shouldInjectRowSelection) extraColCount += 1
  const effectiveColumnCount = columnCount + extraColCount

  // Helper to determine sticky start offset for headers and cells
  const getStickyStartClass = useCallback(
    (colId: string) => {
      const isRowIndex = colId === 'row_index' || colId === 'rowIndex'
      const isRowSelect = colId === 'select' || colId === 'row_select' || colId === 'rowSelect'

      if (!isRowIndex && !isRowSelect) return null

      const hasIndex = shouldInjectRowIndex || hasRowIndexColumn
      const hasSelect = shouldInjectRowSelection || hasRowSelectColumn

      if (hasIndex && hasSelect) {
        if (isRowIndex) {
          const indexIdx = allColumns.findIndex((c) => c.id === 'row_index' || c.id === 'rowIndex')
          const selectIdx = allColumns.findIndex(
            (c) => c.id === 'select' || c.id === 'row_select' || c.id === 'rowSelect'
          )
          const isFirst =
            shouldInjectRowIndex || (indexIdx !== -1 && (selectIdx === -1 || indexIdx < selectIdx))
          return isFirst ? 'start-0' : 'start-12'
        }
        if (isRowSelect) {
          const indexIdx = allColumns.findIndex((c) => c.id === 'row_index' || c.id === 'rowIndex')
          const selectIdx = allColumns.findIndex(
            (c) => c.id === 'select' || c.id === 'row_select' || c.id === 'rowSelect'
          )
          const isSecond =
            shouldInjectRowIndex || (indexIdx !== -1 && selectIdx !== -1 && indexIdx < selectIdx)
          return isSecond ? 'start-12' : 'start-0'
        }
      }

      return 'start-0'
    },
    [allColumns, hasRowIndexColumn, hasRowSelectColumn, shouldInjectRowIndex, shouldInjectRowSelection]
  )

  // Helper to determine if column is the rightmost sticky left column (adds elevation shadow)
  const isRightmostStickyLeft = useCallback(
    (colId: string) => {
      const isRowIndex = colId === 'row_index' || colId === 'rowIndex'
      const isRowSelect = colId === 'select' || colId === 'row_select' || colId === 'rowSelect'

      if (!isRowIndex && !isRowSelect) return false

      const hasIndex = shouldInjectRowIndex || hasRowIndexColumn
      const hasSelect = shouldInjectRowSelection || hasRowSelectColumn

      if (!hasIndex || !hasSelect) return true
      return getStickyStartClass(colId) === 'start-12'
    },
    [getStickyStartClass, hasRowIndexColumn, hasRowSelectColumn, shouldInjectRowIndex, shouldInjectRowSelection]
  )
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    // Tolerances of 1px for high-DPI subpixel rendering
    setCanScrollLeft(scrollLeft > 1)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1)
  }, [])

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return

    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    const resizeObserver = new ResizeObserver(() => checkScroll())
    resizeObserver.observe(el)

    return () => {
      el.removeEventListener('scroll', checkScroll)
      resizeObserver.disconnect()
    }
  }, [checkScroll, table.getRowModel().rows, effectiveColumnCount])

  return (
    <div
      className={cn(
        'group/grid relative overflow-hidden rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md shadow-lg shadow-black/5 dark:shadow-black/20',
        containerClassName
      )}
    >
      {/* Dynamic Left Gradient Shadow Cue */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 start-0 z-20 w-8 bg-gradient-to-r from-background/80 via-background/30 to-transparent transition-opacity duration-300',
          canScrollLeft ? 'opacity-100' : 'opacity-0'
        )}
      />

      {/* Dynamic Right Gradient Shadow Cue */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 end-0 z-20 w-8 bg-gradient-to-l from-background/80 via-background/30 to-transparent transition-opacity duration-300',
          canScrollRight ? 'opacity-100' : 'opacity-0'
        )}
      />

      <div
        ref={scrollContainerRef}
        data-slot="table-container"
        tabIndex={0}
        role="region"
        aria-label="Data table content scrollable region"
        className="relative w-full overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin focus:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
      >
        <table
          data-slot="table"
          className={cn('w-full caption-bottom text-sm border-collapse', className)}
        >
          <TableHeader
            className={cn(
              stickyHeader &&
                'sticky top-0 z-20 bg-background/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-xs border-b border-white/20 dark:border-white/10'
            )}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="group/row border-b border-white/20 dark:border-white/10">
                {shouldInjectRowIndex && (
                  <TableHead
                    data-row-index="true"
                    aria-label="Row number"
                    className={cn(
                      'sticky z-20 w-12 text-center font-semibold text-muted-foreground uppercase tracking-wider text-[11px] font-mono select-none bg-background/95 dark:bg-slate-900/95 backdrop-blur-md border-e border-white/20 dark:border-white/10',
                      getStickyStartClass('row_index'),
                      isRightmostStickyLeft('row_index') && 'shadow-[6px_0_12px_-4px_rgba(0,0,0,0.06)]'
                    )}
                  >
                    #
                  </TableHead>
                )}
                {shouldInjectRowSelection && (
                  <TableHead
                    data-row-select="true"
                    aria-label="Select all rows"
                    className={cn(
                      'sticky z-20 w-12 text-center bg-background/95 dark:bg-slate-900/95 backdrop-blur-md border-e border-white/20 dark:border-white/10',
                      getStickyStartClass('select'),
                      isRightmostStickyLeft('select') && 'shadow-[6px_0_12px_-4px_rgba(0,0,0,0.06)]'
                    )}
                  >
                    <Checkbox
                      checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && 'indeterminate')
                      }
                      onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                      aria-label="Select all"
                      className="translate-y-[2px]"
                    />
                  </TableHead>
                )}
                {headerGroup.headers.map((header) => {
                  const isAction = header.column.id === 'actions'
                  const isRowIndex = header.column.id === 'row_index' || header.column.id === 'rowIndex'
                  const isRowSelect =
                    header.column.id === 'select' ||
                    header.column.id === 'row_select' ||
                    header.column.id === 'rowSelect'
                  const isStickyLeft = isRowIndex || isRowSelect
                  const colId = header.column.id
                  const isSorted = header.column.getIsSorted?.()
                  const canSort = header.column.getCanSort?.()
                  const ariaSort = canSort
                    ? isSorted === 'asc'
                      ? 'ascending'
                      : isSorted === 'desc'
                      ? 'descending'
                      : 'none'
                    : undefined

                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      aria-sort={ariaSort}
                      data-row-index={isRowIndex ? 'true' : undefined}
                      data-row-select={isRowSelect ? 'true' : undefined}
                      className={cn(
                        header.column.columnDef.meta?.className,
                        header.column.columnDef.meta?.thClassName,
                        isStickyLeft &&
                          cn(
                            'sticky z-20 w-12 text-center bg-background/95 dark:bg-slate-900/95 backdrop-blur-md border-e border-white/20 dark:border-white/10',
                            isRowIndex &&
                              'font-semibold text-muted-foreground uppercase tracking-wider text-[11px] font-mono select-none',
                            getStickyStartClass(header.column.id),
                            isRightmostStickyLeft(header.column.id) &&
                              'shadow-[6px_0_12px_-4px_rgba(0,0,0,0.06)]'
                          ),
                        isAction &&
                          'sticky end-0 z-20 bg-background/95 dark:bg-slate-900/95 backdrop-blur-md border-s border-white/20 dark:border-white/10 shadow-[-6px_0_12px_rgba(0,0,0,0.06)]'
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row, rowIndex) => {
                const pageIndex = table.getState().pagination?.pageIndex ?? 0
                const pageSize =
                  table.getState().pagination?.pageSize && table.getState().pagination.pageSize > 0
                    ? table.getState().pagination.pageSize
                    : table.getRowModel().rows.length || 10
                const calculatedIndex = pageIndex * pageSize + rowIndex + 1 + rowIndexOffset

                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    onClick={(e: React.MouseEvent) => {
                      if (!onRowClick) return;
                      const target = e.target as HTMLElement | null;
                      if (
                        target?.closest('button') ||
                        target?.closest('a') ||
                        target?.closest('input') ||
                        target?.closest('[role="menuitem"]') ||
                        target?.closest('[role="checkbox"]') ||
                        target?.closest('[data-slot="dropdown-menu-trigger"]') ||
                        target?.closest('[data-slot="dropdown-menu-content"]') ||
                        target?.closest('td[data-action="true"]') ||
                        target?.closest('td[data-row-select="true"]')
                      ) {
                        return;
                      }
                      onRowClick(row.original);
                    }}
                    className={cn(
                      "group/row hover:bg-white/40 dark:hover:bg-white/5 transition-colors border-b border-white/10",
                      onRowClick && "cursor-pointer"
                    )}
                  >
                    {shouldInjectRowIndex && (
                      <TableCell
                        data-row-index="true"
                        className={cn(
                          "sticky z-10 w-12 text-center bg-background/90 group-hover:bg-background/95 dark:bg-slate-900/90 dark:group-hover:bg-slate-800/95 backdrop-blur-xl border-e border-white/20 dark:border-white/10 font-mono text-[11px] text-muted-foreground/80 font-medium select-none transition-[background-color]",
                          getStickyStartClass('row_index'),
                          isRightmostStickyLeft('row_index') && 'shadow-[6px_0_12px_-4px_rgba(0,0,0,0.06)]'
                        )}
                        title={`Row #${calculatedIndex}`}
                      >
                        {calculatedIndex}
                      </TableCell>
                    )}
                    {shouldInjectRowSelection && (
                      <TableCell
                        data-row-select="true"
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "sticky z-10 w-12 text-center bg-background/90 group-hover:bg-background/95 dark:bg-slate-900/90 dark:group-hover:bg-slate-800/95 backdrop-blur-xl border-e border-white/20 dark:border-white/10 transition-[background-color]",
                          getStickyStartClass('select'),
                          isRightmostStickyLeft('select') && 'shadow-[6px_0_12px_-4px_rgba(0,0,0,0.06)]'
                        )}
                      >
                        <Checkbox
                          checked={row.getIsSelected()}
                          onCheckedChange={(value) => row.toggleSelected(!!value)}
                          aria-label="Select row"
                          className="translate-y-[2px]"
                        />
                      </TableCell>
                    )}
                    {row.getVisibleCells().map((cell) => {
                      const isAction = cell.column.id === 'actions'
                      const isRowIndex = cell.column.id === 'row_index' || cell.column.id === 'rowIndex'
                      const isRowSelect =
                        cell.column.id === 'select' ||
                        cell.column.id === 'row_select' ||
                        cell.column.id === 'rowSelect'
                      const isStickyLeft = isRowIndex || isRowSelect

                      return (
                        <TableCell
                          key={cell.id}
                          data-action={isAction ? 'true' : undefined}
                          data-row-index={isRowIndex ? 'true' : undefined}
                          data-row-select={isRowSelect ? 'true' : undefined}
                          onClick={(e) => {
                            if (isAction || isRowSelect) {
                              e.stopPropagation();
                            }
                          }}
                          className={cn(
                            cell.column.columnDef.meta?.className,
                            cell.column.columnDef.meta?.tdClassName,
                            isStickyLeft &&
                              cn(
                                'sticky z-10 w-12 text-center bg-background/90 group-hover:bg-background/95 dark:bg-slate-900/90 dark:group-hover:bg-slate-800/95 backdrop-blur-xl border-e border-white/20 dark:border-white/10 transition-[background-color]',
                                isRowIndex &&
                                  'font-mono text-[11px] text-muted-foreground/80 font-medium select-none',
                                getStickyStartClass(cell.column.id),
                                isRightmostStickyLeft(cell.column.id) &&
                                  'shadow-[6px_0_12px_-4px_rgba(0,0,0,0.06)]'
                              ),
                            isAction &&
                              'sticky end-0 z-10 bg-background/90 group-hover:bg-background/95 dark:bg-slate-900/90 dark:group-hover:bg-slate-900/95 backdrop-blur-md border-s border-white/20 dark:border-white/10 shadow-[-6px_0_12px_rgba(0,0,0,0.06)] transition-[background-color]'
                          )}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={effectiveColumnCount}
                  className="h-24 text-center text-muted-foreground"
                >
                  {noResultsMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>
    </div>
  )
}

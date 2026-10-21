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

export const ROW_INDEX_COLUMN_ID = 'row_index'

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

export type DataTableProps<TData> = {
  table: ReactTable<TData>
  className?: string
  containerClassName?: string
  noResultsMessage?: React.ReactNode
  stickyHeader?: boolean
  onRowClick?: (row: TData) => void
  showRowIndex?: boolean
  rowIndexOffset?: number
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
}: DataTableProps<TData>) {
  const allColumns = table.getAllColumns()
  const columnCount = allColumns.length
  const hasRowIndexColumn = allColumns.some(
    (col) => col.id === 'row_index' || col.id === 'rowIndex'
  )
  const shouldInjectRowIndex = Boolean(showRowIndex && !hasRowIndexColumn)
  const effectiveColumnCount = shouldInjectRowIndex ? columnCount + 1 : columnCount
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
                    aria-label="Row number"
                    className="sticky start-0 z-20 w-12 text-center font-semibold text-muted-foreground uppercase tracking-wider text-[11px] font-mono select-none bg-background/95 dark:bg-slate-900/95 backdrop-blur-md border-e border-white/20 dark:border-white/10 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.06)]"
                  >
                    #
                  </TableHead>
                )}
                {headerGroup.headers.map((header) => {
                  const isAction = header.column.id === 'actions'
                  const isRowIndex = header.column.id === 'row_index' || header.column.id === 'rowIndex'
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
                      className={cn(
                        header.column.columnDef.meta?.className,
                        header.column.columnDef.meta?.thClassName,
                        isRowIndex &&
                          'sticky start-0 z-20 w-12 text-center font-semibold text-muted-foreground uppercase tracking-wider text-[11px] font-mono select-none bg-background/95 dark:bg-slate-900/95 backdrop-blur-md border-e border-white/20 dark:border-white/10 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.06)]',
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
                        target?.closest('td[data-action="true"]')
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
                        className="sticky start-0 z-10 w-12 text-center bg-background/90 group-hover:bg-background/95 dark:bg-slate-900/90 dark:group-hover:bg-slate-800/95 backdrop-blur-xl border-e border-white/20 dark:border-white/10 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.06)] font-mono text-[11px] text-muted-foreground/80 font-medium select-none transition-[background-color]"
                        title={`Row #${calculatedIndex}`}
                      >
                        {calculatedIndex}
                      </TableCell>
                    )}
                    {row.getVisibleCells().map((cell) => {
                      const isAction = cell.column.id === 'actions'
                      const isRowIndex = cell.column.id === 'row_index' || cell.column.id === 'rowIndex'

                      return (
                        <TableCell
                          key={cell.id}
                          data-action={isAction ? 'true' : undefined}
                          data-row-index={isRowIndex ? 'true' : undefined}
                          onClick={(e) => {
                            if (isAction) {
                              e.stopPropagation();
                            }
                          }}
                          className={cn(
                            cell.column.columnDef.meta?.className,
                            cell.column.columnDef.meta?.tdClassName,
                            isRowIndex &&
                              'sticky start-0 z-10 w-12 text-center bg-background/90 group-hover:bg-background/95 dark:bg-slate-900/90 dark:group-hover:bg-slate-800/95 backdrop-blur-xl border-e border-white/20 dark:border-white/10 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.06)] font-mono text-[11px] text-muted-foreground/80 font-medium select-none transition-[background-color]',
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

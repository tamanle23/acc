import React, { useRef, useState, useEffect, useCallback } from 'react'
import { flexRender, type Table as ReactTable } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type DataTableProps<TData> = {
  table: ReactTable<TData>
  className?: string
  containerClassName?: string
  noResultsMessage?: React.ReactNode
  stickyHeader?: boolean
}

export function DataTable<TData>({
  table,
  className,
  containerClassName,
  noResultsMessage = 'No results.',
  stickyHeader = true,
}: DataTableProps<TData>) {
  const columnCount = table.getAllColumns().length
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
  }, [checkScroll, table.getRowModel().rows, columnCount])

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md shadow-lg shadow-black/5 dark:shadow-black/20',
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
                {headerGroup.headers.map((header) => {
                  const isAction = header.column.id === 'actions'
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
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="group/row hover:bg-white/40 dark:hover:bg-white/5 transition-colors border-b border-white/10"
                >
                  {row.getVisibleCells().map((cell) => {
                    const isAction = cell.column.id === 'actions'
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          cell.column.columnDef.meta?.className,
                          cell.column.columnDef.meta?.tdClassName,
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
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
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

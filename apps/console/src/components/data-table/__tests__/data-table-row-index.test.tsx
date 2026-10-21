import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  type ColumnDef,
} from '@tanstack/react-table'
import { DataTable, createRowIndexColumn, ROW_INDEX_COLUMN_ID } from '../data-table'

interface TestItem {
  id: string
  name: string
  status: string
}

const mockData: TestItem[] = [
  { id: '1', name: 'Alpha Item', status: 'ACTIVE' },
  { id: '2', name: 'Beta Item', status: 'PENDING' },
  { id: '3', name: 'Gamma Item', status: 'COMPLETED' },
]

const baseColumns: ColumnDef<TestItem>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    cell: (info) => info.getValue(),
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: (info) => info.getValue(),
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: () => <button type="button">Edit</button>,
  },
]

function TestTableWrapper({
  data = mockData,
  columns = baseColumns,
  showRowIndex,
  rowIndexOffset,
  pageIndex = 0,
  pageSize = 10,
  onRowClick,
}: {
  data?: TestItem[]
  columns?: ColumnDef<TestItem>[]
  showRowIndex?: boolean
  rowIndexOffset?: number
  pageIndex?: number
  pageSize?: number
  onRowClick?: (row: TestItem) => void
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageIndex,
        pageSize,
      },
    },
  })

  return (
    <DataTable
      table={table}
      showRowIndex={showRowIndex}
      rowIndexOffset={rowIndexOffset}
      onRowClick={onRowClick}
    />
  )
}

describe('DataTable Sticky Row Order Increment Column', () => {
  it('does not render row index column by default when showRowIndex is omitted', () => {
    render(<TestTableWrapper showRowIndex={false} />)

    expect(screen.queryByText('#')).toBeNull()
    expect(screen.getByText('Alpha Item')).toBeTruthy()
  })

  it('renders sticky # header and 1-based increment numbers when showRowIndex is true', () => {
    render(<TestTableWrapper showRowIndex={true} />)

    const header = screen.getByText('#')
    expect(header).toBeTruthy()
    const th = header.closest('th')
    expect(th?.className).toContain('sticky')
    expect(th?.className).toContain('start-0')
    expect(th?.className).toContain('w-12')
    expect(th?.className).toContain('text-center')

    // Expect row order index cells 1, 2, 3
    const cell1 = screen.getByTitle('Row #1')
    const cell2 = screen.getByTitle('Row #2')
    const cell3 = screen.getByTitle('Row #3')

    expect(cell1).toBeTruthy()
    expect(cell1.textContent).toBe('1')
    expect(cell1.className).toContain('sticky')
    expect(cell1.className).toContain('start-0')
    expect(cell1.className).toContain('w-12')

    expect(cell2).toBeTruthy()
    expect(cell2.textContent).toBe('2')
    expect(cell3).toBeTruthy()
    expect(cell3.textContent).toBe('3')
  })

  it('calculates correct paginated row order index on page 2 (pageIndex=1, pageSize=5)', () => {
    const paginatedData: TestItem[] = Array.from({ length: 10 }, (_, i) => ({
      id: `${i + 1}`,
      name: `Item ${i + 1}`,
      status: 'ACTIVE',
    }))

    render(
      <TestTableWrapper
        data={paginatedData}
        showRowIndex={true}
        pageIndex={1}
        pageSize={5}
      />
    )

    // On page 2 (index 1) with pageSize 5, the rows should be 6, 7, 8, 9, 10
    expect(screen.getByTitle('Row #6')).toBeTruthy()
    expect(screen.getByTitle('Row #7')).toBeTruthy()
    expect(screen.getByTitle('Row #8')).toBeTruthy()
    expect(screen.getByTitle('Row #9')).toBeTruthy()
    expect(screen.getByTitle('Row #10')).toBeTruthy()
  })

  it('renders sticky row index with createRowIndexColumn helper in columns array without double-rendering', () => {
    const columnsWithRowIndex: ColumnDef<TestItem>[] = [
      createRowIndexColumn<TestItem>(),
      ...baseColumns,
    ]

    // Even if showRowIndex={true} is passed, it should not double-render #
    render(
      <TestTableWrapper
        columns={columnsWithRowIndex}
        showRowIndex={true}
      />
    )

    const headers = screen.getAllByText('#')
    expect(headers.length).toBe(1)

    const cell1 = screen.getByTitle('Row #1')
    expect(cell1).toBeTruthy()
    expect(cell1.textContent).toBe('1')

    const td = cell1.closest('td')
    expect(td?.className).toContain('sticky')
    expect(td?.className).toContain('start-0')
    expect(td?.className).toContain('w-12')
    expect(td?.className).toContain('text-center')
  })

  it('adjusts empty state colSpan correctly when showRowIndex is true', () => {
    render(
      <TestTableWrapper
        data={[]}
        showRowIndex={true}
      />
    )

    expect(screen.getByText('No results.')).toBeTruthy()
    const emptyCell = screen.getByText('No results.').closest('td')
    // baseColumns has 3 columns, with injected row index it should be 4
    expect(emptyCell?.getAttribute('colspan')).toBe('4')
  })

  it('handles onRowClick properly without interference from row index column', () => {
    const onRowClick = vi.fn()
    render(<TestTableWrapper showRowIndex={true} onRowClick={onRowClick} />)

    const cell1 = screen.getByTitle('Row #1')
    fireEvent.click(cell1)
    expect(onRowClick).toHaveBeenCalledWith(mockData[0])

    const nameCell = screen.getByText('Alpha Item')
    fireEvent.click(nameCell)
    expect(onRowClick).toHaveBeenCalledWith(mockData[0])
  })
})

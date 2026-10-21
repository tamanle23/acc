import React, { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type RowSelectionState,
} from '@tanstack/react-table'
import {
  DataTable,
  createRowIndexColumn,
  createRowSelectColumn,
  ROW_INDEX_COLUMN_ID,
  ROW_SELECT_COLUMN_ID,
} from '../data-table'

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
  showRowSelection,
  onRowClick,
  enableRowSelection = true,
}: {
  data?: TestItem[]
  columns?: ColumnDef<TestItem>[]
  showRowIndex?: boolean
  showRowSelection?: boolean
  onRowClick?: (row: TestItem) => void
  enableRowSelection?: boolean
}) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
    },
    enableRowSelection,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
  })

  return (
    <DataTable
      table={table}
      columns={columns}
      showRowIndex={showRowIndex}
      showRowSelection={showRowSelection}
      onRowClick={onRowClick}
    />
  )
}

describe('DataTable - Sticky Bulk Row Selection Column', () => {
  it('renders bulk row selection column when showRowSelection is true', () => {
    const { container } = render(<TestTableWrapper showRowSelection />)

    // Verify select all checkbox exists in header
    const selectHeader = container.querySelector('th[data-row-select="true"]')
    expect(selectHeader).toBeTruthy()
    const selectAllCheckbox = selectHeader?.querySelector('button[role="checkbox"]')
    expect(selectAllCheckbox).toBeTruthy()

    // Verify row checkboxes exist
    const rowCheckboxes = screen.getAllByLabelText(/select row/i)
    expect(rowCheckboxes).toHaveLength(mockData.length)
  })

  it('pins selection column to start-0 when showRowIndex is false', () => {
    const { container } = render(<TestTableWrapper showRowSelection />)

    const selectHeaders = container.querySelectorAll(`th[data-row-select="true"]`)
    expect(selectHeaders).toHaveLength(1)
    expect(selectHeaders[0].className).toContain('start-0')

    const selectCells = container.querySelectorAll(`td[data-row-select="true"]`)
    expect(selectCells).toHaveLength(mockData.length)
    selectCells.forEach((cell) => {
      expect(cell.className).toContain('start-0')
    })
  })

  it('positions select column to start-12 when both showRowIndex and showRowSelection are true', () => {
    const { container } = render(<TestTableWrapper showRowIndex showRowSelection />)

    // Row index header is at start-0
    const indexHeader = container.querySelector(`th[data-row-index="true"]`)
    expect(indexHeader).toBeTruthy()
    expect(indexHeader?.className).toContain('start-0')

    // Row select header is at start-12
    const selectHeader = container.querySelector(`th[data-row-select="true"]`)
    expect(selectHeader).toBeTruthy()
    expect(selectHeader?.className).toContain('start-12')
    // Select column is the rightmost sticky left column, so it gets the elevation shadow
    expect(selectHeader?.className).toContain('shadow-[6px_0_12px_-4px_rgba(0,0,0,0.06)]')

    // Check cells
    const selectCells = container.querySelectorAll(`td[data-row-select="true"]`)
    expect(selectCells).toHaveLength(mockData.length)
    selectCells.forEach((cell) => {
      expect(cell.className).toContain('start-12')
      expect(cell.className).toContain('shadow-[6px_0_12px_-4px_rgba(0,0,0,0.06)]')
    })
  })

  it('selects and deselects single rows', () => {
    render(<TestTableWrapper showRowSelection />)

    const checkboxes = screen.getAllByLabelText(/select row/i)
    expect(checkboxes[0].getAttribute('data-state')).toBe('unchecked')

    fireEvent.click(checkboxes[0])
    expect(checkboxes[0].getAttribute('data-state')).toBe('checked')

    fireEvent.click(checkboxes[0])
    expect(checkboxes[0].getAttribute('data-state')).toBe('unchecked')
  })

  it('selects and deselects all rows via header checkbox', () => {
    const { container } = render(<TestTableWrapper showRowSelection />)

    const selectHeader = container.querySelector('th[data-row-select="true"]')
    expect(selectHeader).toBeTruthy()
    const selectAll = selectHeader?.querySelector('button[role="checkbox"]')
    expect(selectAll).toBeTruthy()
    const rowCheckboxes = screen.getAllByLabelText(/select row/i)

    // Select all
    fireEvent.click(selectAll!)
    rowCheckboxes.forEach((cb) => {
      expect(cb.getAttribute('data-state')).toBe('checked')
    })

    // Deselect all
    fireEvent.click(selectAll!)
    rowCheckboxes.forEach((cb) => {
      expect(cb.getAttribute('data-state')).toBe('unchecked')
    })
  })

  it('does not trigger onRowClick when clicking selection checkbox or cell', () => {
    const handleRowClick = vi.fn()
    const { container } = render(
      <TestTableWrapper showRowSelection onRowClick={handleRowClick} />
    )

    const checkboxes = screen.getAllByLabelText(/select row/i)
    fireEvent.click(checkboxes[0])

    expect(handleRowClick).not.toHaveBeenCalled()

    // Clicking a regular row cell triggers onRowClick
    const cell = screen.getByText('Alpha Item')
    fireEvent.click(cell)
    expect(handleRowClick).toHaveBeenCalledTimes(1)
    expect(handleRowClick).toHaveBeenCalledWith(mockData[0])
  })

  it('supports explicit createRowSelectColumn in column definitions without duplicate columns', () => {
    const explicitColumns: ColumnDef<TestItem>[] = [
      createRowSelectColumn<TestItem>(),
      ...baseColumns,
    ]

    const { container } = render(
      <TestTableWrapper columns={explicitColumns} showRowSelection={true} />
    )

    const selectHeaders = container.querySelectorAll(`th[data-row-select="true"]`)
    expect(selectHeaders).toHaveLength(1)
  })

  it('adjusts empty state colSpan when row select and row index columns are injected', () => {
    render(
      <TestTableWrapper
        data={[]}
        showRowIndex
        showRowSelection
      />
    )

    // Base columns has 3 columns + 1 (row_index) + 1 (row_select) = 5
    const emptyCell = screen.getByText('No results.').closest('td')
    expect(emptyCell?.getAttribute('colspan')).toBe('5')
  })
})

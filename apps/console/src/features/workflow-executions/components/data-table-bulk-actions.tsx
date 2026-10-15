import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { Trash2, CircleArrowUp, ArrowUpDown, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { priorities, statuses } from '../types'
import { type WorkflowExecution } from '../schema'
import { WorkflowExecutionsMultiDeleteDialog } from './workflow-executions-multi-delete-dialog'
import { toast } from 'sonner'
import {
  useBulkUpdateWorkflowExecutionsStatusMutation,
  useBulkUpdateWorkflowExecutionsPriorityMutation,
} from '../api/use-workflow-executions'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type DataTableBulkActionsProps<TData> = {
  table: Table<TData>
}

export function DataTableBulkActions<TData>({
  table,
}: DataTableBulkActionsProps<TData>) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const bulkStatusMutation = useBulkUpdateWorkflowExecutionsStatusMutation()
  const bulkPriorityMutation = useBulkUpdateWorkflowExecutionsPriorityMutation()

  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleBulkStatusChange = async (status: string) => {
    const selectedWorkflowExecutions = selectedRows.map((row) => row.original as WorkflowExecution)
    const ids = selectedWorkflowExecutions.map((t) => t.id)
    table.resetRowSelection()
    await bulkStatusMutation.mutateAsync({ ids, status })
  }

  const handleBulkPriorityChange = async (priority: string) => {
    const selectedWorkflowExecutions = selectedRows.map((row) => row.original as WorkflowExecution)
    const ids = selectedWorkflowExecutions.map((t) => t.id)
    table.resetRowSelection()
    await bulkPriorityMutation.mutateAsync({ ids, priority })
  }

  const handleBulkExport = () => {
    const selectedWorkflowExecutions = selectedRows.map((row) => row.original as WorkflowExecution)
    toast.promise(sleep(2000), {
      loading: 'Exporting workflowExecutions...',
      success: () => {
        table.resetRowSelection()
        return `Exported ${selectedWorkflowExecutions.length} workflow execution${selectedWorkflowExecutions.length > 1 ? 's' : ''} to CSV.`
      },
      error: 'Error',
    })
    table.resetRowSelection()
  }

  return (
    <>
      <BulkActionsToolbar table={table} entityName='workflow execution'>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='outline'
                  size='icon'
                  className='size-8'
                  aria-label='Update status'
                  title='Update status'
                >
                  <CircleArrowUp />
                  <span className='sr-only'>Update status</span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Update status</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent sideOffset={14}>
            {statuses.map((status) => (
              <DropdownMenuItem
                key={status.value}
                defaultValue={status.value}
                onClick={() => handleBulkStatusChange(status.value)}
              >
                {status.icon && (
                  <status.icon className='size-4 text-muted-foreground' />
                )}
                {status.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='outline'
                  size='icon'
                  className='size-8'
                  aria-label='Update priority'
                  title='Update priority'
                >
                  <ArrowUpDown />
                  <span className='sr-only'>Update priority</span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Update priority</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent sideOffset={14}>
            {priorities.map((priority) => (
              <DropdownMenuItem
                key={priority.value}
                defaultValue={priority.value}
                onClick={() => handleBulkPriorityChange(priority.value)}
              >
                {priority.icon && (
                  <priority.icon className='size-4 text-muted-foreground' />
                )}
                {priority.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={() => handleBulkExport()}
              className='size-8'
              aria-label='Export workflowExecutions'
              title='Export workflowExecutions'
            >
              <Download />
              <span className='sr-only'>Export workflowExecutions</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Export workflowExecutions</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              onClick={() => setShowDeleteConfirm(true)}
              className='size-8'
              aria-label='Delete selected workflowExecutions'
              title='Delete selected workflowExecutions'
            >
              <Trash2 />
              <span className='sr-only'>Delete selected workflowExecutions</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete selected workflowExecutions</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      <WorkflowExecutionsMultiDeleteDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        table={table}
      />
    </>
  )
}

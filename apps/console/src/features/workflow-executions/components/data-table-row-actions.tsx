import { type Row } from '@tanstack/react-table'
import { MoreHorizontal, Trash2, Eye, ExternalLink, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { labels } from '../types'
import { workflowExecutionSchema } from '../schema'
import { useWorkflowExecutions } from './workflow-executions-provider'
import { useNavigate } from '@tanstack/react-router'

type DataTableRowActionsProps<TData> = {
  row: Row<TData>
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const workflowExecution = workflowExecutionSchema.parse(row.original)
  const { setOpen, setCurrentRow } = useWorkflowExecutions()
  const navigate = useNavigate()

  const handleOpenStudio = () => {
    navigate({
      to: '/workflows' as any,
    })
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          aria-label={`Actions for execution ${workflowExecution.id}`}
          className='flex h-8 w-8 p-0 data-[state=open]:bg-muted'
        >
          <MoreHorizontal className='h-4 w-4' />
          <span className='sr-only'>Actions for execution {workflowExecution.id}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-[200px]'>
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(workflowExecution)
            setOpen('inspect')
          }}
          className='gap-2'
        >
          <Eye className='size-4 text-primary' />
          Inspect Execution
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(workflowExecution)
            setOpen('live-stream')
          }}
          className='gap-2'
        >
          <ExternalLink className='size-4 text-emerald-500' />
          Live Execution Stream
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={handleOpenStudio}
          className='gap-2'
        >
          <SlidersHorizontal className='size-4 text-indigo-500' />
          Design in Studio
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(workflowExecution)
            setOpen('update')
          }}
        >
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem disabled>Make a copy</DropdownMenuItem>
        <DropdownMenuItem disabled>Favorite</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Labels</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={workflowExecution.label}>
              {labels.map((label) => (
                <DropdownMenuRadioItem key={label.value} value={label.value}>
                  {label.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(workflowExecution)
            setOpen('delete')
          }}
        >
          Delete
          <DropdownMenuShortcut>
            <Trash2 size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

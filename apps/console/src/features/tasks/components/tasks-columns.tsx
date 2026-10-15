import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { priorities, statuses, taskTypeMeta } from '../data/data'
import { type Task } from '../data/schema'
import { DataTableRowActions } from './data-table-row-actions'
import { GitBranch, Cpu, Clock } from 'lucide-react'
import { Link } from '@tanstack/react-router'

export const tasksColumns: ColumnDef<Task>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
        className='translate-y-[2px]'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
        className='translate-y-[2px]'
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Execution Unit / ID' />
    ),
    cell: ({ row }) => (
      <div className='flex flex-col'>
        <span className='font-mono text-xs font-semibold'>{row.original.id}</span>
        {row.original.taskReferenceName && (
          <span className='font-mono text-[10px] text-muted-foreground'>
            ref: {row.original.taskReferenceName}
          </span>
        )}
      </div>
    ),
    enableSorting: true,
    enableHiding: false,
  },
  {
    accessorKey: 'workflowId',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Workflow Definition' />
    ),
    cell: ({ row }) => {
      const wfId = row.original.workflowId;
      if (!wfId) {
        return <span className='text-xs text-muted-foreground italic'>Direct Execution</span>;
      }
      return (
        <Link
          to={'/workflows' as any}
          className='inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 text-xs font-medium text-primary transition-colors'
        >
          <GitBranch className='w-3 h-3' />
          <span className='truncate max-w-[130px]'>{row.original.workflowName || wfId}</span>
        </Link>
      );
    },
  },
  {
    accessorKey: 'taskType',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Type' />
    ),
    cell: ({ row }) => {
      const type = row.original.taskType || 'SIMPLE';
      const meta = taskTypeMeta[type] || taskTypeMeta.SIMPLE;
      const Icon = meta.icon;

      return (
        <Badge variant='outline' className={`text-[11px] gap-1 font-semibold ${meta.color}`}>
          <Icon className='w-3 h-3' />
          {meta.label}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'title',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Title / Execution Description' />
    ),
    meta: {
      className: 'ps-1 max-w-0 w-2/5',
      tdClassName: 'ps-4',
    },
    cell: ({ row }) => {
      return (
        <div className='flex flex-col min-w-0'>
          <span className='truncate font-medium text-sm'>{row.getValue('title')}</span>
          {row.original.errorMessage && (
            <span className='text-[10px] text-rose-500 truncate'>
              Error: {row.original.errorMessage}
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    meta: { className: 'ps-1', tdClassName: 'ps-4' },
    cell: ({ row }) => {
      const statusValue = row.getValue('status') as string;
      const status = statuses.find((s) => s.value.toLowerCase() === statusValue.toLowerCase());

      const isCompleted = statusValue === 'COMPLETED' || statusValue === 'done';
      const isInProgress = statusValue === 'IN_PROGRESS' || statusValue === 'in progress';
      const isFailed = statusValue === 'FAILED';

      return (
        <div className='flex w-[120px] items-center gap-1.5'>
          {status?.icon && (
            <status.icon
              className={`size-3.5 ${
                isCompleted
                  ? 'text-emerald-500'
                  : isInProgress
                  ? 'text-sky-500 animate-spin'
                  : isFailed
                  ? 'text-rose-500'
                  : 'text-muted-foreground'
              }`}
            />
          )}
          <span className={`text-xs font-semibold ${
            isCompleted
              ? 'text-emerald-600 dark:text-emerald-400'
              : isInProgress
              ? 'text-sky-600 dark:text-sky-400'
              : isFailed
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-foreground'
          }`}>
            {status?.label || statusValue}
          </span>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: 'leaseOwner',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Worker / Lease' />
    ),
    cell: ({ row }) => {
      const owner = row.original.leaseOwner;
      const duration = row.original.durationMs;
      return (
        <div className='flex flex-col text-xs'>
          <div className='flex items-center gap-1 text-muted-foreground font-mono'>
            <Cpu className='w-3 h-3 text-primary/70' />
            <span className='truncate max-w-[100px]'>{owner || 'Engine / Decider'}</span>
          </div>
          {duration ? (
            <span className='text-[10px] text-muted-foreground/70 flex items-center gap-0.5'>
              <Clock className='w-2.5 h-2.5' /> {duration}ms
            </span>
          ) : null}
        </div>
      );
    },
  },
  {
    accessorKey: 'priority',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Priority' />
    ),
    meta: { className: 'ps-1', tdClassName: 'ps-3' },
    cell: ({ row }) => {
      const priority = priorities.find(
        (priority) => priority.value === row.getValue('priority')
      );

      if (!priority) {
        return null;
      }

      return (
        <div className='flex items-center gap-1.5 text-xs'>
          {priority.icon && (
            <priority.icon className='size-3.5 text-muted-foreground' />
          )}
          <span>{priority.label}</span>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
]

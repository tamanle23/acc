import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { WorkflowExecutions } from '@/features/workflow-executions'
import { priorities, statuses } from '@/features/workflow-executions/types'

const statusValues = statuses.map((status: { value: string }) => status.value) as [string, ...string[]]
const priorityValues = priorities.map((priority: { value: string }) => priority.value) as [string, ...string[]]

const workflowExecutionSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  status: z
    .array(z.enum(statusValues))
    .optional()
    .catch([]),
  priority: z
    .array(z.enum(priorityValues))
    .optional()
    .catch([]),
  filter: z.string().optional().catch(''),
})

export const Route = createFileRoute('/_authenticated/workflow-executions/')({
  validateSearch: workflowExecutionSearchSchema,
  component: WorkflowExecutions,
})

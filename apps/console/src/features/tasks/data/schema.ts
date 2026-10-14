import { z } from 'zod'

export const taskExecutionStatusSchema = z.enum([
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'TIMED_OUT',
  'SKIPPED',
  // legacy status mappings
  'backlog',
  'todo',
  'in progress',
  'done',
  'canceled',
])

export type TaskExecutionStatus = z.infer<typeof taskExecutionStatusSchema>

export const workflowTaskExecutionSchema = z.object({
  id: z.string(),
  taskId: z.string().optional(),
  title: z.string(),
  status: taskExecutionStatusSchema,
  label: z.string().default('workflow'),
  priority: z.string().default('medium'),
  // Workflow Execution Unit Attributes
  workflowId: z.string().optional(),
  workflowName: z.string().optional(),
  taskReferenceName: z.string().optional(),
  taskType: z
    .enum(['SIMPLE', 'SWITCH', 'FORK_JOIN', 'DYNAMIC_FORK', 'WAIT', 'DO_WHILE', 'MANUAL'])
    .default('SIMPLE'),
  leaseOwner: z.string().nullable().optional(),
  attempt: z.number().default(1),
  maxRetries: z.number().default(3),
  pollDomain: z.string().default('default'),
  visibleAtEpochMs: z.number().optional(),
  durationMs: z.number().optional(),
  inputData: z.record(z.string(), z.unknown()).optional(),
  outputData: z.record(z.string(), z.unknown()).optional(),
  errorMessage: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
})

export const taskSchema = workflowTaskExecutionSchema

export type Task = z.infer<typeof taskSchema>
export type WorkflowTaskExecution = z.infer<typeof workflowTaskExecutionSchema>

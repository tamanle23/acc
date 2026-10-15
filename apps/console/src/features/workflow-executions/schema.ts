import { z } from 'zod'

export const workflowExecutionStatusSchema = z.enum([
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'TIMED_OUT',
  'SKIPPED',
  // legacy status mappings for backward compatibility
  'backlog',
  'todo',
  'in progress',
  'done',
  'canceled',
])

export type WorkflowExecutionStatus = z.infer<typeof workflowExecutionStatusSchema>

export const workflowExecutionSchema = z.object({
  id: z.string(),
  taskId: z.string().optional(),
  title: z.string(),
  status: workflowExecutionStatusSchema,
  label: z.string().default('workflow'),
  priority: z.string().default('medium'),
  // Workflow Execution Level Attributes
  workflowId: z.string().optional(),
  workflowName: z.string().optional(),
  activeStep: z.string().optional(), // Current node / milestone in DAG
  taskReferenceName: z.string().optional(), // Internal node reference for telemetry
  // Internal engine implementation metadata (encapsulated from primary table)
  taskType: z
    .enum(['SIMPLE', 'SWITCH', 'FORK_JOIN', 'DYNAMIC_FORK', 'WAIT', 'DO_WHILE', 'MANUAL'])
    .optional(),
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


export type WorkflowExecution = z.infer<typeof workflowExecutionSchema>
export type WorkflowWorkflowExecution = WorkflowExecution

import { ConfirmDialog } from '@/components/confirm-dialog'
import { WorkflowExecutionsImportDialog } from './workflow-executions-import-dialog'
import { WorkflowExecutionsMutateDrawer } from './workflow-executions-mutate-drawer'
import { WorkflowExecutionPayloadInspectorDialog } from './workflow-payload-inspector-dialog'
import { WorkflowExecutionStreamModal } from './workflow-execution-stream-modal'
import { WorkflowExecutionDetailDrawer } from './workflow-execution-detail-drawer'
import { useWorkflowExecutions } from './workflow-executions-provider'
import { useDeleteWorkflowExecutionMutation } from '../api/use-workflow-executions'

import { WorkflowSimulationModal } from '@/features/workflows/components/studio/modals/workflow-simulation-modal'
import { workflowExecutionsSandboxRepo } from '@/core/sandbox'

export function WorkflowExecutionsDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useWorkflowExecutions()
  const deleteWorkflowExecutionMutation = useDeleteWorkflowExecutionMutation()

  return (
    <>
      <WorkflowSimulationModal
        open={open === 'simulate'}
        onOpenChange={(isOpen) => {
          if (!isOpen) setOpen(null)
        }}
        onStartSimulation={(simExecId) => {
          // Register simulated execution so it is immediately inspectable in the table and modal
          const newExec = {
            id: simExecId,
            title: `Multi-Branch Order Simulation (${simExecId})`,
            status: 'IN_PROGRESS' as const,
            label: 'workflow',
            priority: 'high',
            workflowId: 'order-fulfillment-pipeline',
            workflowName: 'Order Fulfillment Pipeline',
            activeStep: 'validateOrder',
            taskReferenceName: 'validateOrder',
            taskType: 'SIMPLE',
            startedAt: new Date().toISOString(),
          }
          workflowExecutionsSandboxRepo.create(newExec as any)
          setCurrentRow(newExec as any)
          setOpen('live-stream')
        }}
      />

      <WorkflowExecutionsMutateDrawer
        key='workflow-execution-create'
        open={open === 'create'}
        onOpenChange={() => setOpen('create')}
      />

      <WorkflowExecutionsImportDialog
        key='workflow-executions-import'
        open={open === 'import'}
        onOpenChange={() => setOpen('import')}
      />

      {currentRow && (
        <>
          <WorkflowExecutionDetailDrawer
            key={`workflow-execution-drawer-${currentRow.id}`}
            workflowExecution={currentRow}
            open={open === 'drawer'}
            onOpenChange={(isOpen) => {
              if (!isOpen) {
                setOpen(null)
                setTimeout(() => {
                  setCurrentRow(null)
                }, 300)
              }
            }}
          />

          <WorkflowExecutionStreamModal
            key={`workflow-execution-stream-${currentRow.id}`}
            workflowExecution={currentRow}
            open={open === 'live-stream'}
            onOpenChange={(isOpen) => {
              if (!isOpen) {
                setOpen(null)
                setTimeout(() => {
                  setCurrentRow(null)
                }, 300)
              }
            }}
          />

          <WorkflowExecutionPayloadInspectorDialog
            key={`workflow-execution-inspect-${currentRow.id}`}
            workflowExecution={currentRow}
            open={open === 'inspect'}
            onOpenChange={(isOpen) => {
              if (!isOpen) {
                setOpen(null)
                setTimeout(() => {
                  setCurrentRow(null)
                }, 300)
              }
            }}
          />

          <WorkflowExecutionsMutateDrawer
            key={`workflow-execution-update-${currentRow.id}`}
            open={open === 'update'}
            onOpenChange={() => {
              setOpen('update')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            currentRow={currentRow}
          />

          <ConfirmDialog
            key='workflow-execution-delete'
            destructive
            open={open === 'delete'}
            onOpenChange={() => {
              setOpen('delete')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            handleConfirm={async () => {
              const idToDelete = currentRow.id
              setOpen(null)
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
              await deleteWorkflowExecutionMutation.mutateAsync(idToDelete)
            }}
            className='max-w-md'
            title={`Delete this workflow-execution: ${currentRow.id} ?`}
            desc={
              <>
                You are about to delete a workflow-execution with the ID{' '}
                <strong>{currentRow.id}</strong>. <br />
                This action cannot be undone.
              </>
            }
            confirmText='Delete'
          />
        </>
      )}
    </>
  )
}

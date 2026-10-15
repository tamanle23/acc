import { ConfirmDialog } from '@/components/confirm-dialog'
import { WorkflowExecutionsImportDialog } from './workflow-executions-import-dialog'
import { WorkflowExecutionsMutateDrawer } from './workflow-executions-mutate-drawer'
import { WorkflowExecutionPayloadInspectorDialog } from './workflow-payload-inspector-dialog'
import { WorkflowExecutionStreamModal } from './workflow-execution-stream-modal'
import { useWorkflowExecutions } from './workflow-executions-provider'
import { useDeleteWorkflowExecutionMutation } from '../api/use-workflow-executions'

export function WorkflowExecutionsDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useWorkflowExecutions()
  const deleteWorkflowExecutionMutation = useDeleteWorkflowExecutionMutation()

  return (
    <>
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

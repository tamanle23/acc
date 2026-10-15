import { ConfirmDialog } from '@/components/confirm-dialog'
import { TasksImportDialog } from './tasks-import-dialog'
import { TasksMutateDrawer } from './tasks-mutate-drawer'
import { TaskPayloadInspectorDialog } from './task-payload-inspector-dialog'
import { TaskExecutionStreamModal } from './task-execution-stream-modal'
import { useTasks } from './tasks-provider'
import { useDeleteTaskMutation } from '../api/use-tasks'

export function TasksDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useTasks()
  const deleteTaskMutation = useDeleteTaskMutation()

  return (
    <>
      <TasksMutateDrawer
        key='task-create'
        open={open === 'create'}
        onOpenChange={() => setOpen('create')}
      />

      <TasksImportDialog
        key='tasks-import'
        open={open === 'import'}
        onOpenChange={() => setOpen('import')}
      />

      {currentRow && (
        <>
          <TaskExecutionStreamModal
            key={`task-stream-${currentRow.id}`}
            task={currentRow}
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

          <TaskPayloadInspectorDialog
            key={`task-inspect-${currentRow.id}`}
            task={currentRow}
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

          <TasksMutateDrawer
            key={`task-update-${currentRow.id}`}
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
            key='task-delete'
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
              await deleteTaskMutation.mutateAsync(idToDelete)
            }}
            className='max-w-md'
            title={`Delete this task: ${currentRow.id} ?`}
            desc={
              <>
                You are about to delete a task with the ID{' '}
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

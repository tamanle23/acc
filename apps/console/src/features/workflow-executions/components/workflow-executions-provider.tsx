import React, { useState } from 'react'
import useDialogState from '@/hooks/use-dialog-state'
import { type WorkflowExecution } from '../schema'

type WorkflowExecutionsDialogType = 'create' | 'update' | 'delete' | 'import' | 'inspect' | 'live-stream' | 'drawer'

type WorkflowExecutionsContextType = {
  open: WorkflowExecutionsDialogType | null
  setOpen: (str: WorkflowExecutionsDialogType | null) => void
  currentRow: WorkflowExecution | null
  setCurrentRow: React.Dispatch<React.SetStateAction<WorkflowExecution | null>>
}

const WorkflowExecutionsContext = React.createContext<WorkflowExecutionsContextType | null>(null)

export function WorkflowExecutionsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useDialogState<WorkflowExecutionsDialogType>(null)
  const [currentRow, setCurrentRow] = useState<WorkflowExecution | null>(null)

  const contextValue = React.useMemo<WorkflowExecutionsContextType>(
    () => ({ open, setOpen, currentRow, setCurrentRow }),
    [open, setOpen, currentRow, setCurrentRow]
  )

  return (
    <WorkflowExecutionsContext value={contextValue}>
      {children}
    </WorkflowExecutionsContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useWorkflowExecutions = () => {
  const workflowExecutionsContext = React.useContext(WorkflowExecutionsContext)

  if (!workflowExecutionsContext) {
    throw new Error('useWorkflowExecutions has to be used within <WorkflowExecutionsContext>')
  }

  return workflowExecutionsContext
}

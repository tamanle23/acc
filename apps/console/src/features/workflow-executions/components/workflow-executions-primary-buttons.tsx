import { Download, Plus, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkflowExecutions } from './workflow-executions-provider'

export function WorkflowExecutionsPrimaryButtons() {
  const { setOpen } = useWorkflowExecutions()
  return (
    <div className='flex gap-2'>
      <Button
        variant='outline'
        className='space-x-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
        onClick={() => setOpen('simulate')}
        title='Launch Multi-Branch Live Execution Simulation'
        data-testid='workflow-executions-simulate-btn'
      >
        <Play size={16} /> <span>Simulate</span>
      </Button>
      <Button
        variant='outline'
        className='space-x-1'
        onClick={() => setOpen('import')}
      >
        <span>Import</span> <Download size={18} />
      </Button>
      <Button className='space-x-1' onClick={() => setOpen('create')}>
        <span>Create</span> <Plus size={18} />
      </Button>
    </div>
  )
}

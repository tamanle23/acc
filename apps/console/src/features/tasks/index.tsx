import { useState, useMemo } from 'react'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { LanguageSwitch } from '@/components/language-switch'
import { TasksDialogs } from './components/tasks-dialogs'
import { TasksPrimaryButtons } from './components/tasks-primary-buttons'
import { TasksProvider } from './components/tasks-provider'
import { TasksTable } from './components/tasks-table'
import { useTasksQuery } from './api/use-tasks'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Activity, ListTodo, Workflow } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function Tasks() {
  const { data: tasks = [], isLoading } = useTasksQuery()
  const [activeTab, setActiveTab] = useState<'workflow' | 'manual'>('workflow')

  const workflowTasks = useMemo(() => {
    return tasks.filter((t) => !!t.workflowId || t.label === 'workflow' || t.taskType !== 'MANUAL')
  }, [tasks])

  const manualTasks = useMemo(() => {
    return tasks.filter((t) => !t.workflowId && (t.label !== 'workflow' || t.taskType === 'MANUAL'))
  }, [tasks])

  const displayedTasks = activeTab === 'workflow' ? workflowTasks : manualTasks

  return (
    <TasksProvider>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <LanguageSwitch />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <div className='flex items-center gap-2'>
              <h1 className='text-2xl font-bold tracking-tight'>Execution Units & Tasks</h1>
              <Badge variant='outline' className='text-xs bg-primary/10 border-primary/20 gap-1'>
                <Activity className='w-3 h-3 text-primary animate-pulse' />
                Visual DAG Engine
              </Badge>
            </div>
            <p className='text-muted-foreground text-sm mt-1'>
              Inspect real-time distributed execution units dispatched by workflow DAGs or manage manual operational tasks.
            </p>
          </div>
          <TasksPrimaryButtons />
        </div>

        {/* Dual Mode Switcher */}
        <div className='flex items-center justify-between border-b border-border/40 pb-2'>
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as 'workflow' | 'manual')}
            className='w-auto'
          >
            <TabsList className='grid grid-cols-2 w-[340px]'>
              <TabsTrigger value='workflow' className='gap-2 text-xs font-semibold'>
                <Workflow className='w-3.5 h-3.5 text-primary' />
                Workflow Tasks ({workflowTasks.length})
              </TabsTrigger>
              <TabsTrigger value='manual' className='gap-2 text-xs font-semibold'>
                <ListTodo className='w-3.5 h-3.5 text-slate-500' />
                Manual Backlog ({manualTasks.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <div className='space-y-4'>
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-96 w-full' />
          </div>
        ) : (
          <TasksTable data={displayedTasks} />
        )}
      </Main>

      <TasksDialogs />
    </TasksProvider>
  )
}

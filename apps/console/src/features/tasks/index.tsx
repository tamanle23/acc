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
import { Activity, Play, CheckCircle2, AlertCircle, Layers } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function Tasks() {
  const { data: tasks = [], isLoading } = useTasksQuery()
  const [activeTab, setActiveTab] = useState<'all' | 'running' | 'completed' | 'failed'>('all')

  const runningExecutions = useMemo(() => {
    return tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'SCHEDULED')
  }, [tasks])

  const completedExecutions = useMemo(() => {
    return tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'done')
  }, [tasks])

  const failedExecutions = useMemo(() => {
    return tasks.filter((t) => t.status === 'FAILED' || t.status === 'TIMED_OUT')
  }, [tasks])

  const displayedTasks = useMemo(() => {
    switch (activeTab) {
      case 'running':
        return runningExecutions
      case 'completed':
        return completedExecutions
      case 'failed':
        return failedExecutions
      case 'all':
      default:
        return tasks
    }
  }, [activeTab, tasks, runningExecutions, completedExecutions, failedExecutions])

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
              <h1 className='text-2xl font-bold tracking-tight'>Workflow Executions</h1>
              <Badge variant='outline' className='text-xs bg-primary/10 border-primary/20 gap-1'>
                <Activity className='w-3 h-3 text-primary animate-pulse' />
                Visual DAG Engine
              </Badge>
            </div>
            <p className='text-muted-foreground text-sm mt-1'>
              Inspect and monitor real-time distributed execution instances and units dispatched by workflow DAGs.
            </p>
          </div>
          <TasksPrimaryButtons />
        </div>

        {/* Lifecycle Status Switcher */}
        <div className='flex items-center justify-between border-b border-border/40 pb-2'>
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as any)}
            className='w-auto'
          >
            <TabsList className='grid grid-cols-4 w-[540px]'>
              <TabsTrigger value='all' className='gap-1.5 text-xs font-semibold'>
                <Layers className='w-3.5 h-3.5 text-primary' />
                All ({tasks.length})
              </TabsTrigger>
              <TabsTrigger value='running' className='gap-1.5 text-xs font-semibold'>
                <Play className='w-3.5 h-3.5 text-sky-500' />
                In Progress ({runningExecutions.length})
              </TabsTrigger>
              <TabsTrigger value='completed' className='gap-1.5 text-xs font-semibold'>
                <CheckCircle2 className='w-3.5 h-3.5 text-emerald-500' />
                Completed ({completedExecutions.length})
              </TabsTrigger>
              <TabsTrigger value='failed' className='gap-1.5 text-xs font-semibold'>
                <AlertCircle className='w-3.5 h-3.5 text-rose-500' />
                Failed ({failedExecutions.length})
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

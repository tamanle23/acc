import { useState, useMemo } from 'react'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { LanguageSwitch } from '@/components/language-switch'
import { WorkflowExecutionsDialogs } from './components/workflow-executions-dialogs'
import { WorkflowExecutionsPrimaryButtons } from './components/workflow-executions-primary-buttons'
import { WorkflowExecutionsProvider } from './components/workflow-executions-provider'
import { WorkflowExecutionsTable } from './components/workflow-executions-table'
import { useWorkflowExecutionsQuery } from './api/use-workflow-executions'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Activity, Play, CheckCircle2, AlertCircle, Layers } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { WorkflowExecutionsKpiBar } from './components/workflow-executions-kpi-bar'

export function WorkflowExecutions() {
  const { data: workflowExecutions = [], isLoading } = useWorkflowExecutionsQuery()
  const [activeTab, setActiveTab] = useState<'all' | 'running' | 'completed' | 'failed'>('all')

  const runningExecutions = useMemo(() => {
    return workflowExecutions.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'SCHEDULED')
  }, [workflowExecutions])

  const completedExecutions = useMemo(() => {
    return workflowExecutions.filter((t) => t.status === 'COMPLETED' || t.status === 'done')
  }, [workflowExecutions])

  const failedExecutions = useMemo(() => {
    return workflowExecutions.filter((t) => t.status === 'FAILED' || t.status === 'TIMED_OUT')
  }, [workflowExecutions])

  const displayedWorkflowExecutions = useMemo(() => {
    switch (activeTab) {
      case 'running':
        return runningExecutions
      case 'completed':
        return completedExecutions
      case 'failed':
        return failedExecutions
      case 'all':
      default:
        return workflowExecutions
    }
  }, [activeTab, workflowExecutions, runningExecutions, completedExecutions, failedExecutions])

  return (
    <WorkflowExecutionsProvider>
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
          <WorkflowExecutionsPrimaryButtons />
        </div>

        {/* 1. Live Telemetry KPI Cards */}
        <WorkflowExecutionsKpiBar executions={workflowExecutions} />

        {/* 2. Lifecycle Status Switcher */}
        <div className='flex items-center justify-between border-b border-border/40 pb-2'>
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as any)}
            className='w-auto'
          >
            <TabsList className='grid grid-cols-4 w-[540px]'>
              <TabsTrigger value='all' className='gap-1.5 text-xs font-semibold'>
                <Layers className='w-3.5 h-3.5 text-primary' />
                All ({workflowExecutions.length})
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
          <WorkflowExecutionsTable data={displayedWorkflowExecutions} />
        )}
      </Main>

      <WorkflowExecutionsDialogs />
    </WorkflowExecutionsProvider>
  )
}

import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  ChevronRight,
  Laptop,
  Moon,
  Sun,
  Database,
  Play,
  RotateCcw,
  Sparkles,
  Building2,
  Workflow,
  Download,
  Search,
} from 'lucide-react'
import { useSearch } from '@/context/search-provider'
import { useTheme } from '@/context/theme-provider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { QueryClientContext } from '@tanstack/react-query'
import { useSidebarData } from '@/components/layout/data/sidebar-data'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useEntityTypes } from '@/features/metadata/api/metadata-api'
import { useProfileStore } from '@/stores/profile-store'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

function CommandPaletteEntitySection({
  runCommand,
  navigate,
}: {
  runCommand: (command: () => unknown) => void
  navigate: (opts: { to: string; search?: Record<string, unknown> }) => void
}) {
  const { data: entityTypes } = useEntityTypes()

  if (!entityTypes || entityTypes.length === 0) return null

  return (
    <CommandGroup heading="Dynamic Entity Types">
      {entityTypes.slice(0, 8).map((et) => (
        <CommandItem
          key={et.id}
          value={`entity-${et.name}-${et.systemName}`}
          onSelect={() => {
            runCommand(() => {
              navigate({
                to: '/metadata/data-explorer',
                search: { entityType: String(et.id) },
              })
            })
          }}
          className="flex items-center gap-2 cursor-pointer rounded-lg px-2.5 py-2 hover:bg-primary/10 transition-colors"
        >
          <Database className="size-4 text-primary shrink-0" />
          <span className="font-medium text-foreground">{et.name}</span>
          <span className="text-xs text-muted-foreground font-mono ml-auto">
            {et.systemName}
          </span>
        </CommandItem>
      ))}
    </CommandGroup>
  )
}

export function CommandPalette() {
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()
  const sidebarData = useSidebarData()
  const hasQueryClient = !!React.useContext(QueryClientContext)
  const { currentProfile, profiles, setCurrentProfile } = useProfileStore()

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  const handleResetSandbox = React.useCallback(() => {
    runCommand(() => {
      try {
        if (typeof window !== 'undefined') {
          // Clear any local caches / simulated state keys
          localStorage.removeItem('unipost_view_presets')
          localStorage.removeItem('unipost_density_profile')
        }
        toast.success('Sandbox state & view presets reset to factory defaults')
      } catch {
        toast.error('Failed to reset sandbox state')
      }
    })
  }, [runCommand])

  const handleExportData = React.useCallback(() => {
    runCommand(() => {
      try {
        const dump = {
          tenant: currentProfile?.tenantId || 'SYSTEM',
          exportedAt: new Date().toISOString(),
          profile: currentProfile?.name,
        }
        const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `unipost-export-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('Tenant configuration exported successfully')
      } catch {
        toast.error('Export failed')
      }
    })
  }, [runCommand, currentProfile])

  return (
    <CommandDialog
      modal
      open={open}
      onOpenChange={setOpen}
      className={cn(
        'max-w-2xl rounded-2xl border border-white/20 dark:border-white/10',
        'bg-white/75 dark:bg-slate-900/80 backdrop-blur-2xl shadow-2xl overflow-hidden'
      )}
    >
      <CommandInput placeholder="Type a command or search entities, workflows, screens..." />
      <CommandList className="max-h-[380px] p-2">
        <ScrollArea type="hover" className="h-[360px] pe-2">
          <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
            <Search className="mx-auto size-6 mb-2 opacity-40" />
            No results found. Try searching for an entity, screen, or action.
          </CommandEmpty>

          {/* Quick Entity Type Switcher */}
          {hasQueryClient && (
            <CommandPaletteEntitySection runCommand={runCommand} navigate={navigate} />
          )}

          {/* Navigation Items from Sidebar */}
          {sidebarData.navGroups.map((group) => (
            <CommandGroup key={group.title} heading={group.title}>
              {group.items.map((navItem, i) => {
                if (navItem.url) {
                  return (
                    <CommandItem
                      key={`${navItem.url}-${i}`}
                      value={`${group.title} ${navItem.title}`}
                      onSelect={() => {
                        runCommand(() => navigate({ to: navItem.url }))
                      }}
                      className="flex items-center gap-2 cursor-pointer rounded-lg px-2.5 py-2 hover:bg-primary/10 transition-colors"
                    >
                      <div className="flex size-4 items-center justify-center">
                        <ArrowRight className="size-3 text-muted-foreground/80" />
                      </div>
                      <span>{navItem.title}</span>
                    </CommandItem>
                  )
                }

                return navItem.items?.map((subItem, j) => (
                  <CommandItem
                    key={`${navItem.title}-${subItem.url}-${j}`}
                    value={`${group.title} ${navItem.title} ${subItem.title}`}
                    onSelect={() => {
                      runCommand(() => navigate({ to: subItem.url }))
                    }}
                    className="flex items-center gap-2 cursor-pointer rounded-lg px-2.5 py-2 hover:bg-primary/10 transition-colors"
                  >
                    <div className="flex size-4 items-center justify-center">
                      <ArrowRight className="size-3 text-muted-foreground/80" />
                    </div>
                    <span>{navItem.title}</span>
                    <ChevronRight className="size-3 text-muted-foreground/50" />
                    <span className="text-foreground/90 font-medium">{subItem.title}</span>
                  </CommandItem>
                ))
              })}
            </CommandGroup>
          ))}

          {/* Workflows & Triggers */}
          <CommandGroup heading="Workflow Automations & Triggers">
            <CommandItem
              value="workflow approvals inbox review"
              onSelect={() => runCommand(() => navigate({ to: '/workflows' }))}
              className="flex items-center gap-2 cursor-pointer rounded-lg px-2.5 py-2 hover:bg-primary/10"
            >
              <Workflow className="size-4 text-amber-500 shrink-0" />
              <span>Approvals Inbox & Pending Tasks</span>
            </CommandItem>
            <CommandItem
              value="workflow execution trigger ingestion"
              onSelect={() => {
                runCommand(() => {
                  toast.success('Dispatched Ingestion Workflow Execution')
                  navigate({ to: '/workflow-executions' })
                })
              }}
              className="flex items-center gap-2 cursor-pointer rounded-lg px-2.5 py-2 hover:bg-primary/10"
            >
              <Play className="size-4 text-emerald-500 shrink-0" />
              <span>Trigger Batch Ingestion Workflow</span>
            </CommandItem>
            <CommandItem
              value="schema drift analysis trigger check"
              onSelect={() => {
                runCommand(() => {
                  toast.info('Running tenant-wide schema drift verification...')
                  navigate({ to: '/metadata/data-explorer' })
                })
              }}
              className="flex items-center gap-2 cursor-pointer rounded-lg px-2.5 py-2 hover:bg-primary/10"
            >
              <Sparkles className="size-4 text-indigo-500 shrink-0" />
              <span>Run Schema Drift Analysis</span>
            </CommandItem>
          </CommandGroup>

          {/* Persona & Workspace Switcher */}
          {profiles && profiles.length > 0 && (
            <CommandGroup heading="Switch Workspace / Persona">
              {profiles.map((p) => {
                const isCurrent = currentProfile?.id === p.id
                return (
                  <CommandItem
                    key={p.id || p.name}
                    value={`switch persona profile ${p.name} ${p.tenantId}`}
                    onSelect={() => {
                      runCommand(() => {
                        setCurrentProfile(p)
                        toast.success(`Switched active context to ${p.name}`)
                      })
                    }}
                    className="flex items-center gap-2 cursor-pointer rounded-lg px-2.5 py-2 hover:bg-primary/10"
                  >
                    <Building2 className="size-4 text-primary shrink-0" />
                    <span>{p.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {p.tenantId} {isCurrent && '✓ active'}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}

          {/* Quick Immediate Actions */}
          <CommandGroup heading="Platform Actions">
            <CommandItem
              value="action export data json"
              onSelect={handleExportData}
              className="flex items-center gap-2 cursor-pointer rounded-lg px-2.5 py-2 hover:bg-primary/10"
            >
              <Download className="size-4 text-blue-500 shrink-0" />
              <span>Export Tenant Snapshot (JSON)</span>
            </CommandItem>
            <CommandItem
              value="action reset sandbox cache localstorage"
              onSelect={handleResetSandbox}
              className="flex items-center gap-2 cursor-pointer rounded-lg px-2.5 py-2 hover:bg-primary/10"
            >
              <RotateCcw className="size-4 text-rose-500 shrink-0" />
              <span>Reset Local View Presets & Cache</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* Theme Settings */}
          <CommandGroup heading="Theme">
            <CommandItem
              value="theme light mode"
              onSelect={() => runCommand(() => setTheme('light'))}
              className="flex items-center gap-2 cursor-pointer rounded-lg px-2.5 py-2 hover:bg-primary/10"
            >
              <Sun className="size-4 text-amber-500" /> <span>Light</span>
            </CommandItem>
            <CommandItem
              value="theme dark mode"
              onSelect={() => runCommand(() => setTheme('dark'))}
              className="flex items-center gap-2 cursor-pointer rounded-lg px-2.5 py-2 hover:bg-primary/10"
            >
              <Moon className="size-4 text-blue-400" />
              <span>Dark</span>
            </CommandItem>
            <CommandItem
              value="theme system auto mode"
              onSelect={() => runCommand(() => setTheme('system'))}
              className="flex items-center gap-2 cursor-pointer rounded-lg px-2.5 py-2 hover:bg-primary/10"
            >
              <Laptop className="size-4 text-muted-foreground" />
              <span>System</span>
            </CommandItem>
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}

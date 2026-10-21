import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useProfile } from '@/context/profile-provider'
import type { StorageProvider, WorkspaceAssignment } from './data/storages'
import { toast } from 'sonner'

interface StorageAssignmentsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: StorageProvider | null
  onUpdateProvider?: (provider: StorageProvider) => void
}

export function StorageAssignmentsDialog({
  open,
  onOpenChange,
  provider,
  onUpdateProvider,
}: StorageAssignmentsDialogProps) {
  const { t } = useTranslation('console')
  const { profiles } = useProfile()
  const [assignments, setAssignments] = useState<WorkspaceAssignment[]>([])

  useEffect(() => {
    if (provider && provider.assignedWorkspaces !== 'all') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAssignments([...provider.assignedWorkspaces])
    }
  }, [provider, open])

  // Optimization: Pre-index assignments into a Map and memoize computed profiles
  // to reduce lookup time from O(N * M) nested array scans to O(1) Map accesses per render.
  const assignmentMap = useMemo(
    () => new Map(assignments.map((a) => [a.workspaceId, a])),
    [assignments]
  )

  const { assignedProfiles, unassignedProfiles } = useMemo(() => {
    const assignedSet = new Set(assignments.map((a) => a.workspaceId))
    const assigned: typeof profiles = []
    const unassigned: typeof profiles = []
    for (const p of profiles) {
      const id = p.id ?? p.name
      if (assignedSet.has(id)) {
        assigned.push(p)
      } else {
        unassigned.push(p)
      }
    }
    return { assignedProfiles: assigned, unassignedProfiles: unassigned }
  }, [assignments, profiles])

  if (!provider) return null

  const handleAssign = (workspaceId: string) => {
    setAssignments((prev) => [...prev, { workspaceId, enabled: true }])
  }

  const handleToggleEnable = (workspaceId: string, enabled: boolean) => {
    setAssignments((prev) =>
      prev.map((a) => (a.workspaceId === workspaceId ? { ...a, enabled } : a))
    )
  }

  const handleSave = () => {
    if (onUpdateProvider && provider) {
      onUpdateProvider({
        ...provider,
        assignedWorkspaces: provider.assignedWorkspaces === 'all' ? 'all' : assignments,
      })
    }
    toast.success(t('storage.toasts.saved', 'Settings saved successfully'))
    onOpenChange(false)
  }

  const handleBulkToggle = (enabled: boolean) => {
    setAssignments((prev) => prev.map((a) => ({ ...a, enabled })))
  }

  const handleAssignAll = () => {
    setAssignments((prev) => [
      ...prev,
      ...unassignedProfiles.map((p) => ({
        workspaceId: p.id ?? p.name,
        enabled: true,
      })),
    ])
  }



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px] bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-xl shadow-black/10'>
        <DialogHeader>
          <DialogTitle>
            {t('storage.assignments.title', 'Workspace Assignments')} -{' '}
            {provider.name}
          </DialogTitle>
          <DialogDescription>
            {t(
              'storage.assignments.description',
              'Assign this storage provider to workspaces and manage its enabled state.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='py-4 space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar'>
          {assignedProfiles.length > 0 && (
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <h4 className='text-sm font-medium text-foreground'>
                  {t('storage.assignments.assigned', 'Assigned Workspaces')}
                </h4>
                {provider.assignedWorkspaces !== 'all' && (
                  <div className='flex items-center gap-2'>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 text-xs text-muted-foreground'
                      onClick={() => handleBulkToggle(true)}
                    >
                      {t('storage.assignments.enableAll', 'Enable All')}
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 text-xs text-muted-foreground'
                      onClick={() => handleBulkToggle(false)}
                    >
                      {t('storage.assignments.disableAll', 'Disable All')}
                    </Button>
                  </div>
                )}
              </div>
              <ul className='space-y-2'>
                {assignedProfiles.map((profile) => {
                  const assignment = assignmentMap.get(
                    profile.id ?? profile.name
                  )
                  // For 'System Internal' with 'all', they are effectively enabled globally unless overridden.
                  // Since 'System Internal' uses 'all', we might just show them as enabled.
                  const isEnabled = provider.assignedWorkspaces === 'all' ? true : (assignment?.enabled ?? false)

                  return (
                    <li
                      key={profile.id ?? profile.name}
                      className='flex items-center justify-between p-3 rounded-lg border border-white/20 bg-background/50 shadow-xs'
                    >
                      <div className='flex items-center gap-3'>
                        <div className='flex size-8 items-center justify-center rounded-md border border-white/20 bg-background/50 shadow-xs'>
                          {profile.logo ? (
                            <profile.logo className='size-4 shrink-0' />
                          ) : null}
                        </div>
                        <span className='text-sm font-medium'>
                          {profile.name}
                        </span>
                      </div>
                      <div className='flex items-center gap-3'>
                        <span className='text-xs text-muted-foreground'>
                          {isEnabled
                            ? t('storage.assignments.enabled', 'Enabled')
                            : t('storage.assignments.disabled', 'Disabled')}
                        </span>
                        <Switch
                          checked={isEnabled}
                          disabled={provider.assignedWorkspaces === 'all'}
                          onCheckedChange={(checked) =>
                            handleToggleEnable(
                              profile.id ?? profile.name,
                              checked
                            )
                          }
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {unassignedProfiles.length > 0 && provider.assignedWorkspaces !== 'all' && (
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <h4 className='text-sm font-medium text-foreground'>
                  {t('storage.assignments.unassigned', 'Unassigned Workspaces')}
                </h4>
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-7 text-xs text-muted-foreground'
                  onClick={handleAssignAll}
                >
                  {t('storage.assignments.assignAll', 'Assign All')}
                </Button>
              </div>
              <ul className='space-y-2'>
                {unassignedProfiles.map((profile) => (
                  <li
                    key={profile.id ?? profile.name}
                    className='flex items-center justify-between p-3 rounded-lg border border-white/20 bg-background/50 shadow-xs'
                  >
                    <div className='flex items-center gap-3'>
                      <div className='flex size-8 items-center justify-center rounded-md border border-white/20 bg-background/50 shadow-xs'>
                        {profile.logo ? (
                          <profile.logo className='size-4 shrink-0' />
                        ) : null}
                      </div>
                      <span className='text-sm font-medium'>
                        {profile.name}
                      </span>
                    </div>
                    <Button
                      variant='outline'
                      size='sm'
                      className='h-7 text-xs'
                      onClick={() => handleAssign(profile.id ?? profile.name)}
                    >
                      <Plus className='mr-1 size-3' />
                      {t('storage.actions.assign', 'Assign')}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('storage.actions.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSave}>
            {t('storage.actions.save', 'Save Changes')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

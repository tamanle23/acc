import { useState, useMemo } from 'react'
import { Check, ChevronsUpDown, Plus, Building2, LayoutGrid, Crown, ShieldAlert, ArrowRight, AlertTriangle, Star } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useProfile, type Profile } from '@/context/profile-provider'
import { useMetadataUiStore } from '@/features/metadata/store/use-metadata-ui-store'
import { useProfileStore, getUserDefaultWorkspace } from '@/stores/profile-store'
import { useSpringAuthStore } from '@/features/spring-auth'
import { useSandboxStore } from '@/core/sandbox'
import { CreateWorkspaceModal } from '@/features/settings/workspaces/create-workspace-modal'
import { exitAssumeTenantSubSession } from '@/features/system/utils/assume-tenant-session'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type ProfileSwitcherProps = {
  profiles?: Profile[]
}

export function ProfileSwitcher({ profiles: propProfiles }: ProfileSwitcherProps) {
  const { isMobile } = useSidebar()
  const { currentProfile, setCurrentProfile, profiles: contextProfiles } = useProfile()
  const { setActiveTenant, setActiveWorkspace } = useMetadataUiStore()
  const { setUserDefault } = useProfileStore()
  const { user } = useSpringAuthStore()
  const { activePersonaId, setActiveTenant: setSandboxTenant } = useSandboxStore()
  const navigate = useNavigate()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const isSovereign = Boolean(
    user?.roles?.includes('ROLE_SYSTEM_CUSTODIAN') ||
    activePersonaId === 'system'
  )

  const assumedTenant = typeof window !== 'undefined' ? localStorage.getItem('acc_assumed_tenant') : null
  const isAssumed = Boolean(assumedTenant && assumedTenant !== 'SYSTEM')

  const availableProfiles = contextProfiles && contextProfiles.length > 0 ? contextProfiles : (propProfiles ?? [])
  const effectiveTenantId = isAssumed
    ? assumedTenant
    : isSovereign
    ? 'SYSTEM'
    : (useMetadataUiStore.getState().activeTenantId || 'tenant-acme')
  const tenantWorkspaces = availableProfiles.filter((p) => p.tenantId === effectiveTenantId)
  const isOrphanedTenant = !isSovereign && tenantWorkspaces.length === 0

  let activeProfile: Profile | null = currentProfile ?? availableProfiles[0]

  if (isSovereign && !isAssumed) {
    activeProfile = availableProfiles.find((p) => p.tenantId === 'SYSTEM' || p.id === 'ws-sovereign-root') || {
      id: 'ws-sovereign-root',
      name: '👑 Sovereign Platform',
      logo: Crown,
      plan: 'Fleet Custody',
      tenantId: 'SYSTEM',
      tenantName: 'Sovereign Root System',
    }
  } else if (isAssumed && activeProfile?.tenantId !== assumedTenant) {
    const matched = availableProfiles.find((p) => p.tenantId === assumedTenant)
    activeProfile = matched || null
  } else if (!isAssumed && tenantWorkspaces.length > 0 && activeProfile?.tenantId !== effectiveTenantId) {
    activeProfile = tenantWorkspaces[0]
  } else if (isOrphanedTenant) {
    activeProfile = null
  }

  const handleSwitchToSovereign = () => {
    if (isAssumed) {
      exitAssumeTenantSubSession('/system/tenants')
      return
    }
    setSandboxTenant('SYSTEM')
    setActiveTenant('SYSTEM', 'Sovereign Root System')
    toast.info('Switched context to Sovereign Platform (SYSTEM)')
    navigate({ to: '/system/tenants' })
  }

  // When inside an assumed tenant sub-session, strictly isolate the workspace list to the assumed tenant only
  const displayProfiles = useMemo(() => {
    if (isAssumed && assumedTenant) {
      return availableProfiles.filter((p) => p.tenantId === assumedTenant)
    }
    return availableProfiles
  }, [availableProfiles, isAssumed, assumedTenant])

  // Group workspaces by parent Tenant
  const groupedByTenant = useMemo(() => {
    const map = new Map<string, { tenantName: string; workspaces: Profile[] }>()
    displayProfiles.forEach((p) => {
      const tenantId = (p.tenantId as string) || effectiveTenantId
      const tenantName = (p.tenantName as string) || 'Organization'
      if (!map.has(tenantId)) {
        map.set(tenantId, { tenantName, workspaces: [] })
      }
      map.get(tenantId)!.workspaces.push(p)
    })
    return Array.from(map.entries()).map(([tenantId, data]) => ({
      tenantId,
      ...data,
    }))
  }, [displayProfiles, effectiveTenantId])

  const handleSelectWorkspace = (profile: Profile) => {
    const tenantId = (profile.tenantId as string) || effectiveTenantId
    const tenantName = (profile.tenantName as string) || profile.name
    const workspaceId = (profile.id as string) || profile.name.toLowerCase().replace(/[^a-z0-9]/g, '-')

    if (isAssumed && tenantId !== assumedTenant) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('acc_assumed_tenant')
        localStorage.removeItem('acc_assumed_token')
        localStorage.removeItem('acc_assumed_tenant_name')
      }
      toast.info(`Exited delegated sub-session. Switched to workspace "${profile.name}".`)
    } else {
      toast.success(`Đã chuyển sang workspace "${profile.name}" (${tenantName})`)
    }

    setCurrentProfile(profile)
    setSandboxTenant(tenantId)
    setActiveTenant(tenantId, tenantName)
    setActiveWorkspace(workspaceId, profile.name)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className={cn(
                'data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground transition-all duration-200',
                isAssumed && 'bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15'
              )}
            >
              <div
                className={cn(
                  'flex aspect-square size-8 items-center justify-center rounded-lg shadow-sm',
                  isAssumed
                    ? 'bg-amber-500 text-white shadow-amber-500/20'
                    : isSovereign
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30'
                    : isOrphanedTenant
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'bg-sidebar-primary text-sidebar-primary-foreground'
                )}
              >
                {isAssumed ? (
                  <ShieldAlert className='size-4' />
                ) : isSovereign ? (
                  <Crown className='size-4 text-amber-500' />
                ) : isOrphanedTenant ? (
                  <Building2 className='size-4' />
                ) : activeProfile?.logo ? (
                  <activeProfile.logo className='size-4' />
                ) : (
                  <LayoutGrid className='size-4' />
                )}
              </div>
              <div className='grid flex-1 text-start text-sm leading-tight'>
                <div className='flex items-center gap-1.5 truncate'>
                  <span className='truncate font-semibold'>
                    {isSovereign && !isAssumed
                      ? '👑 Sovereign Platform'
                      : activeProfile?.name ||
                        (isAssumed ? (typeof window !== 'undefined' ? localStorage.getItem('acc_assumed_tenant_name') : null) || assumedTenant : null) ||
                        useMetadataUiStore.getState().activeTenantName ||
                        'Orphaned Tenant'}
                  </span>
                  {isOrphanedTenant ? (
                    <span className='text-[9px] px-1 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-600/40'>
                      NO WORKSPACE
                    </span>
                  ) : isAssumed ? (
                    <span className='text-[9px] px-1 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-600/40'>
                      ASSUMED
                    </span>
                  ) : isSovereign ? (
                    <span className='text-[9px] px-1 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-600/40'>
                      ROOT
                    </span>
                  ) : null}
                </div>
                <span className='truncate text-xs text-muted-foreground'>
                  {isSovereign && !isAssumed
                    ? 'SYSTEM Tenant (Fleet Root)'
                    : isOrphanedTenant
                    ? `Tenant: ${(isAssumed ? (typeof window !== 'undefined' ? localStorage.getItem('acc_assumed_tenant_name') : null) || assumedTenant : null) || useMetadataUiStore.getState().activeTenantName || effectiveTenantId}`
                    : isAssumed
                    ? `Delegated: ${(activeProfile?.tenantName as string) || (typeof window !== 'undefined' ? localStorage.getItem('acc_assumed_tenant_name') : null) || assumedTenant}`
                    : ((activeProfile?.tenantName as string) || activeProfile?.plan || 'Workspace')}
                </span>
              </div>
              <ChevronsUpDown className='ms-auto size-4 text-muted-foreground' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-(--radix-dropdown-menu-trigger-width) min-w-64 rounded-xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-xl shadow-black/10'
            align='start'
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            {isAssumed ? (
              <div className='mb-2 pb-2 border-b border-border/40 bg-amber-500/10 -mx-1 -mt-1 p-2 rounded-t-lg'>
                <div className='flex items-center justify-between mb-1'>
                  <span className='text-[10px] uppercase font-bold tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1'>
                    <ShieldAlert className='size-3 text-amber-600 dark:text-amber-400' />
                    Delegated Sub-Session
                  </span>
                  <span className='text-[10px] font-mono text-amber-800 dark:text-amber-200 font-semibold'>
                    Actor: SYSTEM
                  </span>
                </div>
                <div className='text-xs text-amber-900 dark:text-amber-100 font-medium mb-2 truncate'>
                  Impersonating: <strong className='font-mono'>{activeProfile?.tenantName || assumedTenant}</strong>
                </div>
                <DropdownMenuItem
                  onClick={() => exitAssumeTenantSubSession('/system/tenants')}
                  className='gap-2 p-1.5 rounded-md cursor-pointer bg-amber-500/20 hover:bg-amber-500/30 text-amber-950 dark:text-amber-100 font-semibold text-xs transition-colors'
                >
                  <ArrowRight className='size-3.5 text-amber-600 dark:text-amber-300' />
                  <span>Exit Sub-Session & Return to Root</span>
                </DropdownMenuItem>
              </div>
            ) : isSovereign ? (
              <div className='mb-1 pb-1 border-b border-border/40'>
                <DropdownMenuLabel className='text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5 px-2 py-1'>
                  <Crown className='size-3 text-amber-500' />
                  <span>Sovereign Root Custody</span>
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={handleSwitchToSovereign}
                  className='gap-2 p-2 rounded-lg cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 text-amber-950 dark:text-amber-200 font-medium transition-colors'
                >
                  <div className='flex size-6 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/20 text-amber-600 dark:text-amber-300 shadow-xs'>
                    <Crown className='size-3.5 shrink-0' />
                  </div>
                  <div className='flex flex-col flex-1 leading-tight'>
                    <span className='text-sm font-semibold'>👑 Sovereign Platform</span>
                    <span className='text-[10px] text-amber-700/80 dark:text-amber-300/70 font-mono'>SYSTEM Tenant (Fleet Root)</span>
                  </div>
                </DropdownMenuItem>
              </div>
            ) : null}

            {isOrphanedTenant && !isSovereign && (
              <div className='p-3 mb-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200'>
                <div className='flex items-center gap-1.5 font-semibold text-xs mb-1'>
                  <AlertTriangle className='size-3.5 text-amber-600 dark:text-amber-400 shrink-0' />
                  <span>No Workspaces in Organization</span>
                </div>
                <p className='text-[11px] text-muted-foreground mb-2.5 leading-relaxed'>
                  All workspaces in this tenant have been wiped out. Workspace navigation is suspended until a workspace is created.
                </p>
                <DropdownMenuItem
                  onClick={() => setIsCreateOpen(true)}
                  className='w-full justify-center gap-1.5 p-1.5 rounded-lg cursor-pointer bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors shadow-sm'
                >
                  <Plus className='size-3.5' />
                  <span>Provision First Workspace</span>
                </DropdownMenuItem>
              </div>
            )}

            {groupedByTenant.map((group, groupIdx) => (
              <div key={group.tenantId} className={cn(groupIdx > 0 && 'mt-1 pt-1 border-t border-border/40')}>
                <DropdownMenuLabel className='text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5 px-2 py-1'>
                  <Building2 className='size-3 text-primary' />
                  <span className='truncate'>{group.tenantName}</span>
                </DropdownMenuLabel>
                {group.workspaces.map((profile, index) => {
                  const isSelected =
                    (profile.id && profile.id === activeProfile?.id) ||
                    profile.name === activeProfile?.name
                  const profileTenantId = (profile.tenantId as string) || group.tenantId
                  const userDefaultWsId = profileTenantId ? getUserDefaultWorkspace(profileTenantId) : null
                  const isPersonalDefault = userDefaultWsId ? profile.id === userDefaultWsId : Boolean(profile.isDefault)
                  const isTenantDefault = Boolean(profile.isDefault)

                  return (
                    <DropdownMenuItem
                      key={profile.id ?? profile.name}
                      onClick={() => handleSelectWorkspace(profile)}
                      className={cn(
                        'group/ws-item gap-2 p-2 rounded-lg cursor-pointer transition-colors relative',
                        isSelected && 'bg-accent/60 font-medium'
                      )}
                    >
                      <div className='flex size-6 items-center justify-center rounded-md border border-white/20 bg-background/50 shadow-xs'>
                        {profile.logo ? (
                          <profile.logo className='size-3.5 shrink-0' />
                        ) : (
                          <LayoutGrid className='size-3.5 shrink-0' />
                        )}
                      </div>
                      <div className='flex flex-col flex-1 leading-tight min-w-0'>
                        <div className='flex items-center gap-1.5'>
                          <span className='text-sm truncate'>{profile.name}</span>
                          {isPersonalDefault && (
                            <span className='text-[9px] px-1 py-0.2 rounded bg-amber-500/15 text-amber-900 dark:text-amber-200 font-semibold border border-amber-600/40 shrink-0'>
                              My Default
                            </span>
                          )}
                          {!isPersonalDefault && isTenantDefault && (
                            <span className='text-[9px] px-1 py-0.2 rounded bg-primary/10 text-primary font-semibold border border-primary/20 shrink-0'>
                              Default
                            </span>
                          )}
                        </div>
                        {profile.plan && (
                          <span className='text-[10px] text-muted-foreground truncate'>
                            {profile.plan}
                          </span>
                        )}
                      </div>
                      <div className='flex items-center gap-1 shrink-0'>
                        <button
                          type='button'
                          title={isPersonalDefault ? 'Workspace mặc định của bạn' : 'Đặt làm workspace mặc định'}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (profileTenantId && profile.id) {
                              setUserDefault(profileTenantId, profile.id)
                              toast.success(`Đã đặt "${profile.name}" làm workspace mặc định`)
                            }
                          }}
                          className={cn(
                            'p-1 rounded hover:bg-white/10 transition-colors',
                            isPersonalDefault
                              ? 'text-amber-500 opacity-100'
                              : 'text-muted-foreground/30 hover:text-amber-500 opacity-0 group-hover/ws-item:opacity-100'
                          )}
                        >
                          <Star className={cn('size-3.5', isPersonalDefault && 'fill-amber-500')} />
                        </button>
                        {isSelected ? (
                          <Check className='size-4 text-primary shrink-0' />
                        ) : (
                          <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                        )}
                      </div>
                    </DropdownMenuItem>
                  )
                })}
              </div>
            ))}
            <DropdownMenuSeparator className='bg-border/60' />
            <DropdownMenuItem
              onClick={() => setIsCreateOpen(true)}
              className='gap-2 p-2 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground'
            >
              <div className='flex size-6 items-center justify-center rounded-md border border-dashed border-border bg-background/50'>
                <Plus className='size-3.5' />
              </div>
              <div className='font-medium text-xs'>Tạo Workspace Mới</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <CreateWorkspaceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </SidebarMenu>
  )
}

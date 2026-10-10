import { useState, useMemo } from 'react'
import { Check, ChevronsUpDown, Plus, Building2, LayoutGrid, Crown, ShieldAlert } from 'lucide-react'
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
import { useSpringAuthStore } from '@/features/spring-auth'
import { useSandboxStore } from '@/core/sandbox'
import { CreateWorkspaceModal } from '@/features/settings/workspaces/create-workspace-modal'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type ProfileSwitcherProps = {
  profiles?: Profile[]
}

export function ProfileSwitcher({ profiles: propProfiles }: ProfileSwitcherProps) {
  const { isMobile } = useSidebar()
  const { currentProfile, setCurrentProfile, profiles: contextProfiles } = useProfile()
  const { setActiveTenant, setActiveWorkspace } = useMetadataUiStore()
  const { user } = useSpringAuthStore()
  const { activePersonaId, setActiveTenant: setSandboxTenant } = useSandboxStore()
  const navigate = useNavigate()

  const isSovereign = Boolean(
    user?.roles?.includes('ROLE_SYSTEM_CUSTODIAN') ||
    activePersonaId === 'system'
  )

  const handleSwitchToSovereign = () => {
    setSandboxTenant('SYSTEM')
    setActiveTenant('SYSTEM', 'Sovereign Root System')
    toast.info('Switched context to Sovereign Platform (SYSTEM)')
    navigate({ to: '/system/tenants' })
  }

  const availableProfiles = propProfiles ?? contextProfiles
  const activeProfile = currentProfile ?? availableProfiles[0]

  // Group workspaces by parent Tenant
  const groupedByTenant = useMemo(() => {
    const map = new Map<string, { tenantName: string; workspaces: Profile[] }>()
    availableProfiles.forEach((p) => {
      const tenantId = (p.tenantId as string) || 'default-tenant'
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
  }, [availableProfiles])

  const handleSelectWorkspace = (profile: Profile) => {
    setCurrentProfile(profile)
    const tenantId = (profile.tenantId as string) || 'default-tenant'
    const tenantName = (profile.tenantName as string) || profile.name
    const workspaceId = (profile.id as string) || profile.name.toLowerCase().replace(/[^a-z0-9]/g, '-')

    setActiveTenant(tenantId, tenantName)
    setActiveWorkspace(workspaceId, profile.name)
    toast.success(`Đã chuyển sang workspace "${profile.name}" (${tenantName})`)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground transition-all duration-200'
            >
              <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'>
                {activeProfile?.logo ? (
                  <activeProfile.logo className='size-4' />
                ) : (
                  <LayoutGrid className='size-4' />
                )}
              </div>
              <div className='grid flex-1 text-start text-sm leading-tight'>
                <span className='truncate font-semibold'>
                  {activeProfile?.name}
                </span>
                <span className='truncate text-xs text-muted-foreground'>
                  {(activeProfile?.tenantName as string) || activeProfile?.plan || 'Workspace'}
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
            {isSovereign && (
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
                  return (
                    <DropdownMenuItem
                      key={profile.id ?? profile.name}
                      onClick={() => handleSelectWorkspace(profile)}
                      className={cn(
                        'gap-2 p-2 rounded-lg cursor-pointer transition-colors',
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
                      <div className='flex flex-col flex-1 leading-tight'>
                        <span className='text-sm'>{profile.name}</span>
                        {profile.plan && (
                          <span className='text-[10px] text-muted-foreground'>
                            {profile.plan}
                          </span>
                        )}
                      </div>
                      {isSelected ? (
                        <Check className='size-4 text-primary shrink-0' />
                      ) : (
                        <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                      )}
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
              <div className='font-medium text-xs'>+ Tạo Workspace Mới</div>
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


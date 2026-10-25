import { getRouteApi } from '@tanstack/react-router'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { LanguageSwitch } from '@/components/language-switch'
import { UsersDialogs } from './components/users-dialogs'
import { UsersPrimaryButtons } from './components/users-primary-buttons'
import { UsersProvider } from './components/users-provider'
import { UsersTable } from './components/users-table'
import { useUsersQuery } from './api/use-users'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Users as UsersIcon, Building2 } from 'lucide-react'
import { useSandboxStore } from '@/core/sandbox/store/sandbox-store'

const route = getRouteApi('/_authenticated/users/')

export function Users() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { data: users = [], isLoading } = useUsersQuery()
  const activeTenantId = useSandboxStore((s) => s.activeTenantId) || 'tenant-acme'

  return (
    <UsersProvider>
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
        <div className='flex flex-wrap items-end justify-between gap-3 p-4 rounded-2xl backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-white/30 dark:border-white/10 shadow-lg shadow-black/5'>
          <div className='space-y-1'>
            <div className='flex items-center gap-2'>
              <div className='p-2 rounded-xl bg-primary/10 text-primary'>
                <UsersIcon className='h-5 w-5' />
              </div>
              <h1 className='text-2xl font-bold tracking-tight'>Tenant Users & Roles</h1>
              <Badge variant='outline' className='gap-1 font-mono text-xs'>
                <Building2 className='h-3 w-3 text-muted-foreground' />
                <span>{activeTenantId}</span>
              </Badge>
            </div>
            <p className='text-sm text-muted-foreground pl-0.5'>
              Manage team members, assign fine-grained workspace roles, and delegate permissions under organizational governance.
            </p>
          </div>
          <UsersPrimaryButtons />
        </div>

        {isLoading ? (
          <div className='space-y-4'>
            <Skeleton className='h-10 w-full rounded-xl' />
            <Skeleton className='h-96 w-full rounded-2xl' />
          </div>
        ) : (
          <UsersTable data={users} search={search} navigate={navigate} />
        )}
      </Main>

      <UsersDialogs />
    </UsersProvider>
  )
}

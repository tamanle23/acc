import { Outlet } from '@tanstack/react-router'
import { Bell, Palette, UserCog, ShieldAlert, Building2, CreditCard } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { NotificationDropdown } from '@/features/notifications'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { LanguageSwitch } from '@/components/language-switch'
import { SidebarNav } from './components/sidebar-nav'

const sidebarNavItems = [
  {
    title: 'Profile',
    href: '/settings',
    icon: <UserCog size={18} />,
  },
  {
    title: 'Workspaces',
    href: '/settings/workspaces',
    icon: <Building2 size={18} />,
  },
  {
    title: 'Billing & Subscriptions',
    href: '/settings/billing',
    icon: <CreditCard size={18} />,
  },
  {
    title: 'Appearance',
    href: '/settings/appearance',
    icon: <Palette size={18} />,
  },
  {
    title: 'Notifications',
    href: '/settings/notifications',
    icon: <Bell size={18} />,
  },
  {
    title: 'Data & Privacy',
    href: '/settings/data-privacy',
    icon: <ShieldAlert size={18} />,
  },
]


export function Settings() {
  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <NotificationDropdown />
          <LanguageSwitch />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main fixed>
        <div className='space-y-0.5'>
          <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
            Settings
          </h1>
          <p className='text-muted-foreground'>
            Manage your account settings and set e-mail preferences.
          </p>
        </div>
        <Separator className='my-4 lg:my-6' />
        <div className='liquid-glass-card rounded-2xl p-4 sm:p-6 flex flex-1 flex-col space-y-4 max-lg:overflow-visible lg:overflow-hidden md:space-y-4 lg:flex-row lg:space-y-0 lg:space-x-10 shadow-lg'>
          <aside aria-label="Settings Menu" className='top-0 lg:sticky lg:w-1/5'>
            <SidebarNav items={sidebarNavItems} />
          </aside>
          <div className='flex w-full max-lg:overflow-visible lg:overflow-y-hidden p-1'>
            <Outlet />
          </div>
        </div>
      </Main>
    </>
  )
}

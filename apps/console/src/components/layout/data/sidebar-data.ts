import {
  Settings2,
  Construction,
  LayoutDashboard,
  Bug,
  ListTodo,
  FileX,
  HelpCircle,
  Lock,
  Bell,
  Package,
  Palette,
  ServerOff,
  Settings,
  UserCog,
  UserX,
  Users,
  MessagesSquare,
  ShieldCheck,
  AudioWaveform,
  Command,
  GalleryVerticalEnd,
  Database,
  Building2,
  CreditCard,
  Crown,
  KeyRound,
} from 'lucide-react'
import { type SidebarData } from '../types'
import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import { useSpringAuthStore } from '@/features/spring-auth'
import { useSandboxStore } from '@/core/sandbox'

export const sidebarTeams = [
  {
    id: 'ws-main',
    name: 'Unipost Main',
    logo: Command,
    plan: 'Production Workspace',
    tenantId: 'default-tenant',
    tenantName: 'Default Organization',
  },
  {
    id: 'ws-acme-prod',
    name: 'Acme Prod',
    logo: GalleryVerticalEnd,
    plan: 'Production Workspace',
    tenantId: 'tenant-acme',
    tenantName: 'Acme International Corp',
  },
  {
    id: 'ws-acme-staging',
    name: 'Acme Staging',
    logo: AudioWaveform,
    plan: 'Staging Environment',
    tenantId: 'tenant-acme',
    tenantName: 'Acme International Corp',
  },
];

export const useSidebarData = (): SidebarData => {
  const { t } = useTranslation('console');
  const { user } = useSpringAuthStore();
  const { activePersonaId } = useSandboxStore();

  const isSovereign = Boolean(
    user?.roles?.includes('ROLE_SYSTEM_CUSTODIAN') ||
    activePersonaId === 'system'
  );

  return useMemo(() => ({
    user: {
      name: 'satnaing',
      email: 'satnaingdev@gmail.com',
      avatar: '/avatars/shadcn.jpg',
    },
    teams: sidebarTeams,
    navGroups: [
      ...(isSovereign
        ? [
            {
              title: t('sidebar.groups.sovereign', 'Sovereign Custody (Root)'),
              items: [
                {
                  title: t('sidebar.items.fleetTenants', 'Fleet Tenants Ledger'),
                  url: '/system/tenants',
                  icon: Building2,
                  badge: 'ROOT',
                },
                {
                  title: t('sidebar.items.rbacMatrix', 'RBAC & Global Users'),
                  url: '/system/roles',
                  icon: KeyRound,
                },
                {
                  title: t('sidebar.items.canonicalSchemas', 'Canonical Schemas'),
                  url: '/metadata',
                  icon: Settings2,
                },
              ],
            },
          ]
        : []),
      {
        title: t('sidebar.groups.workspace', 'Workspace'),
        items: [
          {
            title: t('sidebar.items.dashboard', 'Dashboard'),
            url: '/',
            icon: LayoutDashboard,
          },
          {
            title: t('sidebar.items.tasks', 'Tasks'),
            url: '/tasks',
            icon: ListTodo,
          },
          {
            title: t('sidebar.items.apps', 'Apps'),
            url: '/apps',
            icon: Package,
          },
          {
            title: t('sidebar.items.chats', 'Chats'),
            url: '/chats',
            badge: '3',
            icon: MessagesSquare,
          },
          {
            title: 'Customer Accounts',
            url: '/customer-accounts',
            icon: Building2,
          },
        ],
      },
      {
        title: t('sidebar.groups.admin', 'Admin'),
        items: [
          {
            title: t('sidebar.items.users', 'Users'),
            url: '/users',
            icon: Users,
          },
          {
            title: t('sidebar.items.storage', 'Storage Providers'),
            url: '/storage',
            icon: Database,
          },
          {
            title: t('sidebar.items.metadata', 'Metadata'),
            url: '/metadata',
            icon: Settings2,
          },
        ],
      },
      {
        title: t('sidebar.groups.pages', 'Pages'),
        items: [
          {
            title: t('sidebar.items.auth', 'Auth'),
            icon: ShieldCheck,
            items: [
              {
                title: t('sidebar.items.signIn', 'Sign In'),
                url: '/sign-in',
              },
              {
                title: t('sidebar.items.signIn2Col', 'Sign In (2 Col)'),
                url: '/sign-in-2',
              },
              {
                title: t('sidebar.items.signUp', 'Sign Up'),
                url: '/sign-up',
              },
              {
                title: t('sidebar.items.forgotPassword', 'Forgot Password'),
                url: '/forgot-password',
              },
              {
                title: t('sidebar.items.otp', 'OTP'),
                url: '/otp',
              },
            ],
          },
          {
            title: t('sidebar.items.errors', 'Errors'),
            icon: Bug,
            items: [
              {
                title: t('sidebar.items.unauthorized', 'Unauthorized'),
                url: '/errors/unauthorized',
                icon: Lock,
              },
              {
                title: t('sidebar.items.forbidden', 'Forbidden'),
                url: '/errors/forbidden',
                icon: UserX,
              },
              {
                title: t('sidebar.items.notFound', 'Not Found'),
                url: '/errors/not-found',
                icon: FileX,
              },
              {
                title: t('sidebar.items.internalError', 'Internal Server Error'),
                url: '/errors/internal-server-error',
                icon: ServerOff,
              },
              {
                title: t('sidebar.items.maintenanceError', 'Maintenance Error'),
                url: '/errors/maintenance-error',
                icon: Construction,
              },
            ],
          },
        ],
      },
      {
        title: t('sidebar.groups.other', 'Other'),
        hideWhenInactive: true,
        items: [
          {
            title: t('sidebar.items.settings', 'Settings'),
            icon: Settings,
            items: [
              {
                title: t('sidebar.items.profile', 'Profile'),
                url: '/settings',
                icon: UserCog,
              },
              {
                title: t('sidebar.items.workspaces', 'Workspaces'),
                url: '/settings/workspaces',
                icon: Building2,
              },
              {
                title: t('sidebar.items.billing', 'Billing & Subscriptions'),
                url: '/settings/billing',
                icon: CreditCard,
              },
              {
                title: t('sidebar.items.appearance', 'Appearance'),
                url: '/settings/appearance',
                icon: Palette,
              },
              {
                title: t('sidebar.items.notifications', 'Notifications'),
                url: '/settings/notifications',
                icon: Bell,
              },
            ],
          },
          {
            title: t('sidebar.items.helpCenter', 'Help Center'),
            url: '/help-center',
            icon: HelpCircle,
          },
        ],
      },
    ],
  }), [t, isSovereign])
}

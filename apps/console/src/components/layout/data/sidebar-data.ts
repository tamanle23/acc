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
  Workflow,
  UserCheck,
} from 'lucide-react'
import { type SidebarData } from '../types'
import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import { useSpringAuthStore } from '@/features/spring-auth'
import { useSandboxStore } from '@/core/sandbox/store/sandbox-store'
import { useProfileStore } from '@/stores/profile-store'
import { useMetadataUiStore } from '@/features/metadata/store/use-metadata-ui-store'

export const sidebarTeams = [
  {
    id: 'ws-acme-prod',
    name: 'Acme Prod',
    logo: GalleryVerticalEnd,
    plan: 'Production Workspace',
    tenantId: 'tenant-acme',
    tenantName: 'Acme International Corp',
    isDefault: true,
  },
  {
    id: 'ws-acme-staging',
    name: 'Acme Staging',
    logo: AudioWaveform,
    plan: 'Staging Environment',
    tenantId: 'tenant-acme',
    tenantName: 'Acme International Corp',
    isDefault: false,
  },
  {
    id: 'ws-us-east-prod',
    name: 'US-East Production',
    logo: Command,
    plan: 'Production Workspace',
    tenantId: 'tenant-us-east-1',
    tenantName: 'US East Operations Ltd',
    isDefault: true,
  },
];

export const useSidebarData = (): SidebarData => {
  const { t } = useTranslation('console');
  const { user } = useSpringAuthStore();
  const { activePersonaId, activeTenantId: sandboxTenantId } = useSandboxStore();
  const profiles = useProfileStore((state) => state.profiles);
  const activeWorkspaceId = useMetadataUiStore((state) => state.activeWorkspaceId);
  const activeTenantId = useMetadataUiStore((state) => state.activeTenantId);

  const assumedTenant = typeof window !== 'undefined' ? localStorage.getItem('unipost_assumed_tenant') : null;
  const isAssumed = Boolean(assumedTenant && assumedTenant !== 'SYSTEM');
  const isSovereign = Boolean(
    user?.roles?.includes('ROLE_SYSTEM_CUSTODIAN') ||
    activePersonaId === 'system'
  );

  const effectiveTenantId = isAssumed ? assumedTenant : (activeTenantId || sandboxTenantId);
  const tenantWorkspaces = profiles.filter((p) => p.tenantId === effectiveTenantId);
  // An orphaned tenant has zero workspaces or empty workspace id
  const hasActiveWorkspace = Boolean(activeWorkspaceId && activeWorkspaceId.trim() !== '' && tenantWorkspaces.length > 0);

  return useMemo(() => ({
    user: {
      name: 'satnaing',
      email: 'satnaingdev@gmail.com',
      avatar: '/avatars/shadcn.jpg',
    },
    teams: (profiles && profiles.length > 0 ? profiles : sidebarTeams) as typeof sidebarTeams,
    navGroups: [
      ...(hasActiveWorkspace ? [
        {
          title: t('sidebar.groups.workspace', 'Workspace'),
          items: [
            {
              title: t('sidebar.items.dashboard', 'Dashboard'),
              url: '/',
              icon: LayoutDashboard,
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
      ] : []),
      {
        title: t('sidebar.groups.admin', 'Admin'),
        items: [
          {
            title: t('sidebar.items.workflowExecutions', 'Workflow Executions'),
            url: '/workflow-executions',
            icon: ListTodo,
          },
          {
            title: t('sidebar.items.workflows', 'Workflows'),
            url: '/workflows',
            icon: Workflow,
          },
          {
            title: t('sidebar.items.approvals', 'Task Approvals'),
            url: '/approvals',
            icon: UserCheck,
          },
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
          ...((!isSovereign || isAssumed)
            ? [
              {
                title: t('sidebar.items.metadata', 'Metadata'),
                url: '/metadata',
                icon: Settings2,
              },
            ]
            : []),
        ],
      },
      ...(isSovereign
        ? [
          {
            title: isAssumed
              ? t('sidebar.groups.sovereignDelegated', 'Sovereign Custody (Delegated)')
              : t('sidebar.groups.sovereign', 'Sovereign Custody (Root)'),
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
              ...(!isAssumed
                ? [
                  {
                    title: t('sidebar.items.canonicalSchemas', 'Canonical Schemas'),
                    url: '/metadata',
                    icon: Settings2,
                  },
                ]
                : []),
            ],
          },
        ]
        : []),
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
  }), [t, isSovereign, isAssumed, profiles, hasActiveWorkspace])
}

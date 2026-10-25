import { Shield, UserCheck, Users, CreditCard, KeyRound, Bot, ShieldCheck } from 'lucide-react'
import { type UserStatus } from './schema'

export const callTypes = new Map<UserStatus, string>([
  ['active', 'bg-teal-100/30 text-teal-900 dark:text-teal-200 border-teal-200'],
  ['inactive', 'bg-neutral-300/40 text-neutral-800 dark:text-neutral-200 border-neutral-300'],
  ['invited', 'bg-sky-200/40 text-sky-900 dark:text-sky-100 border-sky-300'],
  [
    'suspended',
    'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200 border-rose-200 dark:border-rose-800 font-medium',
  ],
])

export const roles = [
  {
    label: 'Workspace Owner',
    value: 'ROLE_WORKSPACE_OWNER',
    icon: ShieldCheck,
  },
  {
    label: 'Standard Member',
    value: 'ROLE_STANDARD_MEMBER',
    icon: Users,
  },
  {
    label: 'Compliance Officer',
    value: 'ROLE_COMPLIANCE_OFFICER',
    icon: KeyRound,
  },
  {
    label: 'Integration Service',
    value: 'ROLE_INTEGRATION_SVC',
    icon: Bot,
  },
  {
    label: 'Superadmin',
    value: 'superadmin',
    icon: Shield,
  },
  {
    label: 'Admin',
    value: 'admin',
    icon: UserCheck,
  },
  {
    label: 'Manager',
    value: 'manager',
    icon: Users,
  },
  {
    label: 'Cashier',
    value: 'cashier',
    icon: CreditCard,
  },
] as const

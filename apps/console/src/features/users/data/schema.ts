import { z } from 'zod'

const userStatusSchema = z.union([
  z.literal('active'),
  z.literal('inactive'),
  z.literal('invited'),
  z.literal('suspended'),
])
export type UserStatus = z.infer<typeof userStatusSchema>

const userRoleSchema = z.union([
  z.literal('superadmin'),
  z.literal('admin'),
  z.literal('cashier'),
  z.literal('manager'),
  z.literal('ROLE_WORKSPACE_OWNER'),
  z.literal('ROLE_STANDARD_MEMBER'),
  z.literal('ROLE_COMPLIANCE_OFFICER'),
  z.literal('ROLE_INTEGRATION_SVC'),
  z.literal('ROLE_SYSTEM_ROOT'),
  z.literal('ROLE_SYSTEM_SUPPORT'),
  z.string(),
])

const _userSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  username: z.string(),
  email: z.string(),
  phoneNumber: z.string(),
  status: userStatusSchema,
  role: userRoleSchema,
  tenantId: z.string().optional(),
  roles: z.array(z.string()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type User = z.infer<typeof _userSchema>

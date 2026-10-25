import { UsersActionDialog } from './users-action-dialog'
import { UsersDeleteDialog } from './users-delete-dialog'
import { UsersInviteDialog } from './users-invite-dialog'
import { useUsers } from './users-provider'
import { TenantRoleDelegationModal } from '@/features/system/roles/tenant-role-delegation-modal'
import { useSandboxStore } from '@/core/sandbox/store/sandbox-store'
import type { SandboxGlobalUser } from '@/core/sandbox/handlers/system-sandbox-handler'

export function UsersDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useUsers()
  const activeTenantId = useSandboxStore((s) => s.activeTenantId) || 'tenant-acme'

  const delegatableUser: SandboxGlobalUser | null = currentRow
    ? {
        userId: currentRow.id,
        username: currentRow.username,
        email: currentRow.email,
        displayName: `${currentRow.firstName} ${currentRow.lastName}`,
        tenantId: currentRow.tenantId || activeTenantId,
        roles: currentRow.roles && currentRow.roles.length > 0
          ? currentRow.roles
          : [currentRow.role],
        locked: currentRow.status === 'suspended',
        active: currentRow.status === 'active',
        lastLoginDate: currentRow.updatedAt ? new Date(currentRow.updatedAt).toISOString() : new Date().toISOString(),
        createdDate: currentRow.createdAt ? new Date(currentRow.createdAt).toISOString() : new Date().toISOString(),
      }
    : null

  return (
    <>
      <UsersActionDialog
        key='user-add'
        open={open === 'add'}
        onOpenChange={() => setOpen('add')}
      />

      <UsersInviteDialog
        key='user-invite'
        open={open === 'invite'}
        onOpenChange={() => setOpen('invite')}
      />

      {currentRow && (
        <>
          <UsersActionDialog
            key={`user-edit-${currentRow.id}`}
            open={open === 'edit'}
            onOpenChange={() => {
              setOpen('edit')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            currentRow={currentRow}
          />

          <UsersDeleteDialog
            key={`user-delete-${currentRow.id}`}
            open={open === 'delete'}
            onOpenChange={() => {
              setOpen('delete')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            currentRow={currentRow}
          />

          <TenantRoleDelegationModal
            key={`user-delegate-${currentRow.id}`}
            user={delegatableUser}
            open={open === 'delegate'}
            onOpenChange={(isOpen) => {
              if (!isOpen) {
                setOpen(null)
                setTimeout(() => {
                  setCurrentRow(null)
                }, 500)
              } else {
                setOpen('delegate')
              }
            }}
          />
        </>
      )}
    </>
  )
}

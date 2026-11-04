import { MailPlus, UserPlus } from 'lucide-react'
import { AuthorizedButton } from '@/components/auth'
import { useUsers } from './users-provider'

export function UsersPrimaryButtons() {
  const { setOpen } = useUsers()
  return (
    <div className='flex gap-2'>
      <AuthorizedButton
        permission='workspace:members:manage'
        variant='outline'
        className='space-x-1'
        onClick={() => setOpen('invite')}
      >
        <span>Invite User</span> <MailPlus size={18} />
      </AuthorizedButton>
      <AuthorizedButton
        permission='workspace:members:manage'
        className='space-x-1'
        onClick={() => setOpen('add')}
      >
        <span>Add User</span> <UserPlus size={18} />
      </AuthorizedButton>
    </div>
  )
}

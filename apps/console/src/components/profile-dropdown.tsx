import { Link } from '@tanstack/react-router'
import { HelpCircle, LogOut, Settings } from 'lucide-react'
import useDialogState from '@/hooks/use-dialog-state'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SignOutDialog } from '@/components/sign-out-dialog'
import { useUserProfileQuery } from '@/features/settings/profile/api/use-user-profile'
import { useSpringAuthStore } from '@/features/spring-auth'
import { getUserInitials } from '@/lib/user-avatar'

export function ProfileDropdown() {
  const [open, setOpen] = useDialogState()
  const { user } = useSpringAuthStore()
  const { data: profile } = useUserProfileQuery()

  const displayName = profile
    ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.username || user?.username || 'User'
    : user?.username || 'User'
  const displayEmail = profile?.email || user?.username || ''
  const avatarUrl = profile?.preferences?.avatarUrl
  const initials = getUserInitials(displayName || displayEmail, 'U')

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            className='relative h-8 w-8 rounded-full'
            aria-label='User profile and account settings'
          >
            <Avatar className='h-8 w-8'>
              {avatarUrl && <AvatarImage src={avatarUrl} alt={`${displayName}'s avatar`} />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-56' align='end'>
          <DropdownMenuLabel className='font-normal'>
            <div className='flex flex-col gap-1.5'>
              <p className='text-sm leading-none font-medium truncate'>{displayName}</p>
              {displayEmail && (
                <p className='text-xs leading-none text-muted-foreground truncate'>
                  {displayEmail}
                </p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link to='/settings'>
                <Settings />
                Settings
                <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to='/help-center'>
                <HelpCircle />
                Help Center
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant='destructive' onClick={() => setOpen(true)}>
            <LogOut />
            Sign out
            <DropdownMenuShortcut className='text-current'>
              ⇧⌘Q
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}

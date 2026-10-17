import { useNavigate, useLocation } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { useSpringAuthStore, springApiClient } from '@/features/spring-auth'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { toast } from 'sonner'
import { useState } from 'react'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const navigate = useNavigate()
  const location = useLocation()

  // Keep legacy store for compatibility if needed, but primary is Spring Auth
  const { auth } = useAuthStore()
  const { clearTokens } = useSpringAuthStore()
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      // Call backend to invalidate refresh token cookie / session
      await springApiClient.post('/auth/logout');
    } catch (error) {
      console.warn('Logout API failed, proceeding with local clear', error);
    } finally {
      // Clear local states
      clearTokens();
      auth.reset(); // Legacy auth state
      setIsLoading(false);
      onOpenChange(false);

      toast.success('Successfully signed out');

      // Preserve current location for redirect after sign-in
      const currentPath = location.href
      navigate({
        to: '/sign-in',
        search: { redirect: currentPath },
        replace: true,
      })
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title='Sign out'
      desc='Are you sure you want to sign out? You will need to sign in again to access your account.'
      confirmText={isLoading ? 'Signing out...' : 'Sign out'}
      destructive
      isLoading={isLoading}
      handleConfirm={handleSignOut}
      className='sm:max-w-sm'
    />
  )
}

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SignOutDialog } from '../sign-out-dialog'

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ href: 'http://localhost/dashboard' }),
}))

const mockPost = vi.fn()
vi.mock('@/features/spring-auth', () => ({
  useSpringAuthStore: () => ({
    clearTokens: vi.fn(),
  }),
  springApiClient: {
    post: (...args: any[]) => mockPost(...args),
  },
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    auth: { reset: vi.fn() },
  }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}))

describe('SignOutDialog', () => {
  it('renders sign out dialog content when open', () => {
    render(<SignOutDialog open={true} onOpenChange={vi.fn()} />)

    expect(
      screen.getByRole('heading', { name: 'Sign out' })
    ).toBeDefined()
    expect(
      screen.getByText(
        'Are you sure you want to sign out? You will need to sign in again to access your account.'
      )
    ).toBeDefined()
  })

  it('passes isLoading state to ConfirmDialog, setting aria-busy="true" and disabling action buttons while pending', async () => {
    let resolveLogoutPromise: (value?: unknown) => void = () => {}
    mockPost.mockReturnValue(
      new Promise((resolve) => {
        resolveLogoutPromise = resolve
      })
    )

    const onOpenChange = vi.fn()
    render(<SignOutDialog open={true} onOpenChange={onOpenChange} />)

    const confirmBtn = screen.getByRole('button', {
      name: 'Sign out',
    }) as HTMLButtonElement
    const cancelBtn = screen.getByRole('button', {
      name: 'Cancel',
    }) as HTMLButtonElement

    expect(confirmBtn.getAttribute('aria-busy')).toBe('false')
    expect(confirmBtn.disabled).toBe(false)
    expect(cancelBtn.disabled).toBe(false)

    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(confirmBtn.getAttribute('aria-busy')).toBe('true')
      expect(confirmBtn.disabled).toBe(true)
      expect(cancelBtn.disabled).toBe(true)
      expect(screen.getByText('Signing out...')).toBeDefined()
    })

    resolveLogoutPromise()

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/sign-in',
        search: { redirect: 'http://localhost/dashboard' },
        replace: true,
      })
    })
  })
})

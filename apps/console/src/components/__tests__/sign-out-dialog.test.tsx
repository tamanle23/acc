import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SignOutDialog } from '../sign-out-dialog'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ href: '/dashboard' }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}))

vi.mock('@/features/spring-auth', () => ({
  useSpringAuthStore: () => ({
    clearTokens: vi.fn(),
  }),
  springApiClient: {
    post: vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 50))),
  },
}))

describe('SignOutDialog', () => {
  it('passes isLoading state to ConfirmDialog during async logout', async () => {
    render(<SignOutDialog open={true} onOpenChange={vi.fn()} />)

    const confirmButton = screen.getByRole('button', { name: /sign out/i })
    expect(confirmButton).toBeDefined()
    expect(confirmButton.getAttribute('aria-busy')).toBe('false')

    fireEvent.click(confirmButton)

    // During async logout, confirmButton should reflect busy state and display loading state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /signing out/i })).toBeDefined()
    })

    const loadingButton = screen.getByRole('button', { name: /signing out/i })
    expect(loadingButton.getAttribute('aria-busy')).toBe('true')
    expect(loadingButton.hasAttribute('disabled')).toBe(true)

    // Complete async logout
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/sign-in',
        search: { redirect: '/dashboard' },
        replace: true,
      })
    })
  })
})

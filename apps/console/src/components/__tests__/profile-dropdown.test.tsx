import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProfileDropdown } from '../profile-dropdown'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/' }),
}))

describe('ProfileDropdown', () => {
  it('renders trigger button with explicit aria-label and accessible fallback avatar', () => {
    render(<ProfileDropdown />)

    const triggerButton = screen.getByRole('button', {
      name: /user profile and account settings/i,
    })
    expect(triggerButton).toBeDefined()
    expect(triggerButton.getAttribute('aria-label')).toBe(
      'User profile and account settings'
    )

    const avatarFallback = screen.getByText('SN')
    expect(avatarFallback).toBeDefined()
  })
})

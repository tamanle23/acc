import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProfileDropdown } from '../profile-dropdown'
import { useSpringAuthStore } from '@/features/spring-auth'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/' }),
}))

const mockProfile = {
  userId: 'usr_001',
  username: 'janedoe',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane.doe@example.com',
  preferences: {
    avatarUrl: '/avatars/jane.png',
  },
}

let mockQueryData: any = mockProfile

vi.mock('@/features/settings/profile/api/use-user-profile', () => ({
  useUserProfileQuery: () => ({
    data: mockQueryData,
    isLoading: false,
  }),
}))

describe('ProfileDropdown', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    useSpringAuthStore.setState({
      user: {
        userId: 'usr_001',
        username: 'janedoe',
        tenantId: 'tenant-acme',
        isSovereign: false,
        roles: ['ROLE_STANDARD_MEMBER' as any],
        permissions: [],
        activeFeatures: [],
      },
      isAuthenticated: true,
    })
    mockQueryData = mockProfile
  })

  it('renders trigger button with explicit aria-label and computed avatar initials', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ProfileDropdown />
      </QueryClientProvider>
    )

    const triggerButton = screen.getByRole('button', {
      name: /user profile and account settings/i,
    })
    expect(triggerButton).toBeDefined()
    expect(triggerButton.getAttribute('aria-label')).toBe(
      'User profile and account settings'
    )

    // With Jane Doe, initials should be JD
    const avatarFallback = screen.getByText('JD')
    expect(avatarFallback).toBeDefined()
  })

  it('falls back to username initials when profile names are omitted', () => {
    mockQueryData = {
      userId: 'usr_002',
      username: 'operations_lead',
      firstName: '',
      lastName: '',
      email: 'lead@acc.io',
      preferences: {},
    }

    render(
      <QueryClientProvider client={queryClient}>
        <ProfileDropdown />
      </QueryClientProvider>
    )

    const avatarFallback = screen.getByText('OL')
    expect(avatarFallback).toBeDefined()
  })
})

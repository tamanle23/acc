import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProfileForm } from '../profile-form'
import { useUserProfileQuery, useUpdateUserProfileMutation } from '../api/use-user-profile'
import { useSpringAuthStore } from '@/features/spring-auth'

vi.mock('../api/use-user-profile', () => ({
  useUserProfileQuery: vi.fn(),
  useUpdateUserProfileMutation: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe('ProfileForm Component', () => {
  let queryClient: QueryClient
  const mutateAsyncMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    vi.mocked(useUpdateUserProfileMutation).mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as any)

    useSpringAuthStore.setState({
      user: {
        uid: 'usr-42',
        username: 'alice_admin',
        email: 'alice@acc.io',
        role: 'ROLE_ADMIN',
        roles: ['ROLE_ADMIN'],
        permissions: ['workspace:settings:manage'],
        tenantId: 'tenant-acme',
      } as any,
      currentTenantId: 'tenant-acme',
      isAuthenticated: true,
      isHydrating: false,
    })
  })

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ProfileForm />
      </QueryClientProvider>
    )
  }

  it('renders skeleton loading state while profile query is loading', () => {
    vi.mocked(useUserProfileQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any)

    const { container } = renderComponent()
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull()
    expect(screen.queryByText('Personal Details')).toBeNull()
  })

  it('hydrates profile form with server data and displays dynamic avatar initials', async () => {
    vi.mocked(useUserProfileQuery).mockReturnValue({
      data: {
        userId: 'usr-42',
        username: 'alice_admin',
        firstName: 'Alice',
        lastName: 'Wonderland',
        email: 'alice@wonderland.io',
        phoneNumber: '+1-555-0142',
        preferences: {
          language: 'en',
          bio: 'Lead System Architect',
          urls: [{ value: 'https://github.com/alice' }],
        },
      },
      isLoading: false,
    } as any)

    renderComponent()

    // Identity Card elements
    expect(screen.getByText('Alice Wonderland')).toBeDefined()
    expect(screen.getByText('AW')).toBeDefined() // Initials
    expect(screen.getByText('@alice_admin')).toBeDefined()
    expect(screen.getByText('Verified Account')).toBeDefined()
    expect(screen.getByText('ADMIN')).toBeDefined()
    expect(screen.getByText('tenant-acme')).toBeDefined()

    // Form inputs
    expect((screen.getByLabelText(/first name/i) as HTMLInputElement).value).toBe('Alice')
    expect((screen.getByLabelText(/last name/i) as HTMLInputElement).value).toBe('Wonderland')
    expect((screen.getByLabelText(/email address/i) as HTMLInputElement).value).toBe('alice@wonderland.io')
    expect((screen.getByLabelText(/phone number/i) as HTMLInputElement).value).toBe('+1-555-0142')
    expect((screen.getByLabelText(/biography/i) as HTMLTextAreaElement).value).toBe('Lead System Architect')
    expect(screen.getByDisplayValue('https://github.com/alice')).toBeDefined()
  })

  it('validates required fields on blur or submit', async () => {
    vi.mocked(useUserProfileQuery).mockReturnValue({
      data: {
        userId: 'usr-42',
        username: 'alice_admin',
        firstName: 'Alice',
        lastName: 'Wonderland',
        email: 'alice@wonderland.io',
        preferences: { language: 'en' },
      },
      isLoading: false,
    } as any)

    renderComponent()

    const firstNameInput = screen.getByLabelText(/first name/i)
    fireEvent.change(firstNameInput, { target: { value: '' } })

    const emailInput = screen.getByLabelText(/email address/i)
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } })

    // Submit button
    const submitBtn = screen.getByRole('button', { name: /save profile/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/first name is required/i)).toBeDefined()
      expect(screen.getByText(/please enter a valid email address/i)).toBeDefined()
    })
    expect(mutateAsyncMock).not.toHaveBeenCalled()
  })

  it('submits updated profile data on form submission', async () => {
    mutateAsyncMock.mockResolvedValueOnce({})

    vi.mocked(useUserProfileQuery).mockReturnValue({
      data: {
        userId: 'usr-42',
        username: 'alice_admin',
        firstName: 'Alice',
        lastName: 'Wonderland',
        email: 'alice@wonderland.io',
        phoneNumber: '+1-555-0000',
        preferences: { language: 'en', bio: 'Old Bio' },
      },
      isLoading: false,
    } as any)

    renderComponent()

    const firstNameInput = screen.getByLabelText(/first name/i)
    fireEvent.change(firstNameInput, { target: { value: 'Alicia' } })

    const bioInput = screen.getByLabelText(/biography/i)
    fireEvent.change(bioInput, { target: { value: 'New Senior Staff Architect' } })

    const submitBtn = screen.getByRole('button', { name: /save profile/i })
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Alicia',
          lastName: 'Wonderland',
          email: 'alice@wonderland.io',
          preferences: expect.objectContaining({
            bio: 'New Senior Staff Architect',
          }),
        })
      )
    })
  })

  it('allows adding and removing portfolio URLs', async () => {
    vi.mocked(useUserProfileQuery).mockReturnValue({
      data: {
        userId: 'usr-42',
        username: 'alice_admin',
        firstName: 'Alice',
        lastName: 'Wonderland',
        email: 'alice@wonderland.io',
        preferences: { language: 'en', urls: [{ value: 'https://initial.link' }] },
      },
      isLoading: false,
    } as any)

    renderComponent()

    expect(screen.getByDisplayValue('https://initial.link')).toBeDefined()

    // Add URL
    const addUrlBtn = screen.getByRole('button', { name: /add url/i })
    fireEvent.click(addUrlBtn)

    const urlInputs = screen.getAllByPlaceholderText('https://github.com/org')
    expect(urlInputs.length).toBe(2)

    fireEvent.change(urlInputs[1], { target: { value: 'https://portfolio.dev' } })
    expect(screen.getByDisplayValue('https://portfolio.dev')).toBeDefined()

    // Remove first URL
    const removeBtn = screen.getByRole('button', { name: /remove url #1/i })
    fireEvent.click(removeBtn)

    expect(screen.queryByDisplayValue('https://initial.link')).toBeNull()
    expect(screen.getByDisplayValue('https://portfolio.dev')).toBeDefined()
  })

  it('allows reverting changes with Revert button', async () => {
    vi.mocked(useUserProfileQuery).mockReturnValue({
      data: {
        userId: 'usr-42',
        username: 'alice_admin',
        firstName: 'Alice',
        lastName: 'Wonderland',
        email: 'alice@wonderland.io',
        preferences: { language: 'en' },
      },
      isLoading: false,
    } as any)

    renderComponent()

    const firstNameInput = screen.getByLabelText(/first name/i)
    fireEvent.change(firstNameInput, { target: { value: 'ModifiedName' } })
    expect((firstNameInput as HTMLInputElement).value).toBe('ModifiedName')

    // Click Revert
    const revertBtn = screen.getByRole('button', { name: /revert/i })
    expect((revertBtn as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(revertBtn)

    await waitFor(() => {
      expect((screen.getByLabelText(/first name/i) as HTMLInputElement).value).toBe('Alice')
    })
  })
})

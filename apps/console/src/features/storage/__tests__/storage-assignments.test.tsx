import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { StorageAssignmentsDialog } from '../storage-assignments-dialog'
import { ProfileProvider } from '@/context/profile-provider'
import type { StorageProvider } from '../data/storages'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}))

const mockProvider: StorageProvider = {
  id: 'storage-s3-prod',
  name: 'Amazon S3 Standard Bucket',
  logo: <span data-testid="mock-logo" />,
  status: 'enabled',
  descKey: 'storage.s3.desc',
  defaultDesc: 'S3 bucket for primary data storage',
  storageMode: 'Archive',
  providerType: 'User Provided',
  lifecycleStatus: 'Live',
  assignedWorkspaces: [
    { workspaceId: 'ws-default', enabled: true },
  ],
}

const mockProfiles = [
  { id: 'ws-default', name: 'Acme Corp Default' },
  { id: 'ws-marketing', name: 'Marketing Workspace' },
]

describe('StorageAssignmentsDialog', () => {
  it('renders workspace assignments with O(1) Map pre-indexed profile lookup', () => {
    render(
      <ProfileProvider defaultProfiles={mockProfiles}>
        <StorageAssignmentsDialog
          open={true}
          onOpenChange={vi.fn()}
          provider={mockProvider}
          onUpdateProvider={vi.fn()}
        />
      </ProfileProvider>
    )

    expect(screen.getByText(/Workspace Assignments/i)).toBeDefined()
    expect(screen.getByText('Acme Corp Default')).toBeDefined()
    expect(screen.getByText('Marketing Workspace')).toBeDefined()
  })

  it('renders null when provider is null', () => {
    const { container } = render(
      <ProfileProvider defaultProfiles={mockProfiles}>
        <StorageAssignmentsDialog
          open={true}
          onOpenChange={vi.fn()}
          provider={null}
          onUpdateProvider={vi.fn()}
        />
      </ProfileProvider>
    )

    expect(container.firstChild).toBeNull()
  })
})

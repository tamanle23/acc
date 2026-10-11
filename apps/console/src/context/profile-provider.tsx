import * as React from 'react'
import { useProfileStore, type Profile } from '@/stores/profile-store'

export type { Profile }

type ProfileContextType = {
  currentProfile: Profile
  profiles: Profile[]
  setCurrentProfile: (profile: Profile) => void
  setProfiles: (profiles: Profile[]) => void
  syncAssumedTenant: (tenantId: string | null, tenantName?: string | null) => void
}

const ProfileContext = React.createContext<ProfileContextType | null>(null)

type ProfileProviderProps = {
  children: React.ReactNode
  defaultProfiles?: Profile[]
}

export function ProfileProvider({ children, defaultProfiles }: ProfileProviderProps) {
  // Optimization: Use granular Zustand state selectors instead of full store subscription (`useProfileStore()`).
  // Calling `useProfileStore()` without a selector causes the provider to re-subscribe to all state changes,
  // triggering unnecessary re-renders when unrelated store properties update. Granular selectors preserve
  // referential stability for actions and ensure re-renders only occur when selected state slice changes.
  const currentProfile = useProfileStore((state) => state.currentProfile)
  const profiles = useProfileStore((state) => state.profiles)
  const setCurrentProfile = useProfileStore((state) => state.setCurrentProfile)
  const setProfiles = useProfileStore((state) => state.setProfiles)
  const syncAssumedTenant = useProfileStore((state) => state.syncAssumedTenant)

  React.useEffect(() => {
    if (defaultProfiles && defaultProfiles.length > 0) {
      setProfiles(defaultProfiles)
    }
  }, [defaultProfiles, setProfiles])

  const value = React.useMemo<ProfileContextType>(
    () => ({
      currentProfile,
      profiles,
      setCurrentProfile,
      setProfiles,
      syncAssumedTenant,
    }),
    [currentProfile, profiles, setCurrentProfile, setProfiles, syncAssumedTenant]
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProfile() {
  const context = React.useContext(ProfileContext)
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider')
  }
  return context
}

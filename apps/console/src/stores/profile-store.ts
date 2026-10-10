import { create } from 'zustand'
import { getCookie, setCookie } from '@/lib/cookies'
import { sidebarTeams } from '@/components/layout/data/sidebar-data'
import { Crown, Building2 } from 'lucide-react'

export type Profile = {
  id?: string
  name: string
  logo?: React.ElementType
  plan?: string
  tenantId?: string
  tenantName?: string
  [key: string]: unknown
}

export const SOVEREIGN_PROFILE: Profile = {
  id: 'ws-sovereign-root',
  name: '👑 Sovereign Platform',
  logo: Crown,
  plan: 'Fleet Custody',
  tenantId: 'SYSTEM',
  tenantName: 'Sovereign Root System',
}

const PROFILE_COOKIE_NAME = 'console_active_profile'
const PROFILE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

export interface ProfileState {
  currentProfile: Profile
  profiles: Profile[]
  setCurrentProfile: (profile: Profile) => void
  setProfiles: (profiles: Profile[]) => void
  syncAssumedTenant: (tenantId: string | null, tenantName?: string | null) => void
}

export function resolveTenantProfile(
  tenantId: string,
  tenantName?: string | null,
  currentProfiles: Profile[] = sidebarTeams as Profile[]
): { profile: Profile; allProfiles: Profile[] } {
  if (tenantId === 'SYSTEM') {
    const hasSovereign = currentProfiles.some(
      (p) => p.id === 'ws-sovereign-root' || p.tenantId === 'SYSTEM'
    )
    const allProfiles = hasSovereign ? currentProfiles : [SOVEREIGN_PROFILE, ...currentProfiles]
    return { profile: SOVEREIGN_PROFILE, allProfiles }
  }

  // Look for existing profile for this tenant
  const existing = currentProfiles.find((p) => p.tenantId === tenantId)
  if (existing) {
    return { profile: existing, allProfiles: currentProfiles }
  }

  // Synthesize a delegated workspace for this tenant
  const delegatedWorkspace: Profile = {
    id: `ws-${tenantId}`,
    name: tenantName ? `${tenantName} Workspace` : `${tenantId} Workspace`,
    logo: Building2,
    plan: 'Delegated Workspace',
    tenantId,
    tenantName: tenantName || tenantId,
  }

  return {
    profile: delegatedWorkspace,
    allProfiles: [...currentProfiles, delegatedWorkspace],
  }
}

export const useProfileStore = create<ProfileState>()((set, get) => {
  let defaultProfiles = sidebarTeams as Profile[]
  let initialProfile = defaultProfiles[0]

  const assumedTenant = typeof window !== 'undefined' ? localStorage.getItem('unipost_assumed_tenant') : null
  const assumedTenantName = typeof window !== 'undefined' ? localStorage.getItem('unipost_assumed_tenant_name') : null

  if (assumedTenant && assumedTenant !== 'SYSTEM') {
    const { profile, allProfiles } = resolveTenantProfile(assumedTenant, assumedTenantName, defaultProfiles)
    defaultProfiles = allProfiles
    initialProfile = profile
  } else {
    const savedProfileName = getCookie(PROFILE_COOKIE_NAME)
    if (savedProfileName) {
      const matched = defaultProfiles.find((p) => p.name === savedProfileName || p.id === savedProfileName)
      if (matched) {
        initialProfile = matched
      }
    }
  }

  return {
    currentProfile: initialProfile,
    profiles: defaultProfiles,
    setCurrentProfile: (profile: Profile) => {
      setCookie(PROFILE_COOKIE_NAME, profile.id ?? profile.name, PROFILE_COOKIE_MAX_AGE)
      set({ currentProfile: profile })
    },
    setProfiles: (profiles: Profile[]) => {
      const current = get().currentProfile
      const stillExists = profiles.find((p) => (p.id && p.id === current.id) || p.name === current.name)
      set({
        profiles,
        currentProfile: stillExists ?? profiles[0] ?? current,
      })
    },
    syncAssumedTenant: (tenantId: string | null, tenantName?: string | null) => {
      if (!tenantId || tenantId === 'SYSTEM') {
        const defaultList = sidebarTeams as Profile[]
        const restoredProfile = defaultList[0]
        set({
          profiles: defaultList,
          currentProfile: restoredProfile,
        })
        setCookie(PROFILE_COOKIE_NAME, restoredProfile.id ?? restoredProfile.name, PROFILE_COOKIE_MAX_AGE)
        return
      }

      const { profile, allProfiles } = resolveTenantProfile(tenantId, tenantName, get().profiles)
      set({
        profiles: allProfiles,
        currentProfile: profile,
      })
      setCookie(PROFILE_COOKIE_NAME, profile.id ?? profile.name, PROFILE_COOKIE_MAX_AGE)
    },
  }
})

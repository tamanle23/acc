export interface TikTokProfile {
  open_id: string
  union_id: string
  avatar_url: string
  avatar_url_100: string
  avatar_url_200: string
  avatar_large_url: string
  display_name: string
  profile_deep_link: string
  is_verified: boolean
}

export interface TikTokTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  refreshExpiresIn: number
  expiresAt: string
  tokenType: string
  scope: string
}

const TIKTOK_SCOPES = [
  'user.info.basic',
  'video.list',
  'video.upload'
]

/**
 * Builds the TikTok Login Kit v2 Authorization URL for acquiring an Authorization Code.
 */
export function buildTikTokOAuthUrl(
  clientKey: string,
  redirectUri: string,
  state?: string
): string {
  const params = new URLSearchParams({
    client_key: clientKey,
    response_type: 'code',
    scope: TIKTOK_SCOPES.join(','),
    redirect_uri: redirectUri,
    ...(state ? { state } : {}),
  })
  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`
}

/**
 * Exchanges the Authorization Code for an Access Token and a Refresh Token via TikTok OAuth2.
 */
export async function exchangeAuthCodeForTokens(
  clientKey: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): Promise<TikTokTokens> {
  const params = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })

  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: params.toString(),
  })

  const data = await res.json()

  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error?.message || 'Failed to exchange authorization code for TikTok tokens.')
  }

  const expiresIn = data.expires_in || 86400
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn,
    refreshExpiresIn: data.refresh_expires_in || 31536000,
    expiresAt,
    tokenType: data.token_type || 'Bearer',
    scope: data.scope || '',
  }
}

/**
 * Uses a valid Refresh Token to get a new Access Token.
 */
export async function refreshAccessToken(
  clientKey: string,
  clientSecret: string,
  refreshToken: string
): Promise<TikTokTokens> {
  const params = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: params.toString(),
  })

  const data = await res.json()

  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error?.message || 'Failed to refresh TikTok access token.')
  }

  const expiresIn = data.expires_in || 86400
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token, // TikTok rotation
    expiresIn,
    refreshExpiresIn: data.refresh_expires_in || 31536000,
    expiresAt,
    tokenType: data.token_type || 'Bearer',
    scope: data.scope || '',
  }
}

/**
 * Fetches the authenticated user's TikTok profile details.
 */
export async function fetchTikTokProfile(
  accessToken: string
): Promise<TikTokProfile> {
  const res = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,avatar_url_100,avatar_url_200,avatar_large_url,display_name,profile_deep_link,is_verified', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const data = await res.json()

  if (!res.ok || data.error) {
    throw new Error(data.error?.message || 'Failed to fetch TikTok profile info.')
  }

  if (!data.data || !data.data.user) {
    throw new Error('No user profile found for this TikTok account.')
  }

  return data.data.user
}

/**
 * Sandbox Demo Simulation functions for zero-friction local testing.
 */
export function simulateDemoTikTokAuthCode(): string {
  return 'tiktok_demo_code_V2_xyz987'
}

export function simulateDemoTokenExchange(): {
  tokens: TikTokTokens
  profile: TikTokProfile
} {
  const expiresIn = 86400
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  return {
    tokens: {
      accessToken: 'act.demo_tiktok_access_token_v2',
      refreshToken: 'rft.demo_tiktok_refresh_token_v2',
      expiresIn,
      refreshExpiresIn: 31536000,
      expiresAt,
      tokenType: 'Bearer',
      scope: TIKTOK_SCOPES.join(','),
    },
    profile: {
      open_id: 'tiktok_open_id_123456789',
      union_id: 'tiktok_union_id_987654321',
      avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=128&auto=format&fit=crop&q=80',
      avatar_url_100: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=128&auto=format&fit=crop&q=80',
      avatar_url_200: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=256&auto=format&fit=crop&q=80',
      avatar_large_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=512&auto=format&fit=crop&q=80',
      display_name: 'Unipost Studio TikTok',
      profile_deep_link: 'tiktok://user/profile/acc',
      is_verified: true,
    },
  }
}

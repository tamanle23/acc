export interface YouTubeChannel {
  id: string
  title: string
  description?: string
  customUrl?: string
  avatarUrl?: string
  subscriberCount?: string
  videoCount?: string
  viewCount?: string
}

export interface YouTubeTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  expiresAt: string
  tokenType: string
  scope: string
}

const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.force-ssl',
]

/**
 * Builds the Google OAuth 2.0 Authorization URL for acquiring an Authorization Code.
 * Note: access_type=offline and prompt=consent are critical to guarantee receiving a Refresh Token.
 */
export function buildGoogleOAuthUrl(
  clientId: string,
  redirectUri: string,
  state?: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: YOUTUBE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    ...(state ? { state } : {}),
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Exchanges the Authorization Code for an Access Token and a Refresh Token via Google OAuth2.
 */
export async function exchangeAuthCodeForTokens(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): Promise<YouTubeTokens> {
  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const data = await res.json()

  if (!res.ok || data.error) {
    throw new Error(
      data.error_description || data.error || 'Failed to exchange authorization code for tokens.'
    )
  }

  const expiresIn = data.expires_in || 3600
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    expiresIn,
    expiresAt,
    tokenType: data.token_type || 'Bearer',
    scope: data.scope || '',
  }
}

/**
 * Refreshes an expired access token using the stored refresh token.
 */
export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number; expiresAt: string }> {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const data = await res.json()

  if (!res.ok || data.error) {
    throw new Error(
      data.error_description || data.error || 'Failed to refresh YouTube access token.'
    )
  }

  const expiresIn = data.expires_in || 3600
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  return {
    accessToken: data.access_token,
    expiresIn,
    expiresAt,
  }
}

/**
 * Fetches the authenticated user's YouTube Channel details.
 */
export async function fetchYouTubeChannel(accessToken: string): Promise<YouTubeChannel> {
  const url = 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true'

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  const data = await res.json()

  if (!res.ok || data.error) {
    throw new Error(data.error?.message || 'Failed to fetch YouTube channel info.')
  }

  if (!data.items || data.items.length === 0) {
    throw new Error('No YouTube channel found for this Google account.')
  }

  const channel = data.items[0]
  const snippet = channel.snippet || {}
  const statistics = channel.statistics || {}

  return {
    id: channel.id,
    title: snippet.title || 'Untitled Channel',
    description: snippet.description || '',
    customUrl: snippet.customUrl || `@${snippet.title?.toLowerCase().replace(/\s+/g, '')}`,
    avatarUrl: snippet.thumbnails?.default?.url || snippet.thumbnails?.medium?.url || '',
    subscriberCount: statistics.subscriberCount,
    videoCount: statistics.videoCount,
    viewCount: statistics.viewCount,
  }
}

/**
 * Sandbox Demo Simulation functions for zero-friction local testing.
 */
export function simulateDemoYouTubeAuthCode(): string {
  return '4/0AfgeXku0L8K_n3s2A4Vw9f3qR7tY1uI2oP4aS5dF6gH7jK8lZ9xCVB_demo_code'
}

export function simulateDemoTokenExchange(): {
  tokens: YouTubeTokens
  channel: YouTubeChannel
} {
  const expiresIn = 3600
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  return {
    tokens: {
      accessToken: 'ya29.a0AfH6SMB_demo_access_token_acc_youtube_api_v3',
      refreshToken: '1//04eY6fA8b7c6d5e4f3a2b1_demo_refresh_token_never_expires',
      expiresIn,
      expiresAt,
      tokenType: 'Bearer',
      scope: YOUTUBE_SCOPES.join(' '),
    },
    channel: {
      id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
      title: 'Unipost Studio',
      description: 'Official YouTube Channel for Unipost media publishing and automated releases.',
      customUrl: '@accstudio',
      avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&auto=format&fit=crop&q=80',
      subscriberCount: '142,500',
      videoCount: '86',
      viewCount: '3,420,000',
    },
  }
}

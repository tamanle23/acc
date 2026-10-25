/**
 * Facebook Graph API & SDK Service
 * Graph API Version: v21.0
 */

export type FacebookPage = {
  id: string
  name: string
  category?: string
  accessToken: string
  isLongLived: boolean
  expiresAt?: string | null
  pictureUrl?: string
}

export type FacebookAuthResponse = {
  accessToken: string
  userID: string
  expiresIn: number
  signedRequest?: string
  graphDomain?: string
}

export type FacebookAuthResult = {
  success: boolean
  userAccessToken?: string
  userId?: string
  error?: string
}

declare global {
  interface Window {
    FB?: {
      init: (options: {
        appId: string
        cookie: boolean
        xfbml: boolean
        version: string
      }) => void
      login: (
        callback: (response: {
          authResponse?: FacebookAuthResponse
          status: string
        }) => void,
        options: { scope: string }
      ) => void
      logout: (callback: () => void) => void
      getLoginStatus: (callback: (response: {
        status: string
        authResponse?: FacebookAuthResponse
      }) => void) => void
    }
    fbAsyncInit?: () => void
  }
}

// Scopes required to manage Pages and acquire Page Access Tokens
const FACEBOOK_PAGE_SCOPES =
  'public_profile,pages_show_list,pages_read_engagement,pages_manage_posts'

/**
 * Dynamically load and initialize Facebook JavaScript SDK
 */
async function loadFacebookSdk(appId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false

  // If already initialized
  if (window.FB) {
    try {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: true,
        version: 'v21.0',
      })
      return true
    } catch {
      // Fall through to reload
    }
  }

  return new Promise((resolve) => {
    window.fbAsyncInit = function () {
      window.FB?.init({
        appId,
        cookie: true,
        xfbml: true,
        version: 'v21.0',
      })
      resolve(true)
    }

    // Check if script already injected
    if (document.getElementById('facebook-jssdk')) {
      if (window.FB) resolve(true)
      return
    }

    const js = document.createElement('script')
    js.id = 'facebook-jssdk'
    js.src = 'https://connect.facebook.net/en_US/sdk.js'
    js.async = true
    js.defer = true
    js.onerror = () => resolve(false)
    document.body.appendChild(js)
  })
}

/**
 * Trigger Facebook Login dialog to obtain user access token with page scopes
 */
export async function loginWithFacebook(appId: string): Promise<FacebookAuthResult> {
  const sdkLoaded = await loadFacebookSdk(appId)

  if (!sdkLoaded || !window.FB) {
    return {
      success: false,
      error:
        'Could not load Facebook SDK. Please check your network or disable content blockers.',
    }
  }

  return new Promise((resolve) => {
    window.FB?.login(
      (response) => {
        if (response.authResponse?.accessToken) {
          resolve({
            success: true,
            userAccessToken: response.authResponse.accessToken,
            userId: response.authResponse.userID,
          })
        } else {
          resolve({
            success: false,
            error: 'Facebook Login was canceled or unauthorized by user.',
          })
        }
      },
      { scope: FACEBOOK_PAGE_SCOPES }
    )
  })
}

/**
 * Fetch all Facebook Pages the user manages via Graph API /me/accounts
 * This endpoint returns short-lived Page Access Tokens for each page.
 */
export async function fetchFacebookPages(
  userAccessToken: string
): Promise<FacebookPage[]> {
  const url = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,category,picture{url}&access_token=${encodeURIComponent(
    userAccessToken
  )}`

  const res = await fetch(url)
  if (!res.ok) {
    const errorData = (await res.json().catch(() => ({}))) as {
      error?: { message?: string }
    }
    throw new Error(
      errorData.error?.message ||
      `Failed to fetch Facebook Pages (HTTP ${res.status})`
    )
  }

  const data = (await res.json()) as {
    data: Array<{
      id: string
      name: string
      access_token: string
      category?: string
      picture?: { data?: { url?: string } }
    }>
  }

  return (data.data || []).map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category || 'Business Page',
    accessToken: item.access_token,
    isLongLived: false,
    expiresAt: new Date(Date.now() + 3600 * 1000 * 2).toISOString(), // ~2 hours default short-lived
    pictureUrl: item.picture?.data?.url,
  }))
}

/**
 * Exchange a short-lived user access token for a long-lived user token (60 days),
 * then re-query /me/accounts with the long-lived token to obtain permanent Page Access Tokens.
 */
export async function exchangeForLongLivedPageToken(params: {
  shortLivedUserToken: string
  appId: string
  appSecret: string
  pageId: string
}): Promise<{
  longLivedPageToken: string
  expiresAt: string | null
}> {
  const { shortLivedUserToken, appId, appSecret, pageId } = params

  // Step 1: Exchange user token for long-lived user token
  const exchangeUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(
    appId
  )}&client_secret=${encodeURIComponent(
    appSecret
  )}&fb_exchange_token=${encodeURIComponent(shortLivedUserToken)}`

  const userTokenRes = await fetch(exchangeUrl)
  if (!userTokenRes.ok) {
    const err = (await userTokenRes.json().catch(() => ({}))) as {
      error?: { message?: string }
    }
    throw new Error(
      err.error?.message ||
      `Failed to exchange for long-lived user token (HTTP ${userTokenRes.status})`
    )
  }

  const userTokenData = (await userTokenRes.json()) as {
    access_token: string
    expires_in?: number
  }

  const longLivedUserToken = userTokenData.access_token

  // Step 2: Fetch Page Access Token using the long-lived user token.
  // In Facebook Graph API, a Page token generated via a long-lived User token NEVER expires!
  const pageAccountsUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(
    longLivedUserToken
  )}`

  const pagesRes = await fetch(pageAccountsUrl)
  if (!pagesRes.ok) {
    const err = (await pagesRes.json().catch(() => ({}))) as {
      error?: { message?: string }
    }
    throw new Error(
      err.error?.message ||
      `Failed to acquire long-lived page token (HTTP ${pagesRes.status})`
    )
  }

  const pagesData = (await pagesRes.json()) as {
    data: Array<{ id: string; name: string; access_token: string }>
  }

  const matchedPage = pagesData.data.find((p) => p.id === pageId)
  if (!matchedPage) {
    throw new Error(`Target page ID ${pageId} not found under long-lived user token`)
  }

  return {
    longLivedPageToken: matchedPage.access_token,
    expiresAt: null, // Facebook permanent page tokens do not expire unless revoked
  }
}

/**
 * Mock Simulation for Development & Demo Sandbox Mode
 * Allows testing the entire flow without a live Meta App verified in production
 */
export function simulateDemoFacebookLogin(): {
  userAccessToken: string
  pages: FacebookPage[]
} {
  const mockUserToken =
    'EAAB' + Math.random().toString(36).substring(2, 15) + 'DEMO_USER_SHORT_LIVED'

  const mockPages: FacebookPage[] = [
    {
      id: '102938475610293',
      name: 'Acc Official Store',
      category: 'E-commerce & Retail',
      accessToken:
        'EAAB' +
        Math.random().toString(36).substring(2, 15) +
        '_PAGE_TOKEN_SHORT_LIVED',
      isLongLived: false,
      expiresAt: new Date(Date.now() + 3600 * 1000 * 2).toISOString(),
    },
    {
      id: '584736291029384',
      name: 'Acc Community Hub',
      category: 'Community Organization',
      accessToken:
        'EAAB' +
        Math.random().toString(36).substring(2, 15) +
        '_PAGE_TOKEN_SHORT_LIVED',
      isLongLived: false,
      expiresAt: new Date(Date.now() + 3600 * 1000 * 2).toISOString(),
    },
    {
      id: '920192837465019',
      name: 'TekGo Digital Labs',
      category: 'Technology & Software',
      accessToken:
        'EAAB' +
        Math.random().toString(36).substring(2, 15) +
        '_PAGE_TOKEN_SHORT_LIVED',
      isLongLived: false,
      expiresAt: new Date(Date.now() + 3600 * 1000 * 2).toISOString(),
    },
  ]

  return {
    userAccessToken: mockUserToken,
    pages: mockPages,
  }
}

export function simulateDemoLongLivedExchange(pageId: string): {
  longLivedPageToken: string
  expiresAt: string | null
} {
  return {
    longLivedPageToken:
      'EAAB' +
      Math.random().toString(36).substring(2, 15) +
      `_PERMANENT_LONG_LIVED_PAGE_${pageId}`,
    expiresAt: null, // Never expires
  }
}

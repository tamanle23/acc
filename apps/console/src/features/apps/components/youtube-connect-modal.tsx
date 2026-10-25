import { useState } from 'react'
import {
  BarChart3,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Loader2,
  MessageSquareQuote,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Unplug,
  Video,
} from 'lucide-react'
import { toast } from 'sonner'
import { IconYoutube } from '@acc/ui/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  buildGoogleOAuthUrl,
  exchangeAuthCodeForTokens,
  fetchYouTubeChannel,
  refreshAccessToken,
  simulateDemoTokenExchange,
  simulateDemoYouTubeAuthCode,
} from '../services/youtube-service'
import { useYouTubeStore, YOUTUBE_ENV_CONFIG } from '../stores/youtube-store'
import { springApiClient } from '@/features/spring-auth'

type YouTubeConnectModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function YouTubeConnectModal({
  open,
  onOpenChange,
}: YouTubeConnectModalProps) {
  const {
    isConnected,
    clientId,
    clientSecret,
    authCode,
    accessToken,
    refreshToken,
    expiresAt,
    connectedChannel,
    isDemoMode,
    setCredentials,
    setAuthCode,
    setTokens,
    updateAccessToken,
    setConnectedChannel,
    setIsDemoMode,
    disconnect,
  } = useYouTubeStore()

  const [inputClientId, setInputClientId] = useState(clientId)
  const [inputClientSecret, setInputClientSecret] = useState(clientSecret)
  const [manualAuthCode, setManualAuthCode] = useState(authCode)
  const [isAuthorizing, setIsAuthorizing] = useState(false)
  const [isExchanging, setIsExchanging] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [showAccessToken, setShowAccessToken] = useState(false)
  const [showRefreshToken, setShowRefreshToken] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [copiedToken, setCopiedToken] = useState<'access' | 'refresh' | 'code' | null>(null)

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setInputClientId(clientId || YOUTUBE_ENV_CONFIG.envClientId)
      setInputClientSecret(clientSecret || YOUTUBE_ENV_CONFIG.envClientSecret)
      setManualAuthCode(authCode)
    }
    onOpenChange(newOpen)
  }

  // Step 1: Launch Google OAuth Flow to Acquire Authorization Code
  const handleAcquireCode = async (useSandbox: boolean) => {
    setIsAuthorizing(true)
    try {
      if (useSandbox) {
        setIsDemoMode(true)
        const mockCode = simulateDemoYouTubeAuthCode()
        setAuthCode(mockCode)
        setManualAuthCode(mockCode)
        toast.success('Sandbox Demo Authorization Code acquired with offline access!')
        return
      }

      const effectiveClientId = inputClientId.trim() || clientId.trim()
      const effectiveClientSecret = inputClientSecret.trim() || clientSecret.trim()

      if (!effectiveClientId) {
        setShowAdvanced(true)
        toast.error(
          'No Google Client ID found. Please configure VITE_YOUTUBE_CLIENT_ID in .env.local or enter one in Advanced Settings below.'
        )
        return
      }

      setCredentials(effectiveClientId, effectiveClientSecret)
      setIsDemoMode(false)

      const redirectUri = `${window.location.origin}/apps`
      const authUrl = buildGoogleOAuthUrl(effectiveClientId, redirectUri)

      // Open centered popup window
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2

      const popup = window.open(
        authUrl,
        'google_oauth_popup',
        `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=no, copyhistory=no, width=${width}, height=${height}, top=${top}, left=${left}`
      )

      if (!popup) {
        toast.error('Popup blocked by browser. Please allow popups or use direct URL.')
        return
      }

      // Poll popup URL for authorization code redirect
      const pollTimer = setInterval(() => {
        try {
          if (!popup || popup.closed) {
            clearInterval(pollTimer)
            setIsAuthorizing(false)
            return
          }

          const currentUrl = popup.location.href
          if (currentUrl && currentUrl.includes('/apps')) {
            const urlObj = new URL(currentUrl)
            const code = urlObj.searchParams.get('code')
            const error = urlObj.searchParams.get('error')

            popup.close()
            clearInterval(pollTimer)
            setIsAuthorizing(false)

            if (error) {
              toast.error(`Google Authorization Error: ${error}`)
              return
            }

            if (code) {
              setAuthCode(code)
              setManualAuthCode(code)
              toast.success('YouTube Authorization Code acquired successfully!')
            }
          }
        } catch {
          // Cross-origin access error while on accounts.google.com - expected until redirect
        }
      }, 500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initiate authorization flow.'
      toast.error(msg)
      setIsAuthorizing(false)
    }
  }

  // Step 2: Exchange Authorization Code for Access Token and Refresh Token
  const handleExchangeTokens = async () => {
    const codeToUse = manualAuthCode.trim() || authCode.trim()
    if (!codeToUse) {
      toast.error('No authorization code available to exchange.')
      return
    }

    setIsExchanging(true)
    try {
      if (isDemoMode) {
        const res = await springApiClient.post<{
          success: boolean;
          accessToken: string;
          details: { channel: any };
        }>('/api/integrations/youtube/exchange', {
          authCode: codeToUse,
        })
        const demo = simulateDemoTokenExchange()
        setTokens({
          ...demo.tokens,
          accessToken: res.data.accessToken || demo.tokens.accessToken,
        })
        setConnectedChannel(res.data.details?.channel || demo.channel)
        toast.success(
          'Exchanged code for Access Token & Refresh Token! Connected to demo channel via Unified Sandbox.'
        )
        return
      }

      const effectiveClientId = inputClientId.trim() || clientId.trim()
      const effectiveClientSecret = inputClientSecret.trim() || clientSecret.trim()

      if (!effectiveClientId || !effectiveClientSecret) {
        setShowAdvanced(true)
        toast.error(
          'Google Client ID and Client Secret are required for token exchange. Please provide them in Advanced Settings.'
        )
        return
      }

      setCredentials(effectiveClientId, effectiveClientSecret)

      const redirectUri = `${window.location.origin}/apps`
      const tokens = await exchangeAuthCodeForTokens(
        effectiveClientId,
        effectiveClientSecret,
        codeToUse,
        redirectUri
      )

      setTokens(tokens)

      // Discover authenticated channel details
      try {
        const channel = await fetchYouTubeChannel(tokens.accessToken)
        setConnectedChannel(channel)
        toast.success(`Connected to YouTube Channel: "${channel.title}"!`)
      } catch (channelErr: unknown) {
        const channelMsg =
          channelErr instanceof Error
            ? channelErr.message
            : 'Could not fetch channel profile.'
        toast.warning(`Tokens acquired, but channel discovery failed: ${channelMsg}`)
        // Set fallback channel representation
        setConnectedChannel({
          id: 'authenticated-user',
          title: 'Authenticated YouTube Account',
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to exchange authorization code.'
      toast.error(msg)
    } finally {
      setIsExchanging(false)
    }
  }

  // Step 3: Refresh Access Token using Refresh Token
  const handleRefreshToken = async () => {
    if (!refreshToken) {
      toast.error('No refresh token available.')
      return
    }

    setIsRefreshing(true)
    try {
      if (isDemoMode) {
        const newExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString()
        updateAccessToken('ya29.a0AfH6SMB_refreshed_demo_access_token_acc', newExpiresAt)
        toast.success('Access Token refreshed successfully with Sandbox Refresh Token!')
        return
      }

      const effectiveClientId = inputClientId.trim() || clientId.trim()
      const effectiveClientSecret = inputClientSecret.trim() || clientSecret.trim()

      if (!effectiveClientId || !effectiveClientSecret) {
        toast.error('Client ID and Secret are required to refresh access tokens.')
        return
      }

      const refreshed = await refreshAccessToken(
        effectiveClientId,
        effectiveClientSecret,
        refreshToken
      )

      updateAccessToken(refreshed.accessToken, refreshed.expiresAt)
      toast.success('Access Token successfully refreshed with stored Refresh Token!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh token.'
      toast.error(msg)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleCopy = (text: string, type: 'access' | 'refresh' | 'code') => {
    navigator.clipboard.writeText(text)
    setCopiedToken(type)
    toast.success(`${type === 'code' ? 'Authorization Code' : type === 'access' ? 'Access Token' : 'Refresh Token'} copied to clipboard`)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const handleDisconnect = () => {
    disconnect()
    setManualAuthCode('')
    toast.info('Disconnected from YouTube')
  }

  const maskString = (str: string) => {
    if (!str) return ''
    if (str.length <= 14) return '••••••••••••'
    return `${str.slice(0, 7)}••••••••••••${str.slice(-6)}`
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-w-xl rounded-2xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/95'>
        <DialogHeader className='text-start'>
          <div className='flex items-center gap-3'>
            <div className='flex size-10 items-center justify-center rounded-xl bg-red-600 text-white shadow-md shadow-red-500/20'>
              <IconYoutube className='size-6 fill-white text-white' />
            </div>
            <div>
              <DialogTitle className='text-lg font-semibold'>
                YouTube Channel Integration
              </DialogTitle>
              <DialogDescription className='text-xs text-muted-foreground'>
                Acquire an Authorization Code, exchange for an Access Token & Refresh Token, and manage your YouTube Channel.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* View 1: Not Connected & No Authorization Code yet -> Initiate Auth */}
        {!isConnected && !authCode ? (
          <div className='space-y-4 pt-1'>
            {/* Value Proposition */}
            <div className='rounded-2xl border border-white/20 bg-gradient-to-b from-red-500/[0.08] to-red-500/[0.02] p-5 shadow-xs backdrop-blur-md dark:border-white/10 dark:from-red-500/[0.12] dark:to-transparent'>
              <div className='flex items-start gap-3.5'>
                <div className='flex size-11 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-md shadow-red-500/25'>
                  <IconYoutube className='size-6 fill-white' />
                </div>
                <div className='space-y-1'>
                  <h3 className='text-sm font-semibold text-foreground'>
                    Connect your YouTube Channel
                  </h3>
                  <p className='text-xs text-muted-foreground leading-relaxed'>
                    Authorize Console to manage your YouTube videos, playlists, monitor video engagement, and sync channel statistics.
                  </p>
                </div>
              </div>

              <div className='mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3'>
                <div className='flex items-center gap-2 rounded-lg bg-background/60 p-2 text-xs text-foreground/90 backdrop-blur-xs border border-border/40'>
                  <Video className='size-3.5 text-red-600 dark:text-red-400 shrink-0' />
                  <span className='font-medium text-[11px]'>Video Uploads</span>
                </div>
                <div className='flex items-center gap-2 rounded-lg bg-background/60 p-2 text-xs text-foreground/90 backdrop-blur-xs border border-border/40'>
                  <MessageSquareQuote className='size-3.5 text-red-600 dark:text-red-400 shrink-0' />
                  <span className='font-medium text-[11px]'>Comment Sync</span>
                </div>
                <div className='flex items-center gap-2 rounded-lg bg-background/60 p-2 text-xs text-foreground/90 backdrop-blur-xs border border-border/40'>
                  <BarChart3 className='size-3.5 text-red-600 dark:text-red-400 shrink-0' />
                  <span className='font-medium text-[11px]'>Analytics</span>
                </div>
              </div>
            </div>

            {/* Requested Scopes */}
            <div className='rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground'>
              <div className='flex flex-wrap items-center gap-2'>
                <ShieldCheck className='size-4 text-red-600 shrink-0 dark:text-red-400' />
                <span className='font-medium text-foreground text-[11px]'>
                  Google Scopes:
                </span>
                <code className='rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-700 dark:text-red-300 font-mono'>
                  youtube.readonly
                </code>
                <code className='rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-700 dark:text-red-300 font-mono'>
                  youtube.upload
                </code>
                <code className='rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-700 dark:text-red-300 font-mono'>
                  youtube.force-ssl
                </code>
              </div>
            </div>

            {/* Action Buttons */}
            <div className='space-y-2 pt-1'>
              <Button
                size='lg'
                onClick={() => handleAcquireCode(false)}
                disabled={isAuthorizing}
                className='w-full bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-500/25 text-sm font-medium h-10 transition-all'
              >
                {isAuthorizing ? (
                  <>
                    <Loader2 className='me-2 size-4 animate-spin' /> Authorizing with Google...
                  </>
                ) : (
                  <>
                    <IconYoutube className='me-2 size-5 fill-white' /> Continue with YouTube
                  </>
                )}
              </Button>

              <Button
                variant='ghost'
                size='sm'
                onClick={() => handleAcquireCode(true)}
                disabled={isAuthorizing}
                className='w-full text-xs text-muted-foreground hover:text-foreground h-8'
              >
                Need to test without Google? Try Sandbox Demo Mode
              </Button>
            </div>

            {/* Collapsible Advanced Developer Settings */}
            <div className='border-t border-border/50 pt-2'>
              <button
                type='button'
                onClick={() => setShowAdvanced(!showAdvanced)}
                className='flex w-full items-center justify-between py-1 text-xs text-muted-foreground hover:text-foreground transition-colors'
              >
                <span className='flex items-center gap-1.5 font-medium'>
                  <Settings2 className='size-3.5' /> Advanced Developer Settings
                </span>
                <ChevronDown
                  className={`size-3.5 transition-transform duration-200 ${
                    showAdvanced ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showAdvanced && (
                <div className='mt-2 space-y-3 rounded-xl border border-border/60 bg-muted/25 p-3.5'>
                  <div className='flex items-center justify-between'>
                    <span className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>
                      Google Cloud OAuth 2.0 Credentials
                    </span>
                    <a
                      href='https://console.cloud.google.com/apis/credentials'
                      target='_blank'
                      rel='noreferrer'
                      className='flex items-center gap-1 text-[11px] text-red-600 hover:underline dark:text-red-400'
                    >
                      Google Cloud Console <ExternalLink className='size-3' />
                    </a>
                  </div>

                  <div className='space-y-3'>
                    <div>
                      <div className='mb-1 flex items-center justify-between'>
                        <label className='text-xs font-medium text-foreground'>
                          Google Client ID
                        </label>
                        {YOUTUBE_ENV_CONFIG.hasEnvClientId &&
                          inputClientId === YOUTUBE_ENV_CONFIG.envClientId && (
                            <span className='inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400'>
                              <Sparkles className='size-2.5' /> .env loaded
                            </span>
                          )}
                      </div>
                      <Input
                        placeholder='e.g. 1029384756-xyz.apps.googleusercontent.com'
                        value={inputClientId}
                        onChange={(e) => setInputClientId(e.target.value)}
                        className='h-8 bg-background/70 text-xs font-mono'
                      />
                    </div>

                    <div>
                      <div className='mb-1 flex items-center justify-between'>
                        <label className='text-xs font-medium text-foreground'>
                          Google Client Secret{' '}
                          <span className='text-muted-foreground font-normal'>
                            (for token exchange)
                          </span>
                        </label>
                        {YOUTUBE_ENV_CONFIG.hasEnvClientSecret &&
                          inputClientSecret === YOUTUBE_ENV_CONFIG.envClientSecret && (
                            <span className='inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400'>
                              <Sparkles className='size-2.5' /> .env loaded
                            </span>
                          )}
                      </div>
                      <div className='relative'>
                        <Input
                          type={showSecret ? 'text' : 'password'}
                          placeholder='e.g. GOCSPX-abcd1234...'
                          value={inputClientSecret}
                          onChange={(e) => setInputClientSecret(e.target.value)}
                          className='h-8 bg-background/70 pe-9 text-xs font-mono'
                        />
                        <button
                          type='button'
                          onClick={() => setShowSecret(!showSecret)}
                          className='absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                        >
                          {showSecret ? (
                            <EyeOff className='size-3.5' />
                          ) : (
                            <Eye className='size-3.5' />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className='mb-1 block text-xs font-medium text-foreground'>
                        Manual Authorization Code Entry (Optional)
                      </label>
                      <div className='flex gap-2'>
                        <Input
                          placeholder='Paste code from redirect or OAuth Playground (4/0Afge...)'
                          value={manualAuthCode}
                          onChange={(e) => setManualAuthCode(e.target.value)}
                          className='h-8 bg-background/70 text-xs font-mono'
                        />
                        <Button
                          size='sm'
                          variant='outline'
                          className='h-8 text-xs shrink-0'
                          onClick={() => {
                            if (manualAuthCode.trim()) {
                              setAuthCode(manualAuthCode.trim())
                              toast.success('Authorization Code set!')
                            } else {
                              toast.error('Please paste a valid authorization code.')
                            }
                          }}
                        >
                          Use Code
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : !isConnected && authCode ? (
          /* View 2: Code Acquired -> Ready to Exchange for Access & Refresh Tokens */
          <div className='space-y-4 pt-1'>
            <div className='rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <div className='flex size-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'>
                    <Check className='size-4 stroke-[3]' />
                  </div>
                  <div>
                    <h4 className='text-sm font-semibold'>Authorization Code Acquired</h4>
                    <p className='text-xs text-muted-foreground'>
                      Granted with <code className='text-[10px] text-emerald-600 dark:text-emerald-400 font-mono'>access_type=offline</code> for permanent refresh token.
                    </p>
                  </div>
                </div>
                <Badge
                  variant='outline'
                  className='border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px]'
                >
                  Step 2 of 2
                </Badge>
              </div>

              <div className='mt-3 flex items-center justify-between rounded-lg border border-border/60 bg-background/80 p-2.5'>
                <div className='flex items-center gap-2 font-mono text-xs text-foreground/80 truncate me-2'>
                  <Key className='size-3.5 text-muted-foreground shrink-0' />
                  <span className='truncate'>{authCode}</span>
                </div>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => handleCopy(authCode, 'code')}
                  className='h-7 px-2 text-xs shrink-0'
                >
                  {copiedToken === 'code' ? (
                    <Check className='size-3.5 text-emerald-600' />
                  ) : (
                    <Copy className='size-3.5' />
                  )}
                </Button>
              </div>
            </div>

            <div className='rounded-xl border border-border/60 bg-muted/20 p-3.5 text-xs text-muted-foreground'>
              <span className='font-medium text-foreground'>What happens next:</span>
              <ul className='mt-1.5 list-disc list-inside space-y-1 text-xs'>
                <li>Exchanges the code via <code className='font-mono text-[10px]'>oauth2.googleapis.com/token</code>.</li>
                <li>Receives a 1-hour <strong>Access Token</strong> for YouTube Data API v3 calls.</li>
                <li>Receives a permanent <strong>Refresh Token</strong> for automatic background renewals.</li>
              </ul>
            </div>

            <div className='flex gap-2 pt-1'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setAuthCode('')
                  setManualAuthCode('')
                }}
                disabled={isExchanging}
                className='text-xs'
              >
                Re-authorize
              </Button>
              <Button
                size='sm'
                onClick={handleExchangeTokens}
                disabled={isExchanging}
                className='flex-1 bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-500/25 text-xs h-9'
              >
                {isExchanging ? (
                  <>
                    <Loader2 className='me-2 size-3.5 animate-spin' /> Exchanging Code for Tokens...
                  </>
                ) : (
                  <>
                    <Key className='me-1.5 size-3.5' /> Exchange for Access & Refresh Tokens
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* View 3: Fully Connected -> Channel Details & Token Management */
          <div className='space-y-4 pt-1'>
            {/* Connected YouTube Channel Card */}
            <div className='rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] to-emerald-500/[0.02] p-4.5'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3.5'>
                  {connectedChannel?.avatarUrl ? (
                    <img
                      src={connectedChannel.avatarUrl}
                      alt={connectedChannel.title}
                      className='size-12 rounded-full border-2 border-white/50 object-cover shadow-sm'
                    />
                  ) : (
                    <div className='flex size-12 items-center justify-center rounded-full bg-red-600 text-white shadow-md shadow-red-500/25'>
                      <IconYoutube className='size-6 fill-white' />
                    </div>
                  )}
                  <div>
                    <div className='flex items-center gap-2'>
                      <h4 className='font-semibold text-sm text-foreground'>
                        {connectedChannel?.title}
                      </h4>
                      <Badge
                        variant='outline'
                        className='border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px]'
                      >
                        Active
                      </Badge>
                      {isDemoMode && (
                        <Badge variant='secondary' className='text-[10px]'>
                          Sandbox
                        </Badge>
                      )}
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      {connectedChannel?.customUrl} • ID: {connectedChannel?.id}
                    </p>
                  </div>
                </div>

                <Button
                  variant='ghost'
                  size='sm'
                  onClick={handleDisconnect}
                  className='text-xs text-destructive hover:bg-destructive/10 h-8 px-2.5'
                >
                  <Unplug className='me-1 size-3.5' /> Disconnect
                </Button>
              </div>

              {connectedChannel?.subscriberCount && (
                <div className='mt-3.5 grid grid-cols-3 gap-2 border-t border-emerald-500/20 pt-3 text-center'>
                  <div>
                    <div className='text-xs font-semibold text-foreground'>
                      {connectedChannel.subscriberCount}
                    </div>
                    <div className='text-[10px] text-muted-foreground'>Subscribers</div>
                  </div>
                  <div>
                    <div className='text-xs font-semibold text-foreground'>
                      {connectedChannel.videoCount || '0'}
                    </div>
                    <div className='text-[10px] text-muted-foreground'>Videos</div>
                  </div>
                  <div>
                    <div className='text-xs font-semibold text-foreground'>
                      {connectedChannel.viewCount || '0'}
                    </div>
                    <div className='text-[10px] text-muted-foreground'>Total Views</div>
                  </div>
                </div>
              )}
            </div>

            {/* Token Inspector Section */}
            <div className='space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4'>
              <span className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                Token Vault
              </span>

              {/* 1. Permanent Refresh Token */}
              <div className='rounded-lg border border-border/60 bg-background/80 p-3'>
                <div className='flex items-center justify-between mb-1.5'>
                  <div className='flex items-center gap-1.5'>
                    <span className='text-xs font-medium text-foreground'>
                      Refresh Token
                    </span>
                    <Badge
                      variant='outline'
                      className='border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[10px]'
                    >
                      Permanent Offline Access
                    </Badge>
                  </div>
                  <div className='flex items-center gap-1'>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => setShowRefreshToken(!showRefreshToken)}
                      className='size-7 p-0 text-muted-foreground hover:text-foreground'
                    >
                      {showRefreshToken ? (
                        <EyeOff className='size-3.5' />
                      ) : (
                        <Eye className='size-3.5' />
                      )}
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => handleCopy(refreshToken, 'refresh')}
                      className='size-7 p-0 text-muted-foreground hover:text-foreground'
                    >
                      {copiedToken === 'refresh' ? (
                        <Check className='size-3.5 text-emerald-600' />
                      ) : (
                        <Copy className='size-3.5' />
                      )}
                    </Button>
                  </div>
                </div>
                <div className='font-mono text-xs text-muted-foreground truncate'>
                  {showRefreshToken ? refreshToken : maskString(refreshToken)}
                </div>
              </div>

              {/* 2. Short-Lived Access Token */}
              <div className='rounded-lg border border-border/60 bg-background/80 p-3'>
                <div className='flex items-center justify-between mb-1.5'>
                  <div className='flex items-center gap-1.5'>
                    <span className='text-xs font-medium text-foreground'>
                      Access Token
                    </span>
                    <Badge variant='secondary' className='text-[10px]'>
                      Short-Lived (1 Hour)
                    </Badge>
                  </div>
                  <div className='flex items-center gap-1'>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => setShowAccessToken(!showAccessToken)}
                      className='size-7 p-0 text-muted-foreground hover:text-foreground'
                    >
                      {showAccessToken ? (
                        <EyeOff className='size-3.5' />
                      ) : (
                        <Eye className='size-3.5' />
                      )}
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => handleCopy(accessToken, 'access')}
                      className='size-7 p-0 text-muted-foreground hover:text-foreground'
                    >
                      {copiedToken === 'access' ? (
                        <Check className='size-3.5 text-emerald-600' />
                      ) : (
                        <Copy className='size-3.5' />
                      )}
                    </Button>
                  </div>
                </div>
                <div className='font-mono text-xs text-muted-foreground truncate'>
                  {showAccessToken ? accessToken : maskString(accessToken)}
                </div>
                {expiresAt && (
                  <div className='mt-1 text-[10px] text-muted-foreground'>
                    Expires: {new Date(expiresAt).toLocaleTimeString()} ({new Date(expiresAt).toLocaleDateString()})
                  </div>
                )}
              </div>

              {/* Refresh Action Trigger */}
              <Button
                variant='outline'
                size='sm'
                onClick={handleRefreshToken}
                disabled={isRefreshing}
                className='w-full text-xs h-8 border-dashed border-border/80'
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className='me-1.5 size-3.5 animate-spin' /> Refreshing Token...
                  </>
                ) : (
                  <>
                    <RefreshCw className='me-1.5 size-3.5' /> Refresh Access Token with Refresh Token
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

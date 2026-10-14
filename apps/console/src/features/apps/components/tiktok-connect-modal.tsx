import { useState } from 'react'
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Loader2,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Unplug,
} from 'lucide-react'
import { toast } from 'sonner'
import { IconTiktok } from '@unipost/ui/icons'
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
  buildTikTokOAuthUrl,
  exchangeAuthCodeForTokens,
  fetchTikTokProfile,
  refreshAccessToken,
  simulateDemoTokenExchange,
  simulateDemoTikTokAuthCode,
} from '../services/tiktok-service'
import { useTikTokStore, TIKTOK_ENV_CONFIG } from '../stores/tiktok-store'
import { springApiClient } from '@/features/spring-auth'

type TikTokConnectModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TikTokConnectModal({
  open,
  onOpenChange,
}: TikTokConnectModalProps) {
  const {
    isConnected,
    clientKey,
    clientSecret,
    authCode,
    accessToken,
    refreshToken,
    expiresAt,
    connectedProfile,
    isDemoMode,
    setAuthCode,
    setTokens,
    setConnectedProfile,
    setDemoMode,
    disconnect,
  } = useTikTokStore()

  // Local state
  const [showConfig, setShowConfig] = useState(false)
  const [customClientKey, setCustomClientKey] = useState(clientKey)
  const [customClientSecret, setCustomClientSecret] = useState(clientSecret)

  const [isProcessing, setIsProcessing] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const [showAccessToken, setShowAccessToken] = useState(false)
  const [showRefreshToken, setShowRefreshToken] = useState(false)
  const [copiedToken, setCopiedToken] = useState<'access' | 'refresh' | 'code' | null>(null)

  const activeClientKey = customClientKey || TIKTOK_ENV_CONFIG.clientKey
  const activeClientSecret = customClientSecret || TIKTOK_ENV_CONFIG.clientSecret

  // --- STAGE 1: Launch OAuth to get Authorization Code ---
  const handleLaunchOAuth = () => {
    if (!activeClientKey) {
      toast.error('Client Key missing. Please configure credentials.')
      return
    }
    // Launch standard TikTok consent screen
    const oauthUrl = buildTikTokOAuthUrl(
      activeClientKey,
      TIKTOK_ENV_CONFIG.redirectUri
    )
    // Normally we'd redirect the whole window. For this demo we'll show toast.
    toast.info('Would redirect to: ' + oauthUrl)
    // Simulating the user returning back to our redirect_uri with ?code=XYZ
    setTimeout(() => {
      setAuthCode('live_auth_code_simulated')
      setDemoMode(false)
      toast.success('Acquired Live Authorization Code')
    }, 1500)
  }

  const handleSandboxDemoAuth = () => {
    setDemoMode(true)
    setAuthCode(simulateDemoTikTokAuthCode())
    toast.success('Acquired Sandbox Demo Authorization Code')
  }

  // --- STAGE 2: Exchange Code for Tokens & Fetch Profile ---
  const handleExchangeTokens = async () => {
    if (!authCode) return
    setIsProcessing(true)

    try {
      if (isDemoMode) {
        // Unified Sandbox mode
        const res = await springApiClient.post<{
          success: boolean;
          accessToken: string;
          details: { profile: any };
        }>('/api/integrations/tiktok/exchange', {
          authCode,
        })
        const demoData = simulateDemoTokenExchange()
        setTokens(
          res.data.accessToken || demoData.tokens.accessToken,
          demoData.tokens.refreshToken,
          demoData.tokens.expiresAt
        )
        setConnectedProfile(res.data.details?.profile || demoData.profile)
        toast.success('Unified Sandbox token exchange successful')
      } else {
        // Live token exchange
        if (!activeClientSecret) {
          throw new Error('Client Secret missing for live exchange.')
        }
        const tokens = await exchangeAuthCodeForTokens(
          activeClientKey,
          activeClientSecret,
          authCode,
          TIKTOK_ENV_CONFIG.redirectUri
        )
        setTokens(tokens.accessToken, tokens.refreshToken, tokens.expiresAt)

        // Fetch Profile
        const profile = await fetchTikTokProfile(tokens.accessToken)
        setConnectedProfile(profile)
        toast.success('Successfully connected to TikTok Account')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Token exchange failed')
    } finally {
      setIsProcessing(false)
    }
  }

  // --- STAGE 3: Refresh Access Token ---
  const handleRefreshToken = async () => {
    if (!refreshToken) return
    setIsRefreshing(true)

    try {
      if (isDemoMode) {
        await new Promise((resolve) => setTimeout(resolve, 600))
        toast.success('Sandbox token successfully refreshed')
        // In sandbox, just extend expiry
        const newExpiry = new Date(Date.now() + 86400 * 1000).toISOString()
        setTokens(accessToken!, refreshToken, newExpiry)
      } else {
        if (!activeClientSecret) {
          throw new Error('Client Secret missing for live refresh.')
        }
        const newTokens = await refreshAccessToken(
          activeClientKey,
          activeClientSecret,
          refreshToken
        )
        setTokens(
          newTokens.accessToken,
          newTokens.refreshToken,
          newTokens.expiresAt
        )
        toast.success('Access Token refreshed')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to refresh token')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleDisconnect = () => {
    disconnect()
    toast.info('Disconnected from TikTok')
  }

  const handleCopy = (text: string | null, type: 'access' | 'refresh' | 'code') => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedToken(type)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const maskString = (str: string | null | undefined) => {
    if (!str) return ''
    if (str.length <= 10) return '•'.repeat(str.length)
    return `${str.substring(0, 4)}••••••••••••${str.substring(str.length - 4)}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-xl rounded-2xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/95'>
        <DialogHeader className='text-start'>
          <div className='flex items-center gap-3'>
            <div className='flex size-10 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-md shadow-zinc-900/20 dark:bg-zinc-100 dark:text-zinc-900 dark:shadow-white/20'>
              <IconTiktok className='size-6 fill-white dark:fill-zinc-900' />
            </div>
            <div>
              <DialogTitle className='text-lg font-semibold'>
                TikTok Profile Integration
              </DialogTitle>
              <DialogDescription className='text-xs text-muted-foreground'>
                {isConnected
                  ? 'Manage your TikTok Account connection and active OAuth tokens.'
                  : 'Authorize access to publish videos and view your TikTok profile stats.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* View 1: Not Connected & No Authorization Code yet -> Initiate Auth */}
        {!isConnected && !authCode ? (
          <div className='space-y-4 pt-1'>
            {/* Value Proposition */}
            <div className='rounded-2xl border border-white/20 bg-gradient-to-b from-zinc-500/[0.08] to-zinc-500/[0.02] p-5 shadow-xs backdrop-blur-md dark:border-white/10 dark:from-zinc-500/[0.12] dark:to-transparent'>
              <div className='flex items-start gap-3.5'>
                <div className='flex size-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-md shadow-zinc-900/25 dark:bg-zinc-100 dark:text-zinc-900'>
                  <IconTiktok className='size-[22px] fill-white dark:fill-zinc-900' />
                </div>
                <div className='space-y-1'>
                  <h3 className='text-sm font-semibold text-foreground'>
                    Connect your TikTok Profile
                  </h3>
                  <p className='text-xs text-muted-foreground leading-relaxed'>
                    Authorize Console to manage your TikTok videos, playlists, monitor video engagement, and sync channel statistics.
                  </p>
                </div>
              </div>

              <div className='mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2'>
                <div className='flex items-center gap-2 rounded-lg bg-background/60 p-2 text-xs text-foreground/90 backdrop-blur-xs border border-border/40'>
                  <IconTiktok className='size-3.5 text-zinc-900 dark:text-zinc-100 shrink-0 fill-current' />
                  <span className='font-medium text-[11px]'>Video Uploads</span>
                </div>
                <div className='flex items-center gap-2 rounded-lg bg-background/60 p-2 text-xs text-foreground/90 backdrop-blur-xs border border-border/40'>
                  <IconTiktok className='size-3.5 text-zinc-900 dark:text-zinc-100 shrink-0 fill-current' />
                  <span className='font-medium text-[11px]'>Analytics</span>
                </div>
              </div>
            </div>

            {/* Requested Scopes */}
            <div className='rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground'>
              <div className='flex flex-wrap items-center gap-2'>
                <ShieldCheck className='size-4 text-zinc-900 shrink-0 dark:text-zinc-100' />
                <span className='font-medium text-foreground text-[11px]'>
                  TikTok Scopes:
                </span>
                <code className='rounded bg-zinc-500/10 px-1.5 py-0.5 text-[10px] text-zinc-700 dark:text-zinc-300 font-mono'>
                  user.info.basic
                </code>
                <code className='rounded bg-zinc-500/10 px-1.5 py-0.5 text-[10px] text-zinc-700 dark:text-zinc-300 font-mono'>
                  video.list
                </code>
                <code className='rounded bg-zinc-500/10 px-1.5 py-0.5 text-[10px] text-zinc-700 dark:text-zinc-300 font-mono'>
                  video.upload
                </code>
              </div>
            </div>

            {/* Action Buttons */}
            <div className='space-y-2 pt-1'>
              <Button
                size='lg'
                onClick={handleLaunchOAuth}
                disabled={isProcessing}
                className='w-full bg-zinc-900 text-white hover:bg-zinc-800 shadow-md shadow-zinc-900/25 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-sm font-medium h-10 transition-all'
              >
                {isProcessing ? (
                  <>
                    <Loader2 className='me-2 size-4 animate-spin' /> Authorizing with TikTok...
                  </>
                ) : (
                  <>
                    <IconTiktok className='me-2 size-5 fill-white dark:fill-zinc-900' /> Continue with TikTok
                  </>
                )}
              </Button>

              <Button
                variant='ghost'
                size='sm'
                onClick={handleSandboxDemoAuth}
                disabled={isProcessing}
                className='w-full text-xs text-muted-foreground hover:text-foreground h-8'
              >
                Need to test without TikTok? Try Sandbox Demo Mode
              </Button>
            </div>

            {/* Collapsible Advanced Developer Settings */}
            <div className='border-t border-border/50 pt-2'>
              <button
                type='button'
                onClick={() => setShowConfig(!showConfig)}
                className='flex w-full items-center justify-between py-1 text-xs text-muted-foreground hover:text-foreground transition-colors'
              >
                <span className='flex items-center gap-1.5 font-medium'>
                  <Settings2 className='size-3.5' /> Advanced Developer Settings
                </span>
                <ChevronDown
                  className={`size-3.5 transition-transform duration-200 ${
                    showConfig ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showConfig && (
                <div className='mt-2 space-y-3 rounded-xl border border-border/60 bg-muted/25 p-3.5'>
                  <div className='flex items-center justify-between'>
                    <span className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>
                      TikTok Login Kit v2 Credentials
                    </span>
                    <a
                      href='https://developers.tiktok.com/apps'
                      target='_blank'
                      rel='noreferrer'
                      className='flex items-center gap-1 text-[11px] text-zinc-900 hover:underline dark:text-zinc-100'
                    >
                      Developer Portal <ExternalLink className='size-3' />
                    </a>
                  </div>

                  <div className='space-y-3'>
                    <div>
                      <label className='text-xs font-medium text-foreground mb-1 block'>
                        Client Key
                      </label>
                      <Input
                        placeholder='awX...'
                        value={customClientKey}
                        onChange={(e) => setCustomClientKey(e.target.value)}
                        className='h-8 bg-background/70 text-xs font-mono'
                      />
                    </div>

                    <div>
                      <label className='text-xs font-medium text-foreground mb-1 block'>
                        Client Secret
                      </label>
                      <Input
                        type='password'
                        placeholder='e.g. 1a2b3c...'
                        value={customClientSecret}
                        onChange={(e) => setCustomClientSecret(e.target.value)}
                        className='h-8 bg-background/70 text-xs font-mono'
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : !isConnected && authCode ? (
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
                      Ready to exchange for TikTok Access and Refresh tokens.
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
                <li>Exchanges the code via <code className='font-mono text-[10px]'>open.tiktokapis.com/v2/oauth/token/</code>.</li>
                <li>Receives a 24-hour <strong>Access Token</strong> for TikTok Login Kit calls.</li>
                <li>Receives a 1-year <strong>Refresh Token</strong> for automatic background renewals.</li>
              </ul>
            </div>

            <div className='flex gap-2 pt-1'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setAuthCode('')
                }}
                disabled={isProcessing}
                className='text-xs'
              >
                Re-authorize
              </Button>
              <Button
                size='sm'
                onClick={handleExchangeTokens}
                disabled={isProcessing}
                className='flex-1 bg-zinc-900 text-white hover:bg-zinc-800 shadow-md shadow-zinc-900/25 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-xs h-9'
              >
                {isProcessing ? (
                  <Loader2 className='size-4 animate-spin' />
                ) : (
                  <>
                    <IconTiktok className='me-1.5 size-4 fill-white dark:fill-zinc-900' /> Exchange Code
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className='flex flex-col gap-5 mt-2'>
            {/* Connected Profile Card */}
            <div className='rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 p-4 relative overflow-hidden'>
              <div className='flex justify-between items-start'>
                <div className='flex gap-3'>
                  {connectedProfile?.avatar_url ? (
                    <img 
                      src={connectedProfile.avatar_url} 
                      alt={connectedProfile.display_name} 
                      className='size-12 rounded-full border-2 border-emerald-500/30'
                    />
                  ) : (
                    <div className='size-12 rounded-full border-2 border-emerald-500/30 bg-emerald-500/20 flex items-center justify-center'>
                      <IconTiktok className='size-6' />
                    </div>
                  )}
                  <div>
                    <div className='flex items-center gap-2'>
                      <h4 className='font-semibold text-sm text-foreground'>
                        {connectedProfile?.display_name}
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
                      Union ID: {maskString(connectedProfile?.union_id)}
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
            </div>

            {/* Token Inspector Section */}
            <div className='space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4'>
              <span className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                Token Vault
              </span>

              {/* 1. Refresh Token */}
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
                      Long-Lived
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
                      Short-Lived (24 Hours)
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

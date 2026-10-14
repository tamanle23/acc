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
  Layers,
  Loader2,
  MessageSquareQuote,
  RefreshCw,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
  Unplug,
} from 'lucide-react'
import { toast } from 'sonner'
import { IconFacebook } from '@unipost/ui/icons'
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
  exchangeForLongLivedPageToken,
  fetchFacebookPages,
  loginWithFacebook,
  simulateDemoFacebookLogin,
  simulateDemoLongLivedExchange,
  type FacebookPage,
} from '../services/facebook-service'
import { FACEBOOK_ENV_CONFIG, useFacebookStore } from '../stores/facebook-store'
import { springApiClient } from '@/features/spring-auth'

type FacebookConnectModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FacebookConnectModal({
  open,
  onOpenChange,
}: FacebookConnectModalProps) {
  const {
    isConnected,
    appId,
    appSecret,
    userToken,
    connectedPage,
    availablePages,
    isDemoMode,
    setCredentials,
    setUserToken,
    setAvailablePages,
    setConnectedPage,
    setIsDemoMode,
    upgradeToLongLived,
    disconnect,
  } = useFacebookStore()

  const [inputAppId, setInputAppId] = useState(appId)
  const [inputAppSecret, setInputAppSecret] = useState(appSecret)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isExchanging, setIsExchanging] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setInputAppId(appId || FACEBOOK_ENV_CONFIG.envAppId)
      setInputAppSecret(appSecret || FACEBOOK_ENV_CONFIG.envAppSecret)
    }
    onOpenChange(newOpen)
  }

  // Step 1: Facebook Login & Fetch Pages
  const handleConnectFacebook = async (useSandbox: boolean) => {
    setIsLoggingIn(true)
    try {
      if (useSandbox) {
        setIsDemoMode(true)
        const res = await springApiClient.post<{
          success: boolean;
          accessToken: string;
          details: { pages: FacebookPage[] };
        }>('/api/integrations/facebook/exchange', {
          mode: 'login',
        })
        const mock = {
          userAccessToken: res.data.accessToken,
          pages: res.data.details?.pages || simulateDemoFacebookLogin().pages,
        }
        setUserToken(mock.userAccessToken)
        setAvailablePages(mock.pages)
        if (mock.pages.length > 0) {
          setConnectedPage(mock.pages[0])
        }
        toast.success('Connected via Unified Sandbox with 3 demo Facebook Pages!')
        return
      }

      const effectiveAppId = inputAppId.trim() || appId.trim()
      const effectiveAppSecret = inputAppSecret.trim() || appSecret.trim()

      if (!effectiveAppId) {
        setShowAdvanced(true)
        toast.error(
          'No Facebook App ID found. Please enter one in Advanced Settings below or configure VITE_FACEBOOK_APP_ID in .env.local.'
        )
        return
      }

      setCredentials(effectiveAppId, effectiveAppSecret)
      setIsDemoMode(false)

      const authResult = await loginWithFacebook(effectiveAppId)
      if (!authResult.success || !authResult.userAccessToken) {
        throw new Error(authResult.error || 'Facebook login was canceled.')
      }

      setUserToken(authResult.userAccessToken)

      // Fetch user's managed Facebook pages and their page tokens
      const pages = await fetchFacebookPages(authResult.userAccessToken)
      setAvailablePages(pages)

      if (pages.length === 0) {
        toast.warning(
          'Login successful, but no Facebook Pages were found under this account.'
        )
      } else {
        setConnectedPage(pages[0])
        toast.success(
          `Connected! Found ${pages.length} Facebook Page${pages.length > 1 ? 's' : ''
          }.`
        )
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to Facebook'
      toast.error(msg)
    } finally {
      setIsLoggingIn(false)
    }
  }

  // Step 2: Exchange for Long-Lived Token
  const handleExchangeLongLived = async () => {
    if (!connectedPage) return

    setIsExchanging(true)
    try {
      if (isDemoMode) {
        const res = await springApiClient.post<{
          success: boolean;
          accessToken: string;
        }>('/api/integrations/facebook/exchange', {
          mode: 'long-lived',
          pageId: connectedPage.id,
        })
        const mockToken = res.data.accessToken || simulateDemoLongLivedExchange(connectedPage.id).longLivedPageToken
        upgradeToLongLived(mockToken, null)
        toast.success(
          'Token successfully upgraded to Long-Lived (Never Expires) in Sandbox!'
        )
        return
      }

      if (!inputAppSecret.trim()) {
        toast.error(
          'Facebook App Secret is required by Meta Graph API to exchange for long-lived tokens.'
        )
        return
      }

      setCredentials(inputAppId.trim(), inputAppSecret.trim())

      const res = await exchangeForLongLivedPageToken({
        shortLivedUserToken: userToken,
        appId: inputAppId.trim(),
        appSecret: inputAppSecret.trim(),
        pageId: connectedPage.id,
      })

      upgradeToLongLived(res.longLivedPageToken, res.expiresAt)
      toast.success(
        'Page Access Token successfully exchanged for a permanent Long-Lived Token!'
      )
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to exchange long-lived token'
      toast.error(msg)
    } finally {
      setIsExchanging(false)
    }
  }

  const handleSelectPage = (page: FacebookPage) => {
    setConnectedPage(page)
    toast.info(`Switched active Facebook Page to "${page.name}"`)
  }

  const handleCopyToken = () => {
    if (!connectedPage?.accessToken) return
    navigator.clipboard.writeText(connectedPage.accessToken)
    setCopied(true)
    toast.success('Page Access Token copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDisconnect = () => {
    disconnect()
    toast.info('Disconnected from Facebook')
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-w-xl rounded-2xl border border-white/20 bg-white/90 p-6 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/90'>
        <DialogHeader className='text-start'>
          <div className='flex items-center gap-3'>

            <div>
              <DialogTitle className='text-lg font-semibold'>
                Facebook Page Integration
              </DialogTitle>
              <DialogDescription className='text-xs text-muted-foreground'>
                Acquire Facebook Page Access Tokens and exchange them for permanent
                long-lived tokens.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* View 1: Not Connected -> Setup & Login */}
        {!isConnected ? (
          <div className='space-y-4 pt-1'>
            {/* Value proposition & Feature Highlights */}
            <div className='rounded-2xl border border-white/20 bg-gradient-to-b from-blue-500/[0.08] to-blue-500/[0.02] p-5 shadow-xs backdrop-blur-md dark:border-white/10 dark:from-blue-500/[0.12] dark:to-transparent'>
              <div className='flex items-start gap-3.5'>
                <div className='flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/25'>
                  <IconFacebook className='size-6 fill-white' />
                </div>
                <div className='space-y-1'>
                  <h3 className='text-sm font-semibold text-foreground'>
                    Connect your Facebook Page
                  </h3>
                  <p className='text-xs text-muted-foreground leading-relaxed'>
                    Authorize Console to manage your Facebook Page, schedule and publish content, monitor interactions, and sync Page analytics.
                  </p>
                </div>
              </div>

              <div className='mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3'>
                <div className='flex items-center gap-2 rounded-lg bg-background/60 p-2 text-xs text-foreground/90 backdrop-blur-xs border border-border/40'>
                  <Share2 className='size-3.5 text-blue-600 dark:text-blue-400 shrink-0' />
                  <span className='font-medium text-[11px]'>Auto Publishing</span>
                </div>
                <div className='flex items-center gap-2 rounded-lg bg-background/60 p-2 text-xs text-foreground/90 backdrop-blur-xs border border-border/40'>
                  <MessageSquareQuote className='size-3.5 text-blue-600 dark:text-blue-400 shrink-0' />
                  <span className='font-medium text-[11px]'>Comment Sync</span>
                </div>
                <div className='flex items-center gap-2 rounded-lg bg-background/60 p-2 text-xs text-foreground/90 backdrop-blur-xs border border-border/40'>
                  <BarChart3 className='size-3.5 text-blue-600 dark:text-blue-400 shrink-0' />
                  <span className='font-medium text-[11px]'>Page Insights</span>
                </div>
              </div>
            </div>

            {/* Requested Permissions */}
            <div className='rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground'>
              <div className='flex flex-wrap items-center gap-2'>
                <ShieldCheck className='size-4 text-blue-600 shrink-0 dark:text-blue-400' />
                <span className='font-medium text-foreground text-[11px]'>
                  Permissions:
                </span>
                <code className='rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-700 dark:text-blue-300 font-mono'>
                  pages_show_list
                </code>
                <code className='rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-700 dark:text-blue-300 font-mono'>
                  pages_read_engagement
                </code>
                <code className='rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-700 dark:text-blue-300 font-mono'>
                  pages_manage_posts
                </code>
              </div>
            </div>

            {/* Action Buttons: Primary 1-Click Connect + Sandbox Demo */}
            <div className='space-y-2 pt-1'>
              <Button
                size='lg'
                onClick={() => handleConnectFacebook(false)}
                disabled={isLoggingIn}
                className='w-full bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/25 text-sm font-medium h-10 transition-all'
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className='me-2 size-4 animate-spin' /> Connecting Facebook...
                  </>
                ) : (
                  <>
                    <IconFacebook className='me-2 size-4 fill-white' /> Continue with Facebook
                  </>
                )}
              </Button>

              <Button
                variant='ghost'
                size='sm'
                onClick={() => handleConnectFacebook(true)}
                disabled={isLoggingIn}
                className='w-full text-xs text-muted-foreground hover:text-foreground h-8'
              >
                Need to test without Facebook? Try Sandbox Demo Mode
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
                  className={`size-3.5 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''
                    }`}
                />
              </button>

              {showAdvanced && (
                <div className='mt-2 space-y-3 rounded-xl border border-border/60 bg-muted/25 p-3.5'>
                  <div className='flex items-center justify-between'>
                    <span className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>
                      Meta App Credentials
                    </span>
                    <a
                      href='https://developers.facebook.com/apps/'
                      target='_blank'
                      rel='noreferrer'
                      className='flex items-center gap-1 text-[11px] text-blue-600 hover:underline dark:text-blue-400'
                    >
                      Meta Developer Portal <ExternalLink className='size-3' />
                    </a>
                  </div>

                  <div className='space-y-3'>
                    <div>
                      <div className='mb-1 flex items-center justify-between'>
                        <label className='text-xs font-medium text-foreground'>
                          Facebook App ID
                        </label>
                        {FACEBOOK_ENV_CONFIG.hasEnvAppId &&
                          inputAppId === FACEBOOK_ENV_CONFIG.envAppId && (
                            <span className='inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400'>
                              <Sparkles className='size-2.5' /> .env loaded
                            </span>
                          )}
                      </div>
                      <Input
                        placeholder='e.g. 102938475610293'
                        value={inputAppId}
                        onChange={(e) => setInputAppId(e.target.value)}
                        className='h-8 bg-background/70 text-xs'
                      />
                    </div>

                    <div>
                      <div className='mb-1 flex items-center justify-between'>
                        <label className='text-xs font-medium text-foreground'>
                          Facebook App Secret{' '}
                          <span className='text-muted-foreground font-normal'>
                            (for long-lived exchange)
                          </span>
                        </label>
                        {FACEBOOK_ENV_CONFIG.hasEnvAppSecret &&
                          inputAppSecret === FACEBOOK_ENV_CONFIG.envAppSecret && (
                            <span className='inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400'>
                              <Sparkles className='size-2.5' /> .env loaded
                            </span>
                          )}
                      </div>
                      <div className='relative'>
                        <Input
                          type={showSecret ? 'text' : 'password'}
                          placeholder='e.g. abcd1234ef567890...'
                          value={inputAppSecret}
                          onChange={(e) => setInputAppSecret(e.target.value)}
                          className='h-8 bg-background/70 pe-9 text-xs'
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
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* View 2: Connected -> Active Page & Token Exchange */
          <div className='space-y-4 pt-1'>
            {/* Active Connected Page Summary */}
            <div className='rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='flex size-10 items-center justify-center rounded-xl bg-blue-600/15 text-blue-600 dark:text-blue-400'>
                    <IconFacebook className='size-6 fill-white text-white' />
                  </div>
                  <div>
                    <div className='flex items-center gap-2'>
                      <h4 className='font-semibold text-sm'>
                        {connectedPage?.name}
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
                      {connectedPage?.category} • ID: {connectedPage?.id}
                    </p>
                  </div>
                </div>

                <Button
                  variant='ghost'
                  size='sm'
                  onClick={handleDisconnect}
                  className='text-xs text-destructive hover:bg-destructive/10'
                >
                  <Unplug className='me-1.5 size-3.5' /> Disconnect
                </Button>
              </div>
            </div>

            {/* Token Info & Long-Lived Status */}
            <div className='rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <Key className='size-4 text-muted-foreground' />
                  <span className='text-xs font-semibold'>Page Access Token</span>
                </div>

                {connectedPage?.isLongLived ? (
                  <Badge className='bg-emerald-600 text-white hover:bg-emerald-600 text-[10px]'>
                    <Check className='me-1 size-3' /> Long-Lived (Never Expires)
                  </Badge>
                ) : (
                  <Badge
                    variant='outline'
                    className='border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px]'
                  >
                    Short-Lived (~1-2 hrs)
                  </Badge>
                )}
              </div>

              {/* Token String Display with Masking & Copy */}
              <div className='flex items-center gap-2'>
                <div className='relative flex-1'>
                  <Input
                    readOnly
                    type={showToken ? 'text' : 'password'}
                    value={connectedPage?.accessToken || ''}
                    className='h-8 bg-background/80 font-mono text-[11px]'
                  />
                </div>
                <Button
                  variant='outline'
                  size='icon'
                  className='size-8 shrink-0'
                  onClick={() => setShowToken(!showToken)}
                  title={showToken ? 'Hide token' : 'Show token'}
                >
                  {showToken ? (
                    <EyeOff className='size-3.5' />
                  ) : (
                    <Eye className='size-3.5' />
                  )}
                </Button>
                <Button
                  variant='outline'
                  size='icon'
                  className='size-8 shrink-0'
                  onClick={handleCopyToken}
                  title='Copy Token'
                >
                  {copied ? (
                    <Check className='size-3.5 text-emerald-600' />
                  ) : (
                    <Copy className='size-3.5' />
                  )}
                </Button>
              </div>

              {/* Long Lived Token Exchange Section */}
              {!connectedPage?.isLongLived && (
                <div className='rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs space-y-2'>
                  <p className='text-muted-foreground text-[11px] leading-relaxed'>
                    This Page token is currently <strong>short-lived</strong>. In
                    production, exchange it via Facebook OAuth endpoint for a{' '}
                    <strong>Long-Lived Page Access Token</strong> that will never
                    expire.
                  </p>

                  {!isDemoMode && !inputAppSecret.trim() && (
                    <div className='pt-1'>
                      <Input
                        type='password'
                        placeholder='Enter Facebook App Secret to exchange...'
                        value={inputAppSecret}
                        onChange={(e) => setInputAppSecret(e.target.value)}
                        className='h-8 bg-background text-xs'
                      />
                    </div>
                  )}

                  <Button
                    size='sm'
                    onClick={handleExchangeLongLived}
                    disabled={isExchanging}
                    className='w-full bg-blue-600 text-white hover:bg-blue-700 text-xs shadow-xs'
                  >
                    {isExchanging ? (
                      <>
                        <Loader2 className='me-1.5 size-3.5 animate-spin' />{' '}
                        Exchanging Token...
                      </>
                    ) : (
                      <>
                        <RefreshCw className='me-1.5 size-3.5' /> Exchange for
                        Long-Lived Token
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Switch Managed Pages */}
            {availablePages.length > 1 && (
              <div className='rounded-xl border border-border/60 bg-muted/20 p-4'>
                <div className='mb-2 flex items-center gap-2'>
                  <Layers className='size-4 text-muted-foreground' />
                  <span className='text-xs font-semibold'>
                    Available Pages ({availablePages.length})
                  </span>
                </div>

                <div className='space-y-1.5 max-h-36 overflow-y-auto no-scrollbar'>
                  {availablePages.map((page) => {
                    const isSelected = page.id === connectedPage?.id
                    return (
                      <div
                        key={page.id}
                        onClick={() => handleSelectPage(page)}
                        className={`flex items-center justify-between rounded-lg p-2 text-xs transition-colors cursor-pointer border ${isSelected
                          ? 'border-blue-500/40 bg-blue-500/10 font-medium'
                          : 'border-transparent hover:bg-muted/60'
                          }`}
                      >
                        <div className='flex items-center gap-2'>
                          <span>{page.name}</span>
                          <span className='text-[10px] text-muted-foreground'>
                            ({page.category})
                          </span>
                        </div>
                        {isSelected && (
                          <Check className='size-3.5 text-blue-600 dark:text-blue-400' />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

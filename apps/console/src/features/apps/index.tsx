import { type ChangeEvent, useState, useMemo } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { SlidersHorizontal, ArrowUpAZ, ArrowDownAZ, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { NotificationDropdown } from '@/features/notifications'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { LanguageSwitch } from '@/components/language-switch'
import { toast } from 'sonner'
import { FacebookConnectModal } from './components/facebook-connect-modal'
import { TikTokConnectModal } from './components/tiktok-connect-modal'
import { YouTubeConnectModal } from './components/youtube-connect-modal'
import { apps } from './data/apps'
import { useFacebookStore } from './stores/facebook-store'
import { useTikTokStore } from './stores/tiktok-store'
import { useYouTubeStore } from './stores/youtube-store'

const route = getRouteApi('/_authenticated/apps/')

type AppType = 'all' | 'connected' | 'notConnected'

const appText = new Map<AppType, string>([
  ['all', 'All Apps'],
  ['connected', 'Connected'],
  ['notConnected', 'Not Connected'],
])

export function Apps() {
  const {
    filter = '',
    type = 'all',
    sort: initSort = 'asc',
  } = route.useSearch()
  const navigate = route.useNavigate()

  const [facebookModalOpen, setFacebookModalOpen] = useState(false)
  const { isConnected: isFacebookConnected, connectedPage } = useFacebookStore()

  const [tiktokModalOpen, setTikTokModalOpen] = useState(false)
  const { isConnected: isTikTokConnected, connectedProfile } = useTikTokStore()

  const [youtubeModalOpen, setYouTubeModalOpen] = useState(false)
  const { isConnected: isYouTubeConnected, connectedChannel } = useYouTubeStore()

  const [sort, setSort] = useState(initSort)
  const [appType, setAppType] = useState(type)
  const [searchTerm, setSearchTerm] = useState(filter)

  // Optimization: Memoize dynamic app mapping, sorting, and multi-stage filtering
  // to avoid re-evaluating array operations, string comparisons, and object cloning on every render.
  const filteredApps = useMemo(() => {
    const dynamicApps = apps.map((app) => {
      if (app.name === 'Facebook') {
        return {
          ...app,
          connected: isFacebookConnected,
          desc:
            isFacebookConnected && connectedPage
              ? `Connected to Page: "${connectedPage.name}" (${
                  connectedPage.isLongLived
                    ? 'Permanent Long-Lived Token'
                    : 'Short-Lived Token'
                })`
              : app.desc,
        }
      }
      if (app.name === 'Tiktok') {
        return {
          ...app,
          connected: isTikTokConnected,
          desc:
            isTikTokConnected && connectedProfile
              ? `Connected to Profile: "${connectedProfile.display_name}"`
              : app.desc,
        }
      }
      if (app.name === 'Youtube') {
        return {
          ...app,
          connected: isYouTubeConnected,
          desc:
            isYouTubeConnected && connectedChannel
              ? `Connected to Channel: "${connectedChannel.title}" (Has Refresh Token)`
              : app.desc,
        }
      }
      return app
    })

    return dynamicApps
      .slice()
      .sort((a, b) =>
        sort === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name)
      )
      .filter((app) =>
        appType === 'connected'
          ? app.connected
          : appType === 'notConnected'
            ? !app.connected
            : true
      )
      .filter((app) => app.name.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [
    isFacebookConnected,
    connectedPage,
    isTikTokConnected,
    connectedProfile,
    isYouTubeConnected,
    connectedChannel,
    sort,
    appType,
    searchTerm,
  ])

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    navigate({
      search: (prev) => ({
        ...prev,
        filter: e.target.value || undefined,
      }),
    })
  }

  const handleTypeChange = (value: AppType) => {
    setAppType(value)
    navigate({
      search: (prev) => ({
        ...prev,
        type: value === 'all' ? undefined : value,
      }),
    })
  }

  const handleSortChange = (sort: 'asc' | 'desc') => {
    setSort(sort)
    navigate({ search: (prev) => ({ ...prev, sort }) })
  }

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <Search />
        <div className='ms-auto flex items-center gap-4'>
          <NotificationDropdown />
          <LanguageSwitch />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      {/* ===== Content ===== */}
      <Main fixed>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            App Integrations
          </h1>
          <p className='text-muted-foreground'>
            Here&apos;s a list of your apps for the integration!
          </p>
        </div>
        <div className='my-4 flex items-end justify-between sm:my-0 sm:items-center'>
          <div className='flex flex-col gap-4 sm:my-4 sm:flex-row'>
            <Input
              placeholder='Filter apps...'
              className='h-9 w-40 lg:w-[250px]'
              value={searchTerm}
              onChange={handleSearch}
            />
            <Select value={appType} onValueChange={handleTypeChange}>
              <SelectTrigger className='w-36'>
                <SelectValue>{appText.get(appType)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Apps</SelectItem>
                <SelectItem value='connected'>Connected</SelectItem>
                <SelectItem value='notConnected'>Not Connected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Select value={sort} onValueChange={handleSortChange}>
            <SelectTrigger className='w-16'>
              <SelectValue>
                <SlidersHorizontal size={18} />
              </SelectValue>
            </SelectTrigger>
            <SelectContent align='end'>
              <SelectItem value='asc'>
                <div className='flex items-center gap-4'>
                  <ArrowUpAZ size={16} />
                  <span>Ascending</span>
                </div>
              </SelectItem>
              <SelectItem value='desc'>
                <div className='flex items-center gap-4'>
                  <ArrowDownAZ size={16} />
                  <span>Descending</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Separator className='shadow-sm' />
        <ul className='faded-bottom no-scrollbar grid gap-4 overflow-auto pt-4 pb-16 md:grid-cols-2 lg:grid-cols-3'>
          {filteredApps.map((app) => (
            <li key={app.name} className='flex'>
              <Card className='flex w-full flex-col justify-between gap-4 p-5'>
                <div className='flex items-center justify-between'>
                  <div
                    className='flex size-11 items-center justify-center rounded-xl bg-white/40 dark:bg-white/10 border border-white/30 dark:border-white/10 backdrop-blur-md p-2 shadow-xs'
                  >
                    {app.logo}
                  </div>
                  <div className='flex items-center gap-2'>
                    {app.connected ? (
                      <>
                        <Button
                          variant='outline'
                          size='sm'
                          className='liquid-glass-interactive h-8 text-xs'
                          onClick={() => {
                            if (app.name === 'Facebook') {
                              setFacebookModalOpen(true)
                            } else if (app.name === 'Tiktok') {
                              setTikTokModalOpen(true)
                            } else if (app.name === 'Youtube') {
                              setYouTubeModalOpen(true)
                            } else if (app.name === 'Internal Blog') {
                              toast.info('Internal Blog is active and managed by the system.')
                            }
                          }}
                        >
                          Manage
                        </Button>
                        <Button
                          variant='outline'
                          size='sm'
                          disabled
                          className='h-8 border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-medium shadow-xs disabled:opacity-100'
                        >
                          <Check className='me-1 size-3.5 stroke-[2.5]' />
                          Connected
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant='outline'
                        size='sm'
                        className='liquid-glass-interactive h-8 text-xs'
                        onClick={() => {
                          if (app.name === 'Facebook') {
                            setFacebookModalOpen(true)
                          } else if (app.name === 'Tiktok') {
                            setTikTokModalOpen(true)
                          } else if (app.name === 'Youtube') {
                            setYouTubeModalOpen(true)
                          }
                        }}
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <div className='mb-1 flex items-center gap-2'>
                    <h2 className='font-semibold tracking-tight text-card-foreground'>{app.name}</h2>
                    {app.name === 'Internal Blog' && (
                      <span className='rounded-md border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300'>
                        System Default
                      </span>
                    )}
                  </div>
                  <p className='line-clamp-2 text-sm text-muted-foreground'>{app.desc}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </Main>

      <FacebookConnectModal
        open={facebookModalOpen}
        onOpenChange={setFacebookModalOpen}
      />
      <TikTokConnectModal
        open={tiktokModalOpen}
        onOpenChange={setTikTokModalOpen}
      />
      <YouTubeConnectModal
        open={youtubeModalOpen}
        onOpenChange={setYouTubeModalOpen}
      />
    </>
  )
}

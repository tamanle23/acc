import { type ChangeEvent, useState, useMemo } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { SlidersHorizontal, ArrowUpAZ, ArrowDownAZ } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { LanguageSwitch } from '@/components/language-switch'
import { StorageManageDialog } from './storage-manage-dialog'
import { StorageAssignmentsDialog } from './storage-assignments-dialog'
import { AddStorageDialog } from './add-storage-dialog'
import { storages, type StorageProvider } from './data/storages'

const route = getRouteApi('/_authenticated/storage/')

type FilterType = 'all' | 'Archive' | 'CDN'

export function StorageIntegration() {
  const { t } = useTranslation('console')
  const {
    filter = '',
    type = 'all',
    sort: initSort = 'asc',
  } = route.useSearch()
  const navigate = route.useNavigate()

  const [sort, setSort] = useState(initSort)
  const [filterType, setFilterType] = useState<FilterType>(type as FilterType)
  const [searchTerm, setSearchTerm] = useState(filter)
  const [manageDialog, setManageDialog] = useState<{ open: boolean; provider: StorageProvider | null }>({ open: false, provider: null })
  const [assignmentsDialog, setAssignmentsDialog] = useState<{ open: boolean; provider: StorageProvider | null }>({ open: false, provider: null })
  const [addDialog, setAddDialog] = useState(false)
  const [storageList, setStorageList] = useState<StorageProvider[]>(storages)

  const filterText: Record<FilterType, string> = {
    all: t('storage.modes.all', 'All Modes'),
    Archive: t('storage.modes.archive', 'Archive'),
    CDN: t('storage.modes.cdn', 'CDN'),
  }

  const getStorageWeight = (storage: StorageProvider) => {
    if (storage.providerType === 'System Internal') return 0;
    if (storage.lifecycleStatus === 'Draft') return 2;
    return 1; // User Provided (Live)
  }

  // Optimization: Memoize filtered and sorted storage providers to prevent in-place array mutation (`storageList.sort`)
  // and avoid redundant re-sorting/filtering operations on every render pass.
  const filteredStorages = useMemo(() => {
    return [...storageList]
      .sort((a, b) => {
        const weightA = getStorageWeight(a)
        const weightB = getStorageWeight(b)

        if (weightA !== weightB) {
          return weightA - weightB
        }

        // Secondary sort: Provider Name
        return sort === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name)
      })
      .filter((storage) =>
        filterType === 'all' ? true : storage.storageMode === filterType
      )
      .filter((storage) => {
        const localizedDesc = t(storage.descKey, storage.defaultDesc)
        return (
          storage.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          localizedDesc.toLowerCase().includes(searchTerm.toLowerCase())
        )
      })
  }, [storageList, sort, filterType, searchTerm, t])

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    navigate({
      search: (prev) => ({
        ...prev,
        filter: e.target.value || undefined,
      }),
    })
  }

  const handleTypeChange = (value: FilterType) => {
    setFilterType(value)
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

  const handleAddStorage = (newStorage: StorageProvider) => {
    setStorageList((prev) => [newStorage, ...prev])
  }

  const handleUpdateStorage = (updatedStorage: StorageProvider) => {
    setStorageList((prev) =>
      prev.map((s) => (s.id === updatedStorage.id ? updatedStorage : s))
    )
  }

  return (
    <>
      <Header>
        <Search />
        <div className='ms-auto flex items-center gap-4'>
          <LanguageSwitch />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main fixed>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            {t('storage.title', 'Storage Providers')}
          </h1>
          <p className='text-muted-foreground'>
            {t(
              'storage.description',
              'Manage your Cloud Storage services for @unipost/backend file uploads!'
            )}
          </p>
        </div>
        <div className='my-4 flex items-end justify-between sm:my-0 sm:items-center'>
          <div className='flex flex-col gap-4 sm:my-4 sm:flex-row'>
            <Input
              placeholder={t(
                'storage.filterPlaceholder',
                'Filter storage providers...'
              )}
              className='h-9 w-40 lg:w-[250px]'
              value={searchTerm}
              onChange={handleSearch}
            />
            <Select value={filterType} onValueChange={handleTypeChange}>
              <SelectTrigger className='w-44'>
                <SelectValue>{filterText[filterType]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>
                  {t('storage.modes.all', 'All Modes')}
                </SelectItem>
                <SelectItem value='Archive'>
                  {t('storage.modes.archive', 'Archive')}
                </SelectItem>
                <SelectItem value='CDN'>
                  {t('storage.modes.cdn', 'CDN')}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setAddDialog(true)} className='h-9'>
              {t('storage.actions.addProvider', 'Add Provider')}
            </Button>
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
                  <span>{t('storage.sort.ascending', 'Ascending')}</span>
                </div>
              </SelectItem>
              <SelectItem value='desc'>
                <div className='flex items-center gap-4'>
                  <ArrowDownAZ size={16} />
                  <span>{t('storage.sort.descending', 'Descending')}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Separator className='shadow-sm' />
        <ul className='faded-bottom no-scrollbar grid gap-4 overflow-auto pt-4 pb-16 md:grid-cols-2 lg:grid-cols-3'>
          {filteredStorages.map((storage) => {
            const modeLabel =
              storage.storageMode === 'CDN'
                ? t('storage.modes.cdn', 'CDN')
                : t('storage.modes.archive', 'Archive')
            const description = t(storage.descKey, storage.defaultDesc)

            return (
              <li key={storage.id} className='flex'>
                <Card className='flex w-full flex-col justify-between gap-4 p-5 bg-white/65 dark:bg-slate-900/65 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/30 rounded-2xl'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                      <div
                        className='flex size-11 items-center justify-center rounded-xl bg-white/40 dark:bg-white/10 border border-white/30 dark:border-white/10 backdrop-blur-md p-2 shadow-xs'
                      >
                        {storage.logo}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                          storage.lifecycleStatus === 'Live'
                            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]'
                            : 'border-orange-500/40 bg-orange-500/15 text-orange-700 dark:text-orange-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]'
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full animate-pulse ${
                            storage.lifecycleStatus === 'Live'
                              ? 'bg-emerald-500 dark:bg-emerald-400'
                              : 'bg-orange-500 dark:bg-orange-400'
                          }`}
                        />
                        {storage.lifecycleStatus === 'Live' ? t('storage.lifecycle.live', 'Live') : t('storage.lifecycle.draft', 'Draft')}
                      </span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        className='liquid-glass-interactive h-8 text-xs relative overflow-hidden bg-white/20 hover:bg-white/30 dark:bg-white/10 dark:hover:bg-white/15 border border-white/30 dark:border-white/15 backdrop-blur-md text-foreground shadow-sm transition-all duration-200 active:scale-95'
                        onClick={() => setManageDialog({ open: true, provider: storage })}
                      >
                        {t('storage.actions.manage', 'Manage')}
                      </Button>
                      {storage.lifecycleStatus !== 'Draft' && (
                        <Button
                          variant='outline'
                          size='sm'
                          className='liquid-glass-interactive h-8 text-xs relative overflow-hidden bg-white/20 hover:bg-white/30 dark:bg-white/10 dark:hover:bg-white/15 border border-white/30 dark:border-white/15 backdrop-blur-md text-foreground shadow-sm transition-all duration-200 active:scale-95'
                          onClick={() => setAssignmentsDialog({ open: true, provider: storage })}
                        >
                          {t('storage.actions.assignments', 'Assignments')}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className='mb-1 flex flex-wrap items-center gap-2'>
                      <h2 className='font-semibold tracking-tight text-card-foreground'>
                        {storage.name}
                      </h2>
                      <span
                        className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                          storage.storageMode === 'CDN'
                            ? 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300'
                            : 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                        }`}
                      >
                        {modeLabel}
                      </span>
                      <span
                        className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                          storage.providerType === 'System Internal'
                            ? 'border-gray-500/30 bg-gray-500/10 text-gray-700 dark:text-gray-300'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {storage.providerType === 'System Internal' ? t('storage.types.system', 'System Internal') : t('storage.types.user', 'User Provided')}
                      </span>
                    </div>
                    <p className='line-clamp-2 text-sm text-muted-foreground'>
                      {description}
                    </p>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
        <StorageManageDialog
          open={manageDialog.open}
          onOpenChange={(open) => setManageDialog((prev) => ({ ...prev, open }))}
          provider={manageDialog.provider}
          onUpdateProvider={handleUpdateStorage}
        />
        <StorageAssignmentsDialog
          open={assignmentsDialog.open}
          onOpenChange={(open) => setAssignmentsDialog((prev) => ({ ...prev, open }))}
          provider={assignmentsDialog.provider}
          onUpdateProvider={handleUpdateStorage}
        />
        <AddStorageDialog
          open={addDialog}
          onOpenChange={setAddDialog}
          onAddProvider={handleAddStorage}
        />
      </Main>
    </>
  )
}

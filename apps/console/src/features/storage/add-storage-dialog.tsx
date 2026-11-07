import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AuthorizedButton } from '@/components/auth'
import { predefinedProviderTemplates, type StorageProvider } from './data/storages'

interface AddStorageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddProvider: (provider: StorageProvider) => void
}

export function AddStorageDialog({
  open,
  onOpenChange,
  onAddProvider,
}: AddStorageDialogProps) {
  const { t } = useTranslation('console')

  const handleSelectTemplate = (template: typeof predefinedProviderTemplates[0]) => {
    const newStorage: StorageProvider = {
      ...template,
      // eslint-disable-next-line react-hooks/purity
      id: `${template.id}-${Date.now()}`,
      lifecycleStatus: 'Draft',
      assignedWorkspaces: [],
      status: 'disabled',
    }
    onAddProvider(newStorage)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[600px] bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-xl shadow-black/10'>
        <DialogHeader>
          <DialogTitle>
            {t('storage.add.title', 'Add Storage Provider')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'storage.add.description',
              'Select a provider template to instantiate a new storage resource.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-4 py-4 md:grid-cols-2'>
          {predefinedProviderTemplates.map((template) => (
            <div
              key={template.id}
              className='flex flex-col gap-3 rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-800/40 p-4 shadow-sm backdrop-blur-md'
            >
              <div className='flex items-center gap-3'>
                <div className='flex size-10 items-center justify-center rounded-lg bg-white/60 dark:bg-white/10 shadow-xs'>
                  {template.logo}
                </div>
                <h3 className='font-semibold'>{template.name}</h3>
              </div>
              <p className='text-xs text-muted-foreground line-clamp-2 flex-1'>
                {t(template.descKey, template.defaultDesc)}
              </p>
              <AuthorizedButton
                permission='workspace:settings:manage'
                variant='outline'
                className='mt-2 w-full bg-white/50 hover:bg-white/70 dark:bg-white/10 dark:hover:bg-white/20'
                onClick={() => handleSelectTemplate(template)}
              >
                <Plus className='mr-2 size-4' />
                {t('storage.actions.addProvider', 'Add Provider')}
              </AuthorizedButton>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

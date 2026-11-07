import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AuthorizedButton } from '@/components/auth'
import { Input } from '@/components/ui/input'
import type { StorageProvider } from './data/storages'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'

interface StorageManageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: StorageProvider | null
  onUpdateProvider?: (provider: StorageProvider) => void
}

export function StorageManageDialog({
  open,
  onOpenChange,
  provider,
  onUpdateProvider,
}: StorageManageDialogProps) {
  const { t } = useTranslation('console')
  const [isTesting, setIsTesting] = useState(false)

  if (!provider) return null

  const handleTestConnection = () => {
    setIsTesting(true)
    setTimeout(() => {
      setIsTesting(false)
      toast.success(t('storage.toasts.connectionSuccess', 'Connection successful!'))
      if (provider.lifecycleStatus === 'Draft' && onUpdateProvider) {
        onUpdateProvider({ ...provider, lifecycleStatus: 'Live' })
      }
    }, 1000)
  }

  const handleSave = () => {
    toast.success(t('storage.toasts.saved', 'Settings saved successfully'))
    onOpenChange(false)
  }

  const renderProviderFields = () => {
    const nameLower = provider.name.toLowerCase()
    const idLower = provider.id.toLowerCase()

    if (idLower.includes('r2') || nameLower.includes('r2')) {
      return (
        <>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='accountId' className='text-right text-xs font-medium'>
              Account ID
            </Label>
            <Input
              id='accountId'
              placeholder='e.g. 1a2b3c4d5e6f...'
              defaultValue='f5d72a9108b3c4d5e6f7a8b9c0d1e2f3'
              className='col-span-3 h-8 text-xs'
            />
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='endpoint' className='text-right text-xs font-medium'>
              Endpoint
            </Label>
            <Input
              id='endpoint'
              value='https://<ACCOUNT_ID>.r2.cloudflarestorage.com'
              readOnly
              className='col-span-3 h-8 text-xs bg-muted/50 text-muted-foreground font-mono'
            />
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='bucketName' className='text-right text-xs font-medium'>
              Bucket
            </Label>
            <Input
              id='bucketName'
              placeholder='my-r2-bucket'
              defaultValue='production-assets'
              className='col-span-3 h-8 text-xs'
            />
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='region' className='text-right text-xs font-medium'>
              Region
            </Label>
            <Input
              id='region'
              defaultValue='auto'
              className='col-span-3 h-8 text-xs'
            />
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='accessKeyId' className='text-right text-xs font-medium'>
              Access Key ID
            </Label>
            <Input
              id='accessKeyId'
              placeholder='<YOUR_ACCESS_KEY_ID>'
              defaultValue='AKIAIOSFODNN7EXAMPLE'
              className='col-span-3 h-8 text-xs'
            />
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='secretKey' className='text-right text-xs font-medium'>
              Secret Key
            </Label>
            <Input
              id='secretKey'
              placeholder='<YOUR_SECRET_ACCESS_KEY>'
              defaultValue='••••••••••••••••'
              type='password'
              className='col-span-3 h-8 text-xs'
            />
          </div>
        </>
      )
    }

    if (idLower.includes('s3') || nameLower.includes('s3')) {
      return (
        <>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='bucketName' className='text-right text-xs font-medium'>
              Bucket Name
            </Label>
            <Input
              id='bucketName'
              defaultValue='my-aws-s3-bucket'
              className='col-span-3 h-8 text-xs'
            />
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='region' className='text-right text-xs font-medium'>
              Region
            </Label>
            <Input
              id='region'
              defaultValue='us-east-1'
              className='col-span-3 h-8 text-xs'
            />
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='accessKeyId' className='text-right text-xs font-medium'>
              Access Key ID
            </Label>
            <Input
              id='accessKeyId'
              defaultValue='AKIAIOSFODNN7EXAMPLE'
              className='col-span-3 h-8 text-xs'
            />
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='secretKey' className='text-right text-xs font-medium'>
              Secret Key
            </Label>
            <Input
              id='secretKey'
              defaultValue='••••••••••••••••'
              type='password'
              className='col-span-3 h-8 text-xs'
            />
          </div>
        </>
      )
    }

    if (idLower.includes('gcs') || nameLower.includes('google cloud storage')) {
      return (
        <>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='projectId' className='text-right text-xs font-medium'>
              Project ID
            </Label>
            <Input
              id='projectId'
              defaultValue='my-gcp-project-1234'
              className='col-span-3 h-8 text-xs'
            />
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='bucketName' className='text-right text-xs font-medium'>
              Bucket Name
            </Label>
            <Input
              id='bucketName'
              defaultValue='my-gcs-bucket'
              className='col-span-3 h-8 text-xs'
            />
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='clientEmail' className='text-right text-xs font-medium'>
              Client Email
            </Label>
            <Input
              id='clientEmail'
              defaultValue='storage-sa@my-gcp-project-1234.iam.gserviceaccount.com'
              className='col-span-3 h-8 text-xs'
            />
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='privateKey' className='text-right text-xs font-medium'>
              Private Key
            </Label>
            <Input
              id='privateKey'
              defaultValue='••••••••••••••••'
              type='password'
              className='col-span-3 h-8 text-xs'
            />
          </div>
        </>
      )
    }

    if (idLower.includes('drive') || nameLower.includes('google drive')) {
      return (
        <>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='folderId' className='text-right text-xs font-medium'>
              Root Folder ID
            </Label>
            <Input
              id='folderId'
              defaultValue='1A2b3C4d5E6f7G8h9I0j'
              className='col-span-3 h-8 text-xs'
            />
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='clientId' className='text-right text-xs font-medium'>
              Client ID
            </Label>
            <Input
              id='clientId'
              defaultValue='123456789-abc.apps.googleusercontent.com'
              className='col-span-3 h-8 text-xs'
            />
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='clientSecret' className='text-right text-xs font-medium'>
              Client Secret
            </Label>
            <Input
              id='clientSecret'
              defaultValue='••••••••••••••••'
              type='password'
              className='col-span-3 h-8 text-xs'
            />
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='refreshToken' className='text-right text-xs font-medium'>
              Refresh Token
            </Label>
            <Input
              id='refreshToken'
              defaultValue='••••••••••••••••'
              type='password'
              className='col-span-3 h-8 text-xs'
            />
          </div>
        </>
      )
    }

    if (idLower.includes('storj') || nameLower.includes('storj')) {
      return (
        <>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='satellite' className='text-right text-xs font-medium'>
              Satellite URL
            </Label>
            <Input
              id='satellite'
              defaultValue='us1.storj.io'
              className='col-span-3 h-8 text-xs'
            />
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='bucketName' className='text-right text-xs font-medium'>
              Bucket Name
            </Label>
            <Input
              id='bucketName'
              defaultValue='my-storj-bucket'
              className='col-span-3 h-8 text-xs'
            />
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='accessGrant' className='text-right text-xs font-medium'>
              Access Grant
            </Label>
            <Input
              id='accessGrant'
              defaultValue='••••••••••••••••'
              type='password'
              className='col-span-3 h-8 text-xs'
            />
          </div>
        </>
      )
    }

    return (
      <>
        <div className='grid grid-cols-4 items-center gap-4'>
          <Label htmlFor='bucketName' className='text-right text-xs font-medium'>
            Bucket Name
          </Label>
          <Input
            id='bucketName'
            defaultValue='my-app-storage'
            className='col-span-3 h-8 text-xs'
          />
        </div>
        <div className='grid grid-cols-4 items-center gap-4'>
          <Label htmlFor='apiKey' className='text-right text-xs font-medium'>
            API Key
          </Label>
          <Input
            id='apiKey'
            defaultValue='••••••••••••••••'
            className='col-span-3 h-8 text-xs'
            type='password'
          />
        </div>
      </>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[480px] bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-xl shadow-black/10'>
        <DialogHeader>
          <DialogTitle>
            {t('storage.manage.title', 'Configure Storage')} - {provider.name}
          </DialogTitle>
          <DialogDescription>
            {t(
              'storage.manage.description',
              'Configure settings for this storage provider.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-3 py-4 max-h-[60vh] overflow-y-auto no-scrollbar'>
          {renderProviderFields()}
        </div>

        <DialogFooter className='flex-col sm:flex-row sm:justify-between items-center gap-2'>
          <Button
            variant='secondary'
            onClick={handleTestConnection}
            disabled={isTesting}
            className='w-full sm:w-auto bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/30'
          >
            {isTesting ? (
              <span className='animate-pulse'>{t('storage.actions.testing', 'Testing...')}</span>
            ) : (
              <>
                <Play className='mr-2 size-4' />
                {t('storage.actions.testConnection', 'Test Connection')}
              </>
            )}
          </Button>
          <div className='flex gap-2 w-full sm:w-auto'>
            <Button variant='outline' onClick={() => onOpenChange(false)} className='w-full sm:w-auto'>
              {t('storage.actions.cancel', 'Cancel')}
            </Button>
            <AuthorizedButton
              permission='workspace:settings:manage'
              onClick={handleSave}
              className='w-full sm:w-auto'
            >
              {t('storage.actions.save', 'Save Changes')}
            </AuthorizedButton>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

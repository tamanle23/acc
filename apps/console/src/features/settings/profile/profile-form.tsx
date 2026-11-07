import { useEffect } from 'react'
import { z } from 'zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Check,
  ChevronsUpDown,
  CheckCircle2,
  Mail,
  Phone,
  Globe,
  Trash2,
  Plus,
  Loader2,
  User,
  ShieldCheck,
  RotateCcw,
  Building2,
  Sparkles,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useUserProfileQuery, useUpdateUserProfileMutation, unwrapUserProfile } from './api/use-user-profile'
import { useSpringAuthStore } from '@/features/spring-auth'
import { getUserInitials } from '@/lib/user-avatar'

const languages = [
  { label: 'English (US)', value: 'en' },
  { label: 'Tiếng Việt', value: 'vi' },
] as const

export const profileFormSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required.')
    .max(50, 'First name must not exceed 50 characters.'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Last name is required.')
    .max(50, 'Last name must not exceed 50 characters.'),
  username: z
    .string()
    .trim()
    .max(50, 'Username must not exceed 50 characters.')
    .optional(),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .email('Please enter a valid email address.'),
  phoneNumber: z
    .string()
    .trim()
    .max(20, 'Phone number must not exceed 20 characters.')
    .optional()
    .or(z.literal('')),
  language: z.string().min(1, 'Please select a language.'),
  bio: z
    .string()
    .max(160, 'Bio must not exceed 160 characters.')
    .optional()
    .or(z.literal('')),
  urls: z
    .array(
      z.object({
        value: z
          .string()
          .trim()
          .refine(
            (val) => !val || /^https?:\/\/.+/i.test(val),
            'Please enter a valid HTTP or HTTPS URL.'
          ),
      })
    )
    .optional(),
})

export type ProfileFormValues = z.infer<typeof profileFormSchema>

export function ProfileForm() {
  const { i18n } = useTranslation(['console', 'common'])
  const { data: rawProfileData, isLoading: isProfileLoading } = useUserProfileQuery()
  const profileData = unwrapUserProfile(rawProfileData)
  const updateProfileMutation = useUpdateUserProfileMutation()
  const authUser = useSpringAuthStore((s) => s.user)
  const currentTenantId = useSpringAuthStore((s) => s.currentTenantId)

  const defaultValues: ProfileFormValues = {
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phoneNumber: '',
    language: i18n.language?.startsWith('vi') ? 'vi' : 'en',
    bio: '',
    urls: [{ value: 'https://acc.io' }],
  }

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues,
    mode: 'onChange',
  })

  // Hydrate form whenever server profileData resolves
  useEffect(() => {
    if (rawProfileData) {
      const resolvedFirst = profileData.firstName || authUser?.username?.split(' ')[0] || ''
      const resolvedLast =
        profileData.lastName ||
        (authUser?.username && authUser.username.split(' ').length > 1
          ? authUser.username.split(' ').slice(1).join(' ')
          : '') ||
        'User'

      form.reset({
        firstName: resolvedFirst,
        lastName: resolvedLast,
        username: profileData.username || authUser?.username || '',
        email: profileData.email || authUser?.email || 'admin@acc.io',
        phoneNumber: profileData.phoneNumber || '',
        language: profileData.preferences?.language || (i18n.language?.startsWith('vi') ? 'vi' : 'en'),
        bio: profileData.preferences?.bio || '',
        urls:
          profileData.preferences?.urls && profileData.preferences.urls.length > 0
            ? profileData.preferences.urls
            : [{ value: 'https://acc.io' }],
      })
    }
  }, [rawProfileData, authUser, form, i18n.language])

  const { fields, append, remove } = useFieldArray({
    name: 'urls',
    control: form.control,
  })

  const onSubmit = async (data: ProfileFormValues) => {
    if (data.language !== i18n?.language && typeof i18n?.changeLanguage === 'function') {
      await i18n.changeLanguage(data.language)
    }

    try {
      const cleanUrls = data.urls?.filter((u) => u.value && u.value.trim().length > 0)

      const updated = await updateProfileMutation.mutateAsync({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneNumber: data.phoneNumber ? data.phoneNumber : undefined,
        preferences: {
          language: data.language,
          bio: data.bio || undefined,
          urls: cleanUrls,
        },
      })

      // Keep auth store session user in sync with updated profile email & name
      if (authUser) {
        useSpringAuthStore.getState().setUser({
          ...authUser,
          email: updated.email || data.email,
        })
      }

      form.reset(data) // Reset dirty tracking to newly saved baseline
      toast.success('Profile updated successfully')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update profile')
    }
  }

  const handleReset = () => {
    if (rawProfileData) {
      const resolvedFirst = profileData.firstName || authUser?.username?.split(' ')[0] || ''
      const resolvedLast =
        profileData.lastName ||
        (authUser?.username && authUser.username.split(' ').length > 1
          ? authUser.username.split(' ').slice(1).join(' ')
          : '') ||
        'User'

      form.reset({
        firstName: resolvedFirst,
        lastName: resolvedLast,
        username: profileData.username || authUser?.username || '',
        email: profileData.email || authUser?.email || 'admin@acc.io',
        phoneNumber: profileData.phoneNumber || '',
        language: profileData.preferences?.language || (i18n.language?.startsWith('vi') ? 'vi' : 'en'),
        bio: profileData.preferences?.bio || '',
        urls:
          profileData.preferences?.urls && profileData.preferences.urls.length > 0
            ? profileData.preferences.urls
            : [{ value: 'https://acc.io' }],
      })
      toast.info('Form reverted to saved profile values')
    }
  }

  // Active identity values for dynamic avatar card preview
  const watchedFirst = form.watch('firstName')
  const watchedLast = form.watch('lastName')
  const watchedEmail = form.watch('email')
  const watchedBio = form.watch('bio') || ''
  const displayFullName = [watchedFirst, watchedLast].filter(Boolean).join(' ') || profileData?.username || authUser?.username || 'User'
  const initials = getUserInitials(displayFullName, watchedEmail || profileData?.email)
  const roleName = authUser?.roles?.[0] || authUser?.role || (profileData?.preferences as any)?.role || 'ROLE_ADMIN'
  const formattedRole = roleName.replace(/^ROLE_/, '').replace(/_/g, ' ')
  const userId = profileData?.userId || (authUser as any)?.uid || 'usr-root'

  if (isProfileLoading) {
    return <ProfileFormSkeleton />
  }

  return (
    <div className='space-y-8'>
      {/* ===== Identity & Avatar Header Card ===== */}
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl border bg-card/60 backdrop-blur-sm shadow-sm transition-all'>
        <div className='flex items-center gap-4'>
          <Avatar className='h-16 w-16 border-2 border-primary/20 shadow-sm shrink-0'>
            <AvatarImage
              src={(profileData?.preferences as any)?.avatarUrl}
              alt={displayFullName}
            />
            <AvatarFallback className='text-lg font-bold bg-primary/10 text-primary'>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className='space-y-1 min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <h4 className='text-base font-semibold text-foreground tracking-tight truncate'>
                {displayFullName}
              </h4>
              <Badge
                variant='secondary'
                className='text-[11px] font-normal text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1'
              >
                <CheckCircle2 className='size-3 shrink-0' /> Verified Account
              </Badge>
            </div>
            <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
              <span className='flex items-center gap-1 text-foreground/80 font-medium'>
                <User className='size-3.5 text-muted-foreground' />
                @{profileData?.username || authUser?.username || 'user'}
              </span>
              <span>•</span>
              <span className='flex items-center gap-1'>
                <Mail className='size-3.5 text-muted-foreground' />
                {watchedEmail || profileData?.email || 'user@acc.io'}
              </span>
            </div>
          </div>
        </div>

        <div className='flex items-center gap-2 self-stretch sm:self-auto justify-end flex-wrap'>
          <Badge variant='outline' className='text-xs font-mono capitalize tracking-wide px-2.5 py-1 flex items-center gap-1.5'>
            <ShieldCheck className='size-3.5 text-primary' />
            {formattedRole}
          </Badge>
          {currentTenantId && (
            <Badge variant='outline' className='text-xs font-mono px-2.5 py-1 text-muted-foreground flex items-center gap-1'>
              <Building2 className='size-3.5' />
              {currentTenantId}
            </Badge>
          )}
          <Badge variant='secondary' className='text-[10px] font-mono text-muted-foreground px-2 py-0.5' title={`User Identifier: ${userId}`}>
            {userId}
          </Badge>
        </div>
      </div>

      {/* ===== Profile Form ===== */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
          {/* Section 1: Personal Contact Details */}
          <div className='space-y-4'>
            <div className='border-b pb-2'>
              <h5 className='text-sm font-semibold text-foreground'>Personal Details</h5>
              <p className='text-xs text-muted-foreground'>
                Your real name and verified contact coordinates used across workspaces.
              </p>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='firstName'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name <span className='text-destructive'>*</span></FormLabel>
                    <FormControl>
                      <Input placeholder='Jane' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='lastName'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name <span className='text-destructive'>*</span></FormLabel>
                    <FormControl>
                      <Input placeholder='Doe' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address <span className='text-destructive'>*</span></FormLabel>
                    <FormControl>
                      <Input type='email' placeholder='jane.doe@company.com' {...field} />
                    </FormControl>
                    <FormDescription>
                      Primary email for system alerts and security dispatches.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='phoneNumber'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input
                        type='tel'
                        placeholder='+1 (555) 019-2834'
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Used for emergency notifications and incident escalation.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='username'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Public Username</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='janedoe'
                      {...field}
                      value={field.value || ''}
                      disabled
                      className='bg-muted/50 cursor-not-allowed font-mono text-xs'
                    />
                  </FormControl>
                  <FormDescription>
                    Unique platform handle. Managed via system identity administrator.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Section 2: Localization & Bio */}
          <div className='space-y-4'>
            <div className='border-b pb-2'>
              <h5 className='text-sm font-semibold text-foreground'>Localization & Bio</h5>
              <p className='text-xs text-muted-foreground'>
                Configure your locale preferences and brief organizational biography.
              </p>
            </div>

            <FormField
              control={form.control}
              name='language'
              render={({ field }) => (
                <FormItem className='flex flex-col'>
                  <FormLabel>Interface Language</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant='outline'
                          role='combobox'
                          className={cn(
                            'w-full sm:w-[240px] justify-between font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          <span className='flex items-center gap-2 truncate'>
                            <Globe className='size-3.5 text-muted-foreground shrink-0' />
                            {field.value
                              ? languages.find((lang) => lang.value === field.value)?.label
                              : 'Select language'}
                          </span>
                          <ChevronsUpDown className='ms-2 h-4 w-4 shrink-0 opacity-50' />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className='w-[240px] p-0' align='start'>
                      <Command>
                        <CommandInput placeholder='Search language...' />
                        <CommandEmpty>No language found.</CommandEmpty>
                        <CommandGroup>
                          <CommandList>
                            {languages.map((language) => (
                              <CommandItem
                                value={language.label}
                                key={language.value}
                                onSelect={() => {
                                  form.setValue('language', language.value, { shouldDirty: true })
                                }}
                              >
                                <Check
                                  className={cn(
                                    'size-4 mr-2',
                                    language.value === field.value ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                {language.label}
                              </CommandItem>
                            ))}
                          </CommandList>
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Select the localization language for console displays and alert toasts.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='bio'
              render={({ field }) => (
                <FormItem>
                  <div className='flex items-center justify-between'>
                    <FormLabel>Biography</FormLabel>
                    <span className='text-[11px] text-muted-foreground font-mono'>
                      {watchedBio.length} / 160
                    </span>
                  </div>
                  <FormControl>
                    <Textarea
                      placeholder='Brief summary of your organizational scope or responsibilities...'
                      className='resize-none h-24'
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Short bio shown in workspace activity logs and team assignment lists.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Section 3: Professional Links */}
          <div className='space-y-4'>
            <div className='border-b pb-2 flex items-center justify-between'>
              <div>
                <h5 className='text-sm font-semibold text-foreground'>External URLs</h5>
                <p className='text-xs text-muted-foreground'>
                  Links to your documentation repositories, profiles, or internal wikis.
                </p>
              </div>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='h-8 text-xs flex items-center gap-1.5'
                onClick={() => append({ value: '' })}
              >
                <Plus className='size-3.5' /> Add URL
              </Button>
            </div>

            {fields.length === 0 ? (
              <div className='rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground'>
                No external links configured. Click &ldquo;Add URL&rdquo; to attach references.
              </div>
            ) : (
              <div className='space-y-2.5'>
                {fields.map((fieldItem, index) => (
                  <FormField
                    control={form.control}
                    key={fieldItem.id}
                    name={`urls.${index}.value`}
                    render={({ field }) => (
                      <FormItem>
                        <div className='flex items-center gap-2'>
                          <FormControl>
                            <Input
                              placeholder='https://github.com/org'
                              {...field}
                              className='font-mono text-xs'
                            />
                          </FormControl>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            className='h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive'
                            onClick={() => remove(index)}
                            aria-label={`Remove URL #${index + 1}`}
                          >
                            <Trash2 className='size-4' />
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ===== Actions Bar ===== */}
          <div className='flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-4 border-t'>
            <div className='flex items-center gap-2 self-start sm:self-auto'>
              {form.formState.isDirty && (
                <Badge variant='outline' className='text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 flex items-center gap-1.5 animate-in fade-in duration-200'>
                  <Sparkles className='size-3' /> Unsaved edits
                </Badge>
              )}
            </div>

            <div className='flex items-center gap-2.5 w-full sm:w-auto justify-end'>
              <Button
                type='button'
                variant='outline'
                disabled={!form.formState.isDirty || updateProfileMutation.isPending}
                onClick={handleReset}
                className='h-9 text-xs flex items-center gap-1.5'
              >
                <RotateCcw className='size-3.5' /> Revert
              </Button>

              <Button
                type='submit'
                disabled={!form.formState.isDirty || updateProfileMutation.isPending}
                className='h-9 text-xs px-5 shadow-sm'
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className='mr-2 size-3.5 animate-spin' />
                    Saving Changes...
                  </>
                ) : (
                  'Save Profile'
                )}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  )
}

/**
 * High-fidelity Skeleton loader matching the 5+ state component matrix.
 * Eliminates Cumulative Layout Shift (CLS) during initial query resolution.
 */
export function ProfileFormSkeleton() {
  return (
    <div className='space-y-8 animate-pulse'>
      {/* Header Card Skeleton */}
      <div className='flex items-center justify-between p-5 rounded-xl border bg-card/40'>
        <div className='flex items-center gap-4'>
          <Skeleton className='h-16 w-16 rounded-full' />
          <div className='space-y-2'>
            <Skeleton className='h-5 w-48' />
            <Skeleton className='h-3.5 w-36' />
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Skeleton className='h-6 w-24 rounded-md' />
          <Skeleton className='h-6 w-20 rounded-md' />
        </div>
      </div>

      {/* Input Skeletons */}
      <div className='space-y-4'>
        <Skeleton className='h-4 w-32' />
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <Skeleton className='h-10 w-full rounded-md' />
          <Skeleton className='h-10 w-full rounded-md' />
        </div>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <Skeleton className='h-10 w-full rounded-md' />
          <Skeleton className='h-10 w-full rounded-md' />
        </div>
        <Skeleton className='h-10 w-full rounded-md' />
      </div>

      {/* Bio Skeleton */}
      <div className='space-y-4'>
        <Skeleton className='h-4 w-28' />
        <Skeleton className='h-24 w-full rounded-md' />
      </div>

      {/* Button Skeleton */}
      <div className='flex justify-end gap-2 pt-4 border-t'>
        <Skeleton className='h-9 w-20 rounded-md' />
        <Skeleton className='h-9 w-28 rounded-md' />
      </div>
    </div>
  )
}

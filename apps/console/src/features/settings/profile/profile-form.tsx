import { useEffect } from 'react'
import { z } from 'zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/date-picker'
import { Check, ChevronsUpDown } from 'lucide-react'
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
import { useUserProfileQuery, useUpdateUserProfileMutation } from './api/use-user-profile'

const languages = [
  { label: 'English', value: 'en' },
  { label: 'Vietnamese', value: 'vi' },
] as const

const profileFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Please enter your name.')
    .min(2, 'Name must be at least 2 characters.')
    .max(30, 'Name must not be longer than 30 characters.'),
  dob: z.date({
    error: 'Please select your date of birth.',
  }),
  language: z.string({
    error: 'Please select a language.',
  }),
  username: z
    .string('Please enter your username.')
    .min(2, 'Username must be at least 2 characters.')
    .max(30, 'Username must not be longer than 30 characters.'),
  email: z.email({
    error: (iss) =>
      iss.input === undefined
        ? 'Please select an email to display.'
        : undefined,
  }),
  bio: z.string().max(160).min(4),
  urls: z
    .array(
      z.object({
        value: z.url('Please enter a valid URL.'),
      })
    )
    .optional(),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

export function ProfileForm() {
  const { i18n } = useTranslation(['console', 'common'])
  const { data: profileData, isLoading: isProfileLoading } = useUserProfileQuery()
  const updateProfileMutation = useUpdateUserProfileMutation()

  const defaultValues: Partial<ProfileFormValues> = {
    name: '',
    language: i18n.language || 'en',
    bio: 'I own a computer.',
    urls: [
      { value: 'https://shadcn.com' },
      { value: 'http://twitter.com/shadcn' },
    ],
  }

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues,
    mode: 'onChange',
  })

  useEffect(() => {
    if (profileData) {
      const fullName = [profileData.firstName, profileData.lastName].filter(Boolean).join(' ')
      form.reset({
        name: fullName || profileData.username || '',
        username: profileData.username || '',
        email: profileData.email || 'm@example.com',
        dob: new Date('1990-01-01'),
        language: profileData.preferences?.language || i18n.language || 'en',
        bio: profileData.preferences?.bio || 'I own a computer.',
        urls: profileData.preferences?.urls || [{ value: 'https://acc.io' }],
      })
    }
  }, [profileData, form, i18n.language])

  const { fields, append } = useFieldArray({
    name: 'urls',
    control: form.control,
  })

  const onSubmit = async (data: ProfileFormValues) => {
    if (data.language !== i18n.language) {
      i18n.changeLanguage(data.language)
    }

    try {
      const [firstName, ...rest] = data.name.trim().split(' ')
      const lastName = rest.join(' ')

      await updateProfileMutation.mutateAsync({
        firstName,
        lastName: lastName || undefined,
        email: data.email,
        preferences: {
          language: data.language,
          bio: data.bio,
          urls: data.urls,
        },
      })
      toast.success('Profile updated successfully')
    } catch {
      toast.error('Failed to update profile')
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className='space-y-8'
      >

        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder='Your name' {...field} />
              </FormControl>
              <FormDescription>
                This is the name that will be displayed on your profile and in
                emails.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='username'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder='shadcn' {...field} />
              </FormControl>
              <FormDescription>
                This is your public display name. It can be your real name or a
                pseudonym. You can only change this once every 30 days.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='dob'
          render={({ field }) => (
            <FormItem className='flex flex-col'>
              <FormLabel>Date of birth</FormLabel>
              <DatePicker selected={field.value} onSelect={field.onChange} />
              <FormDescription>
                Your date of birth is used to calculate your age.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder='Select a verified email to display' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value='m@example.com'>m@example.com</SelectItem>
                  <SelectItem value='m@google.com'>m@google.com</SelectItem>
                  <SelectItem value='m@support.com'>m@support.com</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                You can manage verified email addresses in your{' '}
                <Link to='/'>email settings</Link>.
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
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea
                  placeholder='Tell us a little bit about yourself'
                  className='resize-none'
                  {...field}
                />
              </FormControl>
              <FormDescription>
                You can <span>@mention</span> other users and organizations to
                link to them.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='language'
          render={({ field }) => (
            <FormItem className='flex flex-col'>
              <FormLabel>Language</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant='outline'
                      role='combobox'
                      className={cn(
                        'w-[200px] justify-between',
                        !field.value && 'text-muted-foreground'
                      )}
                    >
                      {field.value
                        ? languages.find(
                          (language) => language.value === field.value
                        )?.label
                        : 'Select language'}
                      <ChevronsUpDown className='ms-2 h-4 w-4 shrink-0 opacity-50' />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className='w-[200px] p-0'>
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
                              form.setValue('language', language.value)
                            }}
                          >
                            <Check
                              className={cn(
                                'size-4',
                                language.value === field.value
                                  ? 'opacity-100'
                                  : 'opacity-0'
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
                This is the language that will be used in the dashboard.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div>
          {fields.map((field, index) => (
            <FormField
              control={form.control}
              key={field.id}
              name={`urls.${index}.value`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={cn(index !== 0 && 'sr-only')}>
                    URLs
                  </FormLabel>
                  <FormDescription className={cn(index !== 0 && 'sr-only')}>
                    Add links to your website, blog, or social media profiles.
                  </FormDescription>
                  <FormControl className={cn(index !== 0 && 'mt-1.5')}>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='mt-2'
            onClick={() => append({ value: '' })}
          >
            Add URL
          </Button>
        </div>
        <Button type='submit' disabled={updateProfileMutation.isPending || isProfileLoading}>
          {updateProfileMutation.isPending ? 'Updating...' : 'Update'}
        </Button>
      </form>
    </Form>
  )
}

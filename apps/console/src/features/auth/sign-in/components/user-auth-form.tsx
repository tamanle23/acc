import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { Loader2, LogIn, ShieldAlert, Fingerprint } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { IconFacebook, IconGithub } from '@acc/ui/icons'
import { useSpringAuthStore, springApiClient } from '@/features/spring-auth'
import { PasswordRotationModal } from '@/features/auth/components/password-rotation-modal'
import {
  useSandboxStore,
  DEFAULT_SANDBOX_PERSONAS,
  type SandboxPersonaId,
} from '@/core/sandbox'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { enableSandboxMockEngine } from '@/features/spring-auth/sandbox/mock-engine'

const formSchema = z.object({
  email: z.string().min(1, 'Please enter your email or username'),
  password: z
    .string()
    .min(1, 'Please enter your password')
    .min(5, 'Password must be at least 5 characters long'),
})

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const { t } = useTranslation('console')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const [showRotationModal, setShowRotationModal] = useState(false)
  const [rotationUsername, setRotationUsername] = useState('')
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)

  // Use the new Spring Security dual-token store
  const { setTokens } = useSpringAuthStore()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const response = await springApiClient.post('/auth/token', {
        userName: data.email,
        password: data.password,
      });

      const accessToken = response.data?.body?.accessToken || response.data?.accessToken;
      const refreshToken = response.data?.body?.refreshToken || response.data?.refreshToken;
      setTokens(accessToken, refreshToken);
      toast.success(`Welcome back, ${data.email}!`);

      const targetPath = redirectTo || '/'
      navigate({ to: targetPath, replace: true })
    } catch (error: any) {
      const errData = error.response?.data
      if (errData?.error === 'PASSWORD_ROTATION_REQUIRED' || errData?.code === 'CREDENTIALS_EXPIRED') {
        toast.info('Initial password rotation required for this account.')
        setRotationUsername(data.email)
        setShowRotationModal(true)
        return
      }
      toast.error(errData?.message || 'Invalid credentials or network error');
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePasskeySignIn() {
    setIsPasskeyLoading(true)
    try {
      const email = form.getValues('email')
      const optionsRes = await springApiClient.post('/auth/passkey/login/options', { email })
      const options = optionsRes.data?.body || optionsRes.data

      if (window.PublicKeyCredential && options?.challenge) {
        // Native WebAuthn assertion
        const assertion = await navigator.credentials.get({
          publicKey: {
            challenge: Uint8Array.from(atob(options.challenge), c => c.charCodeAt(0)),
            rpId: options.rpId || window.location.hostname,
            timeout: options.timeout || 60000,
            userVerification: options.userVerification || 'preferred',
          }
        })
        const verifyRes = await springApiClient.post('/auth/passkey/login/verify', {
          email,
          assertion: assertion ? JSON.stringify(assertion) : 'passkey_assertion_payload',
        })
        const accessToken = verifyRes.data?.body?.accessToken || verifyRes.data?.accessToken
        const refreshToken = verifyRes.data?.body?.refreshToken || verifyRes.data?.refreshToken
        if (accessToken) {
          setTokens(accessToken, refreshToken)
          toast.success('Passkey verification successful!')
          navigate({ to: redirectTo || '/', replace: true })
        }
      } else {
        // Sandbox fallback
        const verifyRes = await springApiClient.post('/auth/passkey/login/verify', { email })
        const accessToken = verifyRes.data?.body?.accessToken || verifyRes.data?.accessToken
        const refreshToken = verifyRes.data?.body?.refreshToken || verifyRes.data?.refreshToken
        if (accessToken) {
          setTokens(accessToken, refreshToken)
          toast.success('Passkey verification successful!')
          navigate({ to: redirectTo || '/', replace: true })
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Passkey authentication failed or was cancelled.')
    } finally {
      setIsPasskeyLoading(false)
    }
  }

  // Sandbox bypass logic wired directly to Unified Sandbox Platform
  const handleSandboxBypass = async (personaId: SandboxPersonaId) => {
    setIsLoading(true);
    try {
      const persona = DEFAULT_SANDBOX_PERSONAS[personaId] || DEFAULT_SANDBOX_PERSONAS.admin;
      // Attach Unified Sandbox Interceptor in development mode
      enableSandboxMockEngine(springApiClient);
      // Synchronize Unified Sandbox persona and tenant scope
      useSandboxStore.getState().setEnabled(true);
      useSandboxStore.getState().setActivePersona(personaId);
      // The mock engine intercepts this request and checks for username + password === 'bypass'
      const response = await springApiClient.post('/auth/token', {
        username: persona.username,
        userName: persona.username,
        password: 'bypass',
      }, {
        headers: {
          'X-Sandbox-Mock': 'true'
        }
      });
      const accessToken = response.data?.body?.accessToken || response.data?.accessToken;
      const refreshToken = response.data?.body?.refreshToken || response.data?.refreshToken;
      setTokens(accessToken, refreshToken);
      toast.success(
        t('auth.sandbox.successToast', 'Sandbox Login Successful ({{role}})', {
          role: persona.name,
        })
      );

      const targetPath = redirectTo || '/';
      navigate({ to: targetPath, replace: true });
    } catch (_e) {
      toast.error(t('auth.sandbox.failedToast', 'Sandbox login failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email or Username</FormLabel>
              <FormControl>
                <Input placeholder='name@example.com' autoComplete='username' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem className='relative'>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' autoComplete='current-password' {...field} />
              </FormControl>
              <FormMessage />
              <Link
                to='/forgot-password'
                className='absolute end-0 -top-0.5 text-sm font-medium text-muted-foreground hover:opacity-75'
              >
                Forgot password?
              </Link>
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
          Sign in
        </Button>

        {import.meta.env.DEV && import.meta.env.VITE_ENABLE_SANDBOX !== 'false' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type='button'
                variant='outline'
                className='border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400'
                disabled={isLoading}
              >
                <ShieldAlert className='me-2 size-4' />
                {t('auth.sandbox.bypass', 'Bypass with Sandbox...')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-[var(--radix-dropdown-menu-trigger-width)]">
              <DropdownMenuItem
                onClick={() => handleSandboxBypass('system')}
                className="cursor-pointer flex items-center justify-between text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 focus:bg-amber-500/20"
              >
                <span>👑 {t('auth.sandbox.systemRole', 'Sovereign Custodian (SYSTEM)')}</span>
                <span className="text-[10px] text-amber-700 dark:text-amber-300 font-mono">ROOT ∞</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleSandboxBypass('admin')}
                className="cursor-pointer flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium"
              >
                <span>{t('auth.sandbox.adminRole', 'Admin (All Access)')}</span>
                <span className="text-[10px] text-muted-foreground font-mono">us-east-1</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleSandboxBypass('creator')}
                className="cursor-pointer flex items-center justify-between"
              >
                <span>{t('auth.sandbox.creatorRole', 'Creator (Content)')}</span>
                <span className="text-[10px] text-muted-foreground font-mono">eu-central-1</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleSandboxBypass('user')}
                className="cursor-pointer flex items-center justify-between"
              >
                <span>{t('auth.sandbox.userRole', 'Standard User')}</span>
                <span className="text-[10px] text-muted-foreground font-mono">us-west-2</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className='relative my-2'>
          <div className='absolute inset-0 flex items-center'>
            <span className='w-full border-t' />
          </div>
          <div className='relative flex justify-center text-xs uppercase'>
            <span className='bg-background px-2 text-muted-foreground'>
              Or continue with
            </span>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-2'>
          <Button variant='outline' type='button' disabled={isLoading}>
            <IconGithub className='h-4 w-4' /> GitHub
          </Button>
          <Button variant='outline' type='button' disabled={isLoading}>
            <IconFacebook className='h-4 w-4' /> Facebook
          </Button>
        </div>

        <Button
          variant='ghost'
          type='button'
          disabled={isLoading || isPasskeyLoading}
          onClick={handlePasskeySignIn}
          className='w-full border border-dashed border-border/80 hover:border-primary hover:bg-primary/5 text-xs text-muted-foreground hover:text-foreground mt-1'
        >
          {isPasskeyLoading ? (
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          ) : (
            <Fingerprint className='mr-2 h-4 w-4 text-primary' />
          )}
          Sign in with Passkey / Security Key
        </Button>
      </form>

      <PasswordRotationModal
        open={showRotationModal}
        username={rotationUsername}
        onSuccess={() => {
          setShowRotationModal(false)
          navigate({ to: redirectTo || '/', replace: true })
        }}
        onCancel={() => setShowRotationModal(false)}
      />
    </Form>
  )
}

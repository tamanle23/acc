import { useState, useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Loader2, RefreshCw } from 'lucide-react'
import { useSpringAuthStore, springApiClient } from '@/features/spring-auth'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp'

const formSchema = z.object({
  otp: z
    .string()
    .min(6, 'Please enter the 6-digit code.')
    .max(6, 'Please enter the 6-digit code.'),
})

type OtpFormProps = React.HTMLAttributes<HTMLFormElement>

export function OtpForm({ className, ...props }: OtpFormProps) {
  const navigate = useNavigate()
  const searchParams: any = useSearch({ strict: false })
  const email = searchParams?.email || ''

  const [isLoading, setIsLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(60)
  const [isResending, setIsResending] = useState(false)
  const [hasError, setHasError] = useState(false)

  const { setTokens } = useSpringAuthStore()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { otp: '' },
  })

  const otp = form.watch('otp')

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    setHasError(false)
    try {
      const response = await springApiClient.post('/auth/verify-otp', {
        email,
        otp: data.otp,
      })

      const accessToken = response.data?.body?.accessToken || response.data?.accessToken
      const refreshToken = response.data?.body?.refreshToken || response.data?.refreshToken

      if (accessToken) {
        setTokens(accessToken, refreshToken)
      }

      toast.success('Identity verified! Welcome to UniPost.')
      navigate({ to: '/' })
    } catch (err: any) {
      setHasError(true)
      const msg = err.response?.data?.message || 'Verification failed. Please check your 6-digit code.'
      toast.error(msg)
      form.setValue('otp', '')
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (otp && otp.length === 6 && !isLoading) {
      form.handleSubmit(onSubmit)()
    }
  }, [otp])

  async function handleResend() {
    if (resendCooldown > 0 || isResending) return
    setIsResending(true)
    try {
      await springApiClient.post('/auth/resend-otp', { email })
      toast.success('New verification code sent to your email.')
      setResendCooldown(60)
    } catch (_err) {
      toast.error('Failed to resend code. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='otp'
          render={({ field }) => (
            <FormItem>
              <FormLabel className='sr-only'>One-Time Password</FormLabel>
              <FormControl>
                <div className={cn(hasError && 'animate-shake')}>
                  <InputOTP
                    maxLength={6}
                    autoComplete='one-time-code'
                    {...field}
                    containerClassName='justify-between sm:[&>[data-slot="input-otp-group"]>div]:w-12'
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button className='mt-2' disabled={otp.length < 6 || isLoading}>
          {isLoading ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
          Verify & Sign In
        </Button>

        <div className='flex items-center justify-between text-sm mt-2'>
          <span className='text-muted-foreground'>Didn't receive a code?</span>
          <Button
            variant='link'
            type='button'
            className='p-0 h-auto font-medium'
            disabled={resendCooldown > 0 || isResending}
            onClick={handleResend}
          >
            {isResending ? (
              <Loader2 className='mr-1 h-3 w-3 animate-spin' />
            ) : (
              <RefreshCw className='mr-1 h-3 w-3' />
            )}
            {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

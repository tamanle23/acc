import { z } from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { SignIn } from '@/features/auth/sign-in'
import { useSpringAuthStore } from '@/features/spring-auth'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/sign-in')({
  beforeLoad: () => {
    const { isAuthenticated, user, accessToken } = useSpringAuthStore.getState();
    if (isAuthenticated && user && accessToken) {
      throw redirect({
        to: '/dashboard',
      });
    }
  },
  component: SignIn,
  validateSearch: searchSchema,
})

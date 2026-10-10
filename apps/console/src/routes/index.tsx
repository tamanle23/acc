import { createFileRoute, redirect } from '@tanstack/react-router';
import { LandingPage } from '@/features/landing';
import { useSpringAuthStore } from '@/features/spring-auth/store';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    // If user is already authenticated with active access token, bypass landing page to metadata studio
    const { isAuthenticated, accessToken } = useSpringAuthStore.getState();
    if (isAuthenticated || accessToken) {
      throw redirect({
        to: '/dashboard',
      });
    }
  },
  component: LandingPage,
});

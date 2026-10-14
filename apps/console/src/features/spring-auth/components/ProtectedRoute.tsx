import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useSpringAuthStore } from '../store';
import { Loader2, ShieldAlert, LogOut, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallbackUnauthenticated?: React.ReactNode;
  requiredRoles?: string[];
  fallbackUnauthorized?: React.ReactNode;
  fallbackForbidden?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  fallbackUnauthenticated,
  requiredRoles = [],
  fallbackUnauthorized,
  fallbackForbidden,
}: ProtectedRouteProps) {
  const { isAuthenticated, user, currentTenantId } = useSpringAuthStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isHydrating = !useSpringAuthStore.persist.hasHydrated();

  React.useEffect(() => {
    if (!isHydrating && (!isAuthenticated || !user) && !fallbackUnauthenticated) {
      navigate({ to: '/sign-in', replace: true });
    }
  }, [isHydrating, isAuthenticated, user, fallbackUnauthenticated, navigate]);

  if (isHydrating) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return fallbackUnauthenticated || null;
  }

  // Tenant Assignment Guard:
  // All authenticated non-SYSTEM users MUST belong to an explicit tenant organization.
  const tenantId = (user?.tenantId as string) || (user?.tid as string) || currentTenantId || '';
  const isSystemUser = user?.roles?.some(role => role.includes('SYSTEM') || role.includes('CUSTODIAN'));

  if (!tenantId.trim() && !isSystemUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/20 bg-white/10 dark:bg-slate-900/60 p-6 backdrop-blur-2xl shadow-2xl shadow-rose-950/20 text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 shadow-inner">
            <ShieldAlert className="h-8 w-8 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {t('auth:unassigned_tenant.title', 'No Organization Assigned')}
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t(
                'auth:unassigned_tenant.message',
                'Your account is not assigned to any active tenant organization. Access to workspace services is prohibited until a SYSTEM Custodian assigns your membership.'
              )}
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-left">
            <div className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider mb-1">
              {t('auth:unassigned_tenant.security_note', 'Security Directive')}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t(
                'auth:unassigned_tenant.security_desc',
                'Multi-tenant boundaries require an explicit organization context. Orphaned sessions cannot proceed.'
              )}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 border-white/10 hover:bg-white/5"
              onClick={() => {
                window.location.href = 'mailto:custodian@unipost.io?subject=Request%20Tenant%20Membership%20Assignment';
              }}
            >
              <Mail className="h-4 w-4 mr-2 text-primary" />
              {t('auth:unassigned_tenant.contact', 'Contact Custodian')}
            </Button>
            <Button
              variant="destructive"
              className="flex-1 shadow-lg shadow-rose-500/20"
              onClick={() => {
                clearTokens();
                navigate({ to: '/sign-in', replace: true });
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t('auth:unassigned_tenant.sign_out', 'Sign Out')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (requiredRoles.length > 0) {
    const hasRole = requiredRoles.some(role => user.roles.includes(role));
    if (!hasRole) {
      return fallbackForbidden || fallbackUnauthorized || (
        <div className="flex flex-col items-center justify-center p-8 text-orange-600 dark:text-orange-400 bg-orange-500/10 rounded-xl border border-orange-500/20 m-4">
          <h2 className="font-semibold text-lg">403 Forbidden</h2>
          <p className="text-sm">You do not have the required roles to view this content.</p>
        </div>
      );
    }
  }

  return <>{children}</>;
}

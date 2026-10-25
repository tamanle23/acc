import { ShieldAlert, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSpringAuthStore } from '@/features/spring-auth';
import { useSandboxStore } from '@/core/sandbox';
import { exitAssumeTenantSubSession } from '@/features/system/utils/assume-tenant-session';

/**
 * Top viewport banner displayed when Sovereign Custodian is running under
 * an ephemeral Assume-Tenant impersonation sub-session.
 */
export function AssumeTenantBar() {
  const { currentTenantId } = useSpringAuthStore();
  const { activeTenantId } = useSandboxStore();

  const assumedTenant = typeof window !== 'undefined' ? localStorage.getItem('acc_assumed_tenant') : null;
  const effectiveTenant = assumedTenant || currentTenantId || activeTenantId;
  const isAssumed = Boolean(assumedTenant && assumedTenant !== 'SYSTEM');

  if (!isAssumed) return null;

  const handleExitSubSession = () => {
    exitAssumeTenantSubSession('/system/tenants');
  };

  return (
    <aside
      aria-label="Delegated impersonation active"
      className="relative z-50 flex items-center justify-between px-4 py-2 bg-amber-500/15 dark:bg-amber-500/20 backdrop-blur-xl border-b border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs sm:text-sm font-medium shadow-[0_1px_4px_rgba(245,158,11,0.15)] transition-all"
    >
      <div className="flex items-center gap-2.5 truncate">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-600 dark:text-amber-300">
          <ShieldAlert className="h-3.5 w-3.5" />
        </div>
        <span className="truncate">
          <strong className="font-semibold text-amber-950 dark:text-amber-100 uppercase tracking-wide">
            Assume-Tenant Active:
          </strong>{' '}
          Operating with delegated sovereignty inside organization{' '}
          <code className="px-1.5 py-0.5 rounded bg-amber-500/20 font-mono text-xs border border-amber-500/30">
            {effectiveTenant}
          </code>{' '}
          (Actor:{' '}
          <span className="font-mono text-xs font-semibold">SYSTEM</span>)
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={handleExitSubSession}
          className="h-7 px-2.5 text-xs font-medium border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-950 dark:text-amber-100 transition-colors shadow-none"
        >
          Exit Sub-Session
          <ArrowRight className="h-3.5 w-3.5 ms-1" />
        </Button>
      </div>
    </aside>
  );
}

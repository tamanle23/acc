import { toast } from 'sonner';
import { useSpringAuthStore } from '@/features/spring-auth';
import { useSandboxStore } from '@/core/sandbox';
import { useMetadataUiStore } from '@/features/metadata/store/use-metadata-ui-store';
import { useProfileStore } from '@/stores/profile-store';
import { createMockJwt } from '@/core/sandbox/handlers/auth-sandbox-handler';

/**
 * Cleanly exits an active Assume-Tenant impersonation sub-session:
 * 1. Purges ephemeral sub-session storage tokens & metadata.
 * 2. Restores sovereign SYSTEM tenant in sandbox and metadata UI stores.
 * 3. Restores ProfileStore to sovereign root profile.
 * 4. Regenerates sovereign root mock JWT in DEV mode.
 * 5. Redirects to sovereign custody cockpit or requested destination.
 */
export function exitAssumeTenantSubSession(redirectPath: string = '/system/tenants') {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('acc_assumed_tenant');
    localStorage.removeItem('acc_assumed_token');
    localStorage.removeItem('acc_assumed_tenant_name');
  }

  useSandboxStore.getState().setActiveTenant('SYSTEM');
  useMetadataUiStore.getState().setActiveTenant('SYSTEM', 'Sovereign Root System');
  useProfileStore.getState().syncAssumedTenant(null);

  if (import.meta.env.DEV) {
    const rootToken = createMockJwt({
      sub: 'custodian_root',
      username: 'custodian_root',
      roles: ['ROLE_SYSTEM_CUSTODIAN', 'ROLE_ADMIN', 'ROLE_USER'],
      tenantId: 'SYSTEM',
      isSandbox: true,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    });
    useSpringAuthStore.getState().setTokens(rootToken, 'mock_refresh_token_custodian');
  }

  toast.info('Exited Assume-Tenant session. Returned to Sovereign Root context (SYSTEM).');

  if (redirectPath) {
    window.location.href = redirectPath;
  }
}

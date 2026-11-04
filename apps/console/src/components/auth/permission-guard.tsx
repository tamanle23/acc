import * as React from 'react';
import type { CanonicalPermission } from '@acc/client';
import { useHasPermission } from '@/features/system/hooks/use-has-permission';
import { CANONICAL_PERMISSION_ATOMS } from '@/features/system/types/rbac-matrix-types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const CLEARANCE_NAME_MAP: Record<string, string> = {
  Community: 'Community Member',
  Standard: 'Standard Member',
  Operations: 'Operations Manager',
  'Workspace Owner': 'Workspace Owner',
  Auditor: 'Auditor',
  'Sovereign Tier 1': 'Sovereign Tier 1',
  'Sovereign Tier 2': 'Sovereign Tier 2',
  'Sovereign Tier 3': 'Sovereign Tier 3',
  'Sovereign Tier 4': 'Sovereign Tier 4',
};

export function getRequiredClearanceText(
  permission: CanonicalPermission | CanonicalPermission[] | string | string[]
): string {
  const codes = Array.isArray(permission) ? permission : [permission];
  const clearances = new Set<string>();

  for (const code of codes) {
    const found = CANONICAL_PERMISSION_ATOMS.find((a) => a.key === code);
    if (found?.clearanceTier) {
      clearances.add(CLEARANCE_NAME_MAP[found.clearanceTier] || found.clearanceTier);
    }
  }

  if (clearances.size === 0) {
    return 'Elevated';
  }

  return Array.from(clearances).join(' or ');
}

export interface PermissionGuardProps {
  permission: CanonicalPermission | CanonicalPermission[] | string | string[];
  mode?: 'all' | 'any';
  behavior?: 'disable' | 'hide';
  fallback?: React.ReactNode;
  tooltipText?: string;
  className?: string;
  children: React.ReactNode;
}

export function PermissionGuard({
  permission,
  mode = 'all',
  behavior = 'disable',
  fallback = null,
  tooltipText,
  className,
  children,
}: PermissionGuardProps) {
  const isPermitted = useHasPermission(permission, mode);

  if (isPermitted) {
    return <>{children}</>;
  }

  if (behavior === 'hide') {
    return <>{fallback}</>;
  }

  const clearance = getRequiredClearanceText(permission);
  const message = tooltipText || `Requires ${clearance} clearance`;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className={cn('inline-flex cursor-not-allowed', className)}
            aria-disabled="true"
          >
            {React.isValidElement(children)
              ? React.cloneElement(
                  children as React.ReactElement<{
                    disabled?: boolean;
                    'aria-disabled'?: boolean;
                    className?: string;
                  }>,
                  {
                    disabled: true,
                    'aria-disabled': true,
                    className: cn(
                      (children.props as any)?.className,
                      'pointer-events-none opacity-50'
                    ),
                  }
                )
              : children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs font-medium">
          {message}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

import * as React from 'react';
import type { CanonicalPermission } from '@acc/client';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useHasPermission } from '@/features/system/hooks/use-has-permission';
import { getRequiredClearanceText } from './permission-guard';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface AuthorizedDropdownMenuItemProps
  extends React.ComponentProps<typeof DropdownMenuItem> {
  permission: CanonicalPermission | CanonicalPermission[] | string | string[];
  mode?: 'all' | 'any';
  behavior?: 'disable' | 'hide';
  unauthorizedTooltip?: string;
  wrapperClassName?: string;
}

export const AuthorizedDropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuItem>,
  AuthorizedDropdownMenuItemProps
>(
  (
    {
      permission,
      mode = 'all',
      behavior = 'disable',
      unauthorizedTooltip,
      wrapperClassName,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isPermitted = useHasPermission(permission, mode);

    if (!isPermitted && behavior === 'hide') {
      return null;
    }

    if (!isPermitted) {
      const clearance = getRequiredClearanceText(permission);
      const message = unauthorizedTooltip || `Requires ${clearance} clearance`;

      return (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                className={cn('flex w-full cursor-not-allowed', wrapperClassName)}
                aria-disabled="true"
              >
                <DropdownMenuItem
                  {...props}
                  ref={ref}
                  disabled={true}
                  aria-disabled="true"
                  className={cn(className, 'w-full pointer-events-none opacity-50 cursor-not-allowed')}
                >
                  {children}
                </DropdownMenuItem>
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs font-medium z-50">
              {message}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <DropdownMenuItem {...props} ref={ref} disabled={disabled} className={className}>
        {children}
      </DropdownMenuItem>
    );
  }
);

AuthorizedDropdownMenuItem.displayName = 'AuthorizedDropdownMenuItem';

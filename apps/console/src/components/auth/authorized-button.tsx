import * as React from 'react';
import type { CanonicalPermission } from '@acc/client';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useHasPermission } from '@/features/system/hooks/use-has-permission';
import { getRequiredClearanceText } from './permission-guard';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface AuthorizedButtonProps extends ButtonProps {
  permission: CanonicalPermission | CanonicalPermission[] | string | string[];
  mode?: 'all' | 'any';
  behavior?: 'disable' | 'hide';
  unauthorizedTooltip?: string;
  wrapperClassName?: string;
}

export const AuthorizedButton = React.forwardRef<HTMLButtonElement, AuthorizedButtonProps>(
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
                className={cn('inline-flex cursor-not-allowed', wrapperClassName)}
                aria-disabled="true"
              >
                <Button
                  {...props}
                  ref={ref}
                  disabled={true}
                  aria-disabled="true"
                  className={cn(className, 'pointer-events-none opacity-50')}
                >
                  {children}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs font-medium">
              {message}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <Button {...props} ref={ref} disabled={disabled} className={className}>
        {children}
      </Button>
    );
  }
);

AuthorizedButton.displayName = 'AuthorizedButton';

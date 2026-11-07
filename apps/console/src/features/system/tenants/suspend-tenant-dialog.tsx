import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthorizedButton } from '@/components/auth';
import { ShieldAlert, Loader2 } from 'lucide-react';
import {
  useUpdateTenantStatus,
  type FleetTenantSummary,
  type SovereignTenantStatus,
} from '../api/use-system-fleet';

interface SuspendTenantDialogProps {
  tenant: FleetTenantSummary | null;
  targetStatus: SovereignTenantStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SuspendTenantDialog({
  tenant,
  targetStatus,
  open,
  onOpenChange,
}: SuspendTenantDialogProps) {
  const [reason, setReason] = useState('');
  const updateStatusMutation = useUpdateTenantStatus();

  if (!tenant) return null;

  const isSuspending = targetStatus === 'SUSPENDED';

  const handleConfirm = () => {
    if (!reason.trim()) return;

    updateStatusMutation.mutate(
      {
        tenantId: tenant.tenantId,
        status: targetStatus,
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setReason('');
        },
      }
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md bg-background/95 backdrop-blur-2xl border-white/20 dark:border-white/10 shadow-2xl">
        <AlertDialogHeader className="gap-1">
          <div className="flex items-center gap-2 text-destructive font-semibold text-xs uppercase tracking-wider">
            <ShieldAlert className="h-4 w-4" />
            <span>Emergency Kill-Switch</span>
          </div>
          <AlertDialogTitle className="text-xl">
            {isSuspending ? 'Suspend Organization' : 'Restore Organization'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isSuspending ? (
              <>
                You are about to soft-suspend{' '}
                <strong className="text-foreground">{tenant.name}</strong> ({tenant.tenantId}). All active
                connections and API mutations will immediately receive HTTP 403 Forbidden.
              </>
            ) : (
              <>
                Restore organization{' '}
                <strong className="text-foreground">{tenant.name}</strong> ({tenant.tenantId}) to{' '}
                <code>ACTIVE</code> state.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-2 space-y-2">
          <Label htmlFor="suspend-reason" className="text-xs font-medium">
            Mandatory Audit Log Reason:
          </Label>
          <Input
            id="suspend-reason"
            placeholder={
              isSuspending
                ? 'e.g. Delinquent billing arrears or suspicious egress'
                : 'e.g. Account reinstated after payment'
            }
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="bg-muted/30"
          />
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel onClick={() => onOpenChange(false)}>Cancel</AlertDialogCancel>
          <AuthorizedButton
            permission="platform:fleet:mutate"
            onClick={handleConfirm}
            disabled={!reason.trim() || updateStatusMutation.isPending}
            className={
              isSuspending
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md shadow-destructive/20'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }
          >
            {updateStatusMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin me-1.5" />
                Executing...
              </>
            ) : isSuspending ? (
              'Confirm Suspension'
            ) : (
              'Reactivate Tenant'
            )}
          </AuthorizedButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

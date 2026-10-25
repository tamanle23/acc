import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Eye,
  Lock,
  Unlock,
  UserCheck,
  CheckCircle2,
  Globe,
  Building2,
  Fingerprint,
} from 'lucide-react';
import type { GlobalUserListItem } from '../api/use-system-fleet';

interface GetUserMembershipColumnsProps {
  onInspect: (user: GlobalUserListItem) => void;
  onDelegate: (user: GlobalUserListItem) => void;
  onOpenLockDialog: (user: GlobalUserListItem) => void;
}

export function getUserMembershipColumns({
  onInspect,
  onDelegate,
  onOpenLockDialog,
}: GetUserMembershipColumnsProps): ColumnDef<GlobalUserListItem>[] {
  return [
    {
      accessorKey: 'displayName',
      header: 'User Account & Credentials',
      cell: ({ row }) => {
        const u = row.original;
        const isCustodian = u.tenantId === 'SYSTEM';
        return (
          <div className="grid gap-0.5">
            <span className="font-semibold text-sm flex items-center gap-1.5">
              {u.displayName}
              {isCustodian && (
                <Badge variant="default" className="text-[10px] px-1 py-0 h-4">
                  ROOT
                </Badge>
              )}
            </span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{u.username}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {u.email}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'tenantId',
      header: 'Assigned Tenant',
      cell: ({ row }) => {
        const u = row.original;
        const isCustodian = u.tenantId === 'SYSTEM';
        return (
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <Badge
              variant="outline"
              className={
                isCustodian
                  ? 'border-indigo-500/40 text-indigo-700 dark:text-indigo-400 bg-indigo-500/10'
                  : 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
              }
            >
              {isCustodian ? (
                <>
                  <Globe className="h-2.5 w-2.5 mr-1" /> SYSTEM
                </>
              ) : (
                <>
                  <Building2 className="h-2.5 w-2.5 mr-1" /> {u.tenantId}
                </>
              )}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: 'roles',
      header: 'RBAC Roles',
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex flex-wrap gap-1">
            {u.roles.map((r) => (
              <Badge key={r} variant="outline" className="text-[10px] font-mono">
                {r.replace('ROLE_', '')}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Status & Telemetry',
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex items-center gap-2">
            <Badge
              variant={u.locked ? 'destructive' : 'secondary'}
              className="text-[10px] uppercase font-mono"
            >
              {u.locked ? 'LOCKED' : 'ACTIVE'}
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] gap-1 text-sky-700 dark:text-sky-400 border-sky-500/30 bg-sky-500/10"
            >
              <Fingerprint className="h-2.5 w-2.5" /> FIDO2 Passkey
            </Badge>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: () => <div className="text-end">Actions</div>,
      cell: ({ row }) => {
        const u = row.original;
        const isCustodian = u.tenantId === 'SYSTEM';
        return (
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onInspect(u)}
              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
              title="Inspect user details and security telemetry"
              aria-label={`Inspect user ${u.username}`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Inspect</span>
            </Button>

            {!isCustodian && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelegate(u)}
                className="h-7 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/10"
                aria-label={`Delegate roles to user ${u.username}`}
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Delegate</span>
              </Button>
            )}

            {!isCustodian ? (
              <Button
                size="sm"
                variant={u.locked ? 'outline' : 'destructive'}
                onClick={() => onOpenLockDialog(u)}
                className="h-7 text-xs gap-1.5"
                aria-label={u.locked ? `Unlock account for user ${u.username}` : `Lockout user ${u.username}`}
              >
                {u.locked ? (
                  <>
                    <Unlock className="h-3.5 w-3.5" />
                    Unlock
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    Lockout
                  </>
                )}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground italic font-mono px-2">Sovereign Root</span>
            )}
          </div>
        );
      },
    },
  ];
}

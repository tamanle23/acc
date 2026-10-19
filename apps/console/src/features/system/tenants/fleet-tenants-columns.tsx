import { type ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Building2,
  Sliders,
  CreditCard,
  UserCheck,
  MoreVertical,
  PowerOff,
  Power,
  Activity,
  HardDrive,
  Database,
  Layers,
  UsersIcon,
} from 'lucide-react';
import { type FleetTenantSummary } from '../api/use-system-fleet';
import { DataTableColumnHeader } from '@/components/data-table/column-header';

interface FleetTenantsColumnsOptions {
  onAssumeTenant: (tenant: FleetTenantSummary) => void;
  onOpenWorkspaces: (tenant: FleetTenantSummary) => void;
  onOpenUsers: (tenant: FleetTenantSummary) => void;
  onOpenSubscription: (tenant: FleetTenantSummary) => void;
  onOpenQuotas: (tenant: FleetTenantSummary) => void;
  onToggleSuspend: (tenant: FleetTenantSummary) => void;
}

export function getFleetTenantsColumns({
  onAssumeTenant,
  onOpenWorkspaces,
  onOpenUsers,
  onOpenSubscription,
  onOpenQuotas,
  onToggleSuspend,
}: FleetTenantsColumnsOptions): ColumnDef<FleetTenantSummary>[] {
  return [
    {
      accessorKey: 'name',
      id: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tenant Organization" />
      ),
      cell: ({ row }) => {
        const tenant = row.original;
        const isSystem = tenant.tenantId === 'SYSTEM';

        return (
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                isSystem
                  ? 'bg-primary/15 border-primary/30 text-primary'
                  : 'bg-muted/40 border-white/20 dark:border-white/10 text-muted-foreground'
              }`}
            >
              <Building2 className="h-4 w-4" />
            </div>
            <div className="grid gap-0.5">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                {tenant.name}
                {isSystem && (
                  <Badge variant="default" className="text-[10px] px-1 py-0 h-4">
                    ROOT ME
                  </Badge>
                )}
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                {tenant.tenantId}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'tier',
      id: 'tier',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tier & Status" />
      ),
      cell: ({ row }) => {
        const tenant = row.original;
        return (
          <div className="flex flex-col gap-1 items-start">
            <Badge
              variant={
                tenant.tier === 'ENTERPRISE'
                  ? 'default'
                  : tenant.tier === 'PRO_MAX'
                  ? 'secondary'
                  : 'outline'
              }
              className="font-mono text-[10px]"
            >
              {tenant.tier}
            </Badge>
            <Badge
              variant={tenant.status === 'ACTIVE' ? 'outline' : 'destructive'}
              className="text-[10px] uppercase tracking-wider"
            >
              {tenant.status}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: 'workspacesCount',
      id: 'workspacesCount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Workspaces" />
      ),
      cell: ({ row }) => {
        const tenant = row.original;
        return (
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              {tenant.workspacesCount} /{' '}
              {tenant.maxWorkspaces === -1 ? (
                <span className="text-primary font-bold">∞</span>
              ) : (
                tenant.maxWorkspaces
              )}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'schemasCount',
      id: 'schemasCount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Schemas" />
      ),
      cell: ({ row }) => {
        const tenant = row.original;
        return (
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <Database className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              {tenant.schemasCount} /{' '}
              {tenant.maxSchemas === -1 ? (
                <span className="text-primary font-bold">∞</span>
              ) : (
                tenant.maxSchemas
              )}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'recordsCount',
      id: 'recordsCount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Records Quota" />
      ),
      cell: ({ row }) => {
        const tenant = row.original;
        return (
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              {tenant.recordsCount.toLocaleString()} /{' '}
              {tenant.maxRecords === -1 ? (
                <span className="text-primary font-bold">∞</span>
              ) : (
                tenant.maxRecords.toLocaleString()
              )}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'cpuUsagePercent',
      id: 'runtime',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Runtime Dial" />
      ),
      cell: ({ row }) => {
        const tenant = row.original;
        return (
          <div className="flex items-center gap-2 text-xs">
            <Activity className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
            <span className="font-mono">{tenant.cpuUsagePercent}% CPU</span>
            <span className="text-muted-foreground font-mono">
              {(tenant.storageBytes / (1024 * 1024)).toFixed(1)}MB
            </span>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const tenant = row.original;
        const isSystem = tenant.tenantId === 'SYSTEM';

        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Actions for tenant ${tenant.name}`}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-background/95 backdrop-blur-xl">
                <DropdownMenuLabel>Sovereign Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {!isSystem && (
                  <DropdownMenuItem
                    onClick={() => onAssumeTenant(tenant)}
                    className="gap-2 cursor-pointer text-amber-600 dark:text-amber-400 font-medium"
                  >
                    <UserCheck className="h-4 w-4" />
                    Assume Tenant
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem
                  onClick={() => onOpenWorkspaces(tenant)}
                  className="gap-2 cursor-pointer"
                >
                  <Layers className="h-4 w-4" />
                  Manage Workspaces
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onOpenUsers(tenant)}
                  className="gap-2 cursor-pointer"
                >
                  <UsersIcon className="h-4 w-4" />
                  Manage Users
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onOpenSubscription(tenant)}
                  className="gap-2 cursor-pointer"
                >
                  <CreditCard className="h-4 w-4" />
                  Edit Subscription
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onOpenQuotas(tenant)}
                  className="gap-2 cursor-pointer"
                >
                  <Sliders className="h-4 w-4" />
                  Tune Quotas (∞)
                </DropdownMenuItem>

                {!isSystem && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onToggleSuspend(tenant)}
                      className={`gap-2 cursor-pointer ${
                        tenant.status === 'ACTIVE' ? 'text-destructive' : 'text-emerald-600'
                      }`}
                    >
                      {tenant.status === 'ACTIVE' ? (
                        <>
                          <PowerOff className="h-4 w-4" />
                          Suspend Tenant
                        </>
                      ) : (
                        <>
                          <Power className="h-4 w-4" />
                          Reactivate Tenant
                        </>
                      )}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}

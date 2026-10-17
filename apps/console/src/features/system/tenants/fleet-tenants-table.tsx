import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ShieldAlert,
  Building2,
  Sliders,
  CreditCard,
  UserCheck,
  Search,
  MoreVertical,
  Plus,
  RefreshCw,
  PowerOff,
  Power,
  Activity,
  HardDrive,
  Database,
  Layers,
  Infinity as InfinityIcon,
  UsersIcon,
} from 'lucide-react';
import {
  useFleetTenants,
  useAssumeTenant,
  type FleetTenantSummary,
  type SovereignSubscriptionTier,
  type SovereignTenantStatus,
} from '../api/use-system-fleet';
import { CreateTenantModal } from './create-tenant-modal';
import { SubscriptionOverrideDrawer } from './subscription-override-drawer';
import { QuotaTuningDrawer } from './quota-tuning-drawer';
import { SuspendTenantDialog } from './suspend-tenant-dialog';
import { TenantWorkspacesDrawer } from './tenant-workspaces-drawer';
import { TenantUsersDrawer } from './tenant-users-drawer';
import { useDebounce } from '@/hooks/use-debounce';
import { useSandboxStore } from '@/core/sandbox';
import { useSpringAuthStore } from '@/features/spring-auth';
import { useMetadataUiStore } from '@/features/metadata/store/use-metadata-ui-store';
import { useProfileStore } from '@/stores/profile-store';
import { toast } from 'sonner';

export function FleetTenantsTable() {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals & Drawers state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<FleetTenantSummary | null>(null);
  const [subscriptionDrawerOpen, setSubscriptionDrawerOpen] = useState(false);
  const [quotaDrawerOpen, setQuotaDrawerOpen] = useState(false);
  const [workspacesDrawerOpen, setWorkspacesDrawerOpen] = useState(false);
  const [usersDrawerOpen, setUsersDrawerOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [targetSuspendStatus, setTargetSuspendStatus] = useState<SovereignTenantStatus>('SUSPENDED');

  // Performance optimization (⚡ Bolt): Debounce search query by 300ms to avoid firing queries
  // and re-rendering the fleet tenants data grid on every keypress.
  const debouncedSearch = useDebounce(search, 300);

  const { data: tenants = [], isLoading, refetch } = useFleetTenants(debouncedSearch, tierFilter, statusFilter);
  const assumeMutation = useAssumeTenant();

  const handleOpenSubscription = (tenant: FleetTenantSummary) => {
    setSelectedTenant(tenant);
    setSubscriptionDrawerOpen(true);
  };

  const handleOpenQuotas = (tenant: FleetTenantSummary) => {
    setSelectedTenant(tenant);
    setQuotaDrawerOpen(true);
  };

  const handleOpenWorkspaces = (tenant: FleetTenantSummary) => {
    setSelectedTenant(tenant);
    setWorkspacesDrawerOpen(true);
  };

  const handleOpenUsers = (tenant: FleetTenantSummary) => {
    setSelectedTenant(tenant);
    setUsersDrawerOpen(true);
  };

  const handleToggleSuspend = (tenant: FleetTenantSummary) => {
    setSelectedTenant(tenant);
    setTargetSuspendStatus(tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE');
    setSuspendDialogOpen(true);
  };

  const { setActiveTenant } = useSandboxStore();
  const { setActiveTenant: setMetadataTenant } = useMetadataUiStore();

  const handleAssumeTenant = (tenant: FleetTenantSummary) => {
    assumeMutation.mutate(
      { tenantId: tenant.tenantId, durationMinutes: 60 },
      {
        onSuccess: (res) => {
          localStorage.setItem('unipost_assumed_tenant', res.effectiveTenantId);
          localStorage.setItem('unipost_assumed_tenant_name', tenant.name);
          if (res.ephemeralToken) {
            localStorage.setItem('unipost_assumed_token', res.ephemeralToken);
            useSpringAuthStore.getState().setTokens(res.ephemeralToken, 'mock_refresh_token_custodian');
          }
          setActiveTenant(res.effectiveTenantId);
          setMetadataTenant(res.effectiveTenantId, tenant.name);
          useProfileStore.getState().syncAssumedTenant(res.effectiveTenantId, tenant.name);

          toast.success(`Assumed tenant '${tenant.name}' (${res.effectiveTenantId}). Navigating to organization workspace...`);
          window.location.href = '/metadata';
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Filter & Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl border border-white/20 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search fleet tenants or slugs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9 bg-background/50 border-white/20 dark:border-white/10"
            />
          </div>

          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger aria-label="Filter by subscription tier" className="w-[130px] bg-background/50 border-white/20 dark:border-white/10">
              <SelectValue placeholder="All Tiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Tiers</SelectItem>
              <SelectItem value="BASIC">Basic</SelectItem>
              <SelectItem value="PRO">Pro</SelectItem>
              <SelectItem value="PRO_MAX">Pro Max</SelectItem>
              <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Filter by tenant status" className="w-[130px] bg-background/50 border-white/20 dark:border-white/10">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-white/20 dark:border-white/10 bg-background/50"
          >
            <RefreshCw className="h-4 w-4 me-1.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="gap-1.5 shadow-md shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            Provision Tenant
          </Button>
        </div>
      </div>

      {/* Main Glass Table */}
      <div className="rounded-xl border border-white/20 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[260px]">Tenant Organization</TableHead>
              <TableHead>Tier & Status</TableHead>
              <TableHead>Workspaces</TableHead>
              <TableHead>Schemas</TableHead>
              <TableHead>Records Quota</TableHead>
              <TableHead>Runtime Dial</TableHead>
              <TableHead className="text-end">Sovereign Custody</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Querying fleet database across cluster...
                </TableCell>
              </TableRow>
            ) : tenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No tenants matching filter criteria.
                </TableCell>
              </TableRow>
            ) : (
              tenants.map((tenant) => {
                const isSystem = tenant.tenantId === 'SYSTEM';
                return (
                  <TableRow
                    key={tenant.tenantId}
                    className={isSystem ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/30'}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-lg border ${isSystem
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
                    </TableCell>

                    <TableCell>
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
                    </TableCell>

                    <TableCell>
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
                    </TableCell>

                    <TableCell>
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
                    </TableCell>

                    <TableCell>
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
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2 text-xs">
                        <Activity className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                        <span className="font-mono">{tenant.cpuUsagePercent}% CPU</span>
                        <span className="text-muted-foreground font-mono">
                          {(tenant.storageBytes / (1024 * 1024)).toFixed(1)}MB
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-background/95 backdrop-blur-xl">
                          <DropdownMenuLabel>Sovereign Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          {!isSystem && (
                            <DropdownMenuItem
                              onClick={() => handleAssumeTenant(tenant)}
                              className="gap-2 cursor-pointer text-amber-600 dark:text-amber-400 font-medium"
                            >
                              <UserCheck className="h-4 w-4" />
                              Assume Tenant
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem
                            onClick={() => handleOpenWorkspaces(tenant)}
                            className="gap-2 cursor-pointer"
                          >
                            <Layers className="h-4 w-4" />
                            Manage Workspaces
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => handleOpenUsers(tenant)}
                            className="gap-2 cursor-pointer"
                          >
                            <UsersIcon className="h-4 w-4" />
                            Manage Users
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => handleOpenSubscription(tenant)}
                            className="gap-2 cursor-pointer"
                          >
                            <CreditCard className="h-4 w-4" />
                            Edit Subscription
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => handleOpenQuotas(tenant)}
                            className="gap-2 cursor-pointer"
                          >
                            <Sliders className="h-4 w-4" />
                            Tune Quotas (∞)
                          </DropdownMenuItem>

                          {!isSystem && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleToggleSuspend(tenant)}
                                className={`gap-2 cursor-pointer ${tenant.status === 'ACTIVE' ? 'text-destructive' : 'text-emerald-600'
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
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Auxiliary Dialogs & Drawers */}
      <CreateTenantModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
      <SubscriptionOverrideDrawer
        tenant={selectedTenant}
        open={subscriptionDrawerOpen}
        onOpenChange={setSubscriptionDrawerOpen}
      />
      <QuotaTuningDrawer
        tenant={selectedTenant}
        open={quotaDrawerOpen}
        onOpenChange={setQuotaDrawerOpen}
      />
      <SuspendTenantDialog
        tenant={selectedTenant}
        targetStatus={targetSuspendStatus}
        open={suspendDialogOpen}
        onOpenChange={setSuspendDialogOpen}
      />
      <TenantWorkspacesDrawer
        tenant={selectedTenant}
        open={workspacesDrawerOpen}
        onOpenChange={setWorkspacesDrawerOpen}
      />
      <TenantUsersDrawer
        tenant={selectedTenant}
        open={usersDrawerOpen}
        onOpenChange={setUsersDrawerOpen}
      />
    </div>
  );
}

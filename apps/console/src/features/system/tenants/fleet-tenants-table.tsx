import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  RefreshCw,
} from 'lucide-react';
import {
  useFleetTenants,
  useAssumeTenant,
  type FleetTenantSummary,
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
import { DataTable } from '@/components/data-table/data-table';
import { DataTableToolbar } from '@/components/data-table/toolbar';
import { DataTablePagination } from '@/components/data-table/pagination';
import { getFleetTenantsColumns } from './fleet-tenants-columns';

export function FleetTenantsTable() {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sorting, setSorting] = useState<SortingState>([]);

  // Modals & Drawers state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<FleetTenantSummary | null>(null);
  const [subscriptionDrawerOpen, setSubscriptionDrawerOpen] = useState(false);
  const [quotaDrawerOpen, setQuotaDrawerOpen] = useState(false);
  const [workspacesDrawerOpen, setWorkspacesDrawerOpen] = useState(false);
  const [usersDrawerOpen, setUsersDrawerOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [targetSuspendStatus, setTargetSuspendStatus] = useState<SovereignTenantStatus>('SUSPENDED');

  const debouncedSearch = useDebounce(search, 300);

  const { data: tenants = [], isLoading, refetch } = useFleetTenants(debouncedSearch, tierFilter, statusFilter);
  const assumeMutation = useAssumeTenant();

  const { setActiveTenant } = useSandboxStore();
  const { setActiveTenant: setMetadataTenant } = useMetadataUiStore();

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

  const columns = useMemo(
    () =>
      getFleetTenantsColumns({
        onAssumeTenant: handleAssumeTenant,
        onOpenWorkspaces: handleOpenWorkspaces,
        onOpenUsers: handleOpenUsers,
        onOpenSubscription: handleOpenSubscription,
        onOpenQuotas: handleOpenQuotas,
        onToggleSuspend: handleToggleSuspend,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: tenants,
    columns,
    state: {
      sorting,
      globalFilter: search,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <div className="space-y-4">
      {/* Top Filter & Action Bar using standardized DataTableToolbar */}
      <DataTableToolbar
        table={table}
        searchPlaceholder="Search fleet tenants or slugs..."
        actions={
          <div className="flex items-center gap-2">
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger aria-label="Filter by subscription tier" className="w-[125px] h-8 text-xs bg-background/50 border-white/20 dark:border-white/10">
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
              <SelectTrigger aria-label="Filter by tenant status" className="w-[125px] h-8 text-xs bg-background/50 border-white/20 dark:border-white/10">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="h-8 border-white/20 dark:border-white/10 bg-background/50"
            >
              <RefreshCw className="h-3.5 w-3.5 me-1.5" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              className="h-8 gap-1.5 shadow-md shadow-primary/20 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Provision Tenant
            </Button>
          </div>
        }
      />

      {/* Main Standardized DataTable */}
      <DataTable
        table={table}
        noResultsMessage={
          isLoading
            ? 'Querying fleet database across cluster...'
            : 'No tenants matching filter criteria.'
        }
      />

      {/* Standardized DataTablePagination */}
      <DataTablePagination table={table} />

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

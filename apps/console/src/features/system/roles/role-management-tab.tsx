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
import { Input } from '@/components/ui/input';
import { Search, Plus } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/pagination';
import { useSystemRoles, useDeleteSystemRole } from '../api/use-system-fleet';
import { RoleDefinitionModal } from './role-definition-modal';
import { RoleInspectorDialog } from './role-inspector-dialog';
import { getRoleManagementColumns } from './role-management-columns';
import type { SandboxRoleWithPermissions } from '@/core/sandbox/handlers/system-sandbox-handler';
import type { RoleScope } from '../types/rbac-matrix-types';

export function RoleManagementTab() {
  const { data: roles = [], isLoading } = useSystemRoles();
  const deleteRoleMutation = useDeleteSystemRole();

  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | RoleScope>('ALL');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [inspectingRole, setInspectingRole] = useState<SandboxRoleWithPermissions | null>(null);

  const filteredRoles = useMemo(() => {
    return roles.filter((role) => {
      if (scopeFilter !== 'ALL' && role.roleScope !== scopeFilter) return false;
      if (search) {
        const query = search.toLowerCase();
        const matchName = role.roleName.toLowerCase().includes(query);
        const matchId = role.roleId.toLowerCase().includes(query);
        const matchDesc = role.description?.toLowerCase().includes(query);
        const matchTenant = role.tenantId?.toLowerCase().includes(query);
        if (!matchName && !matchId && !matchDesc && !matchTenant) return false;
      }
      return true;
    });
  }, [roles, search, scopeFilter]);

  const handleDelete = (role: SandboxRoleWithPermissions) => {
    if (role.systemRole) return;
    if (confirm(`Are you sure you want to delete role '${role.roleId}'? This action cannot be undone.`)) {
      deleteRoleMutation.mutate(role.roleId);
    }
  };

  const columns = useMemo(
    () =>
      getRoleManagementColumns({
        onInspect: (role) => setInspectingRole(role),
        onDelete: handleDelete,
      }),
    []
  );

  const table = useReactTable({
    data: filteredRoles,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Control Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter roles by key, name, or tenant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-background/60"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Scope Filter Segmented Buttons */}
          <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setScopeFilter('ALL')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                scopeFilter === 'ALL'
                  ? 'bg-background shadow-xs text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Roles ({roles.length})
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('TENANT')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                scopeFilter === 'TENANT'
                  ? 'bg-background shadow-xs text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Tenant Roles
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('SYSTEM')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                scopeFilter === 'SYSTEM'
                  ? 'bg-background shadow-xs text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sovereign Cluster
            </button>
          </div>

          <Button onClick={() => setCreateModalOpen(true)} size="sm" className="gap-1.5 h-9">
            <Plus className="h-4 w-4" />
            <span>Create Role</span>
          </Button>
        </div>
      </div>

      {/* Main Standardized DataTable */}
      <DataTable
        showRowIndex
        table={table}
        onRowClick={(role) => setInspectingRole(role)}
        noResultsMessage={
          isLoading
            ? 'Loading roles catalog...'
            : 'No roles match the selected filter criteria.'
        }
      />

      {/* Standardized Pagination */}
      <DataTablePagination table={table} />

      {/* Role Creation Modal */}
      <RoleDefinitionModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />

      {/* Role Inspector Dialog */}
      <RoleInspectorDialog
        role={inspectingRole}
        open={Boolean(inspectingRole)}
        onOpenChange={(open) => !open && setInspectingRole(null)}
      />
    </div>
  );
}

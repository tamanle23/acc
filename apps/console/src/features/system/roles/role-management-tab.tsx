import { useState, useMemo } from 'react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ShieldCheck,
  Search,
  Plus,
  MoreVertical,
  Eye,
  Trash2,
  Globe,
  Building2,
  Lock,
  Layers,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { useSystemRoles, useDeleteSystemRole } from '../api/use-system-fleet';
import { RoleDefinitionModal } from './role-definition-modal';
import { RoleInspectorDialog } from './role-inspector-dialog';
import type { SandboxRoleWithPermissions } from '@/core/sandbox/handlers/system-sandbox-handler';
import type { RoleScope } from '../types/rbac-matrix-types';

export function RoleManagementTab() {
  const { data: roles = [], isLoading } = useSystemRoles();
  const deleteRoleMutation = useDeleteSystemRole();

  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | RoleScope>('ALL');
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

      {/* Roles Catalog Table */}
      <div className="rounded-xl border border-white/20 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-muted/20">
              <TableHead className="font-semibold text-xs">Role Identifier</TableHead>
              <TableHead className="font-semibold text-xs">Scope & Custody</TableHead>
              <TableHead className="font-semibold text-xs">Minimum Tier</TableHead>
              <TableHead className="font-semibold text-xs text-center">Permissions</TableHead>
              <TableHead className="font-semibold text-xs text-center">Assigned Users</TableHead>
              <TableHead className="font-semibold text-xs text-right pr-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                  Loading roles catalog...
                </TableCell>
              </TableRow>
            ) : filteredRoles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                  No roles match the selected filter criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredRoles.map((role) => (
                <TableRow
                  key={role.roleId}
                  className="hover:bg-muted/30 transition-colors cursor-pointer group"
                  onClick={() => setInspectingRole(role)}
                >
                  <TableCell className="font-mono text-xs">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <span>{role.roleId}</span>
                        {role.systemRole && (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5 gap-0.5">
                            <Lock className="h-2.5 w-2.5" /> Core
                          </Badge>
                        )}
                      </div>
                      <span className="font-sans text-xs text-muted-foreground">
                        {role.roleName}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono ${
                          role.roleScope === 'SYSTEM'
                            ? 'border-indigo-500/40 text-indigo-700 dark:text-indigo-400 bg-indigo-500/10'
                            : 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
                        }`}
                      >
                        {role.roleScope === 'SYSTEM' ? (
                          <>
                            <Globe className="h-2.5 w-2.5 mr-1" /> Sovereign
                          </>
                        ) : (
                          <>
                            <Building2 className="h-2.5 w-2.5 mr-1" /> {role.tenantId || 'TENANT'}
                          </>
                        )}
                      </Badge>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {role.minPlanTier || 'COMMUNITY'}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-center font-mono text-xs">
                    <Badge variant="secondary" className="text-[10px]">
                      {role.permissions?.length || 0} atoms
                    </Badge>
                  </TableCell>

                  <TableCell className="text-center font-mono text-xs">
                    <span className="text-muted-foreground">{role.userCount || 0}</span>
                  </TableCell>

                  <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 text-xs">
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer"
                          onClick={() => setInspectingRole(role)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Inspect Atoms</span>
                        </DropdownMenuItem>
                        {!role.systemRole && (
                          <DropdownMenuItem
                            className="gap-2 text-destructive cursor-pointer"
                            onClick={() => handleDelete(role)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete Role</span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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

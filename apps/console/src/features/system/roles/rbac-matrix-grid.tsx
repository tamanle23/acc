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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Search,
  RotateCcw,
  Sparkles,
  Lock,
  Info,
  PlusCircle,
  Building2,
  Globe,
  Layers,
  Check,
  Shield,
  Loader2,
} from 'lucide-react';
import { RoleDefinitionModal } from './role-definition-modal';
import {
  useSystemRoles,
  useUpdateRolePermissions,
  type SystemRoleWithPermissions,
} from '../api/use-system-fleet';
import {
  CANONICAL_PERMISSIONS,
  SECURITY_PLANES,
  type RoleScope,
  type SecurityPlane,
} from '../types/rbac-matrix-types';

export function RbacMatrixGrid() {
  const [search, setSearch] = useState('');
  const [selectedPlane, setSelectedPlane] = useState<'ALL' | SecurityPlane>('ALL');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | RoleScope>('ALL');
  const [createRoleOpen, setCreateRoleOpen] = useState(false);

  const { data: roles = [], isLoading } = useSystemRoles();
  const updateRoleMutation = useUpdateRolePermissions();

  const [activeRoleChanges, setActiveRoleChanges] = useState<Record<string, string[]>>({});

  // Optimization: Map index roles by roleId
  const roleMap = useMemo(() => new Map(roles.map((r) => [r.roleId, r])), [roles]);

  // Filter visible roles based on Scope Switcher (Tenant vs Sovereign)
  const visibleRoles = useMemo(() => {
    if (scopeFilter === 'ALL') return roles;
    return roles.filter((r) => r.roleScope === scopeFilter);
  }, [roles, scopeFilter]);

  // Filter permission atoms based on Search and Security Plane
  const filteredPerms = useMemo(() => {
    const query = search.toLowerCase();
    return CANONICAL_PERMISSIONS.filter((p) => {
      if (selectedPlane !== 'ALL' && p.plane !== selectedPlane) return false;
      if (query) {
        const matchCode = p.code.toLowerCase().includes(query);
        const matchLabel = p.label.toLowerCase().includes(query);
        const matchDesc = p.description.toLowerCase().includes(query);
        if (!matchCode && !matchLabel && !matchDesc) return false;
      }
      return true;
    });
  }, [search, selectedPlane]);

  const handleToggle = (roleId: string, permCode: string) => {
    const role = roleMap.get(roleId);
    if (!role) return;

    const currentPerms = activeRoleChanges[roleId] ?? role.permissions;
    const hasPerm = currentPerms.includes(permCode);
    const updated = hasPerm
      ? currentPerms.filter((p) => p !== permCode)
      : [...currentPerms, permCode];

    setActiveRoleChanges((prev) => ({
      ...prev,
      [roleId]: updated,
    }));
  };

  const handleCommitRole = (role: SystemRoleWithPermissions) => {
    const permissions = activeRoleChanges[role.roleId];
    if (!permissions) return;

    updateRoleMutation.mutate(
      {
        roleId: role.roleId,
        permissions,
        reason: 'Sovereign matrix interactive update',
      },
      {
        onSuccess: () => {
          setActiveRoleChanges((prev) => {
            const next = { ...prev };
            delete next[role.roleId];
            return next;
          });
        },
      }
    );
  };

  const handleCommitAll = () => {
    const roleIds = Object.keys(activeRoleChanges);
    roleIds.forEach((roleId) => {
      const role = roleMap.get(roleId);
      if (role) handleCommitRole(role);
    });
  };

  const stagedCount = Object.keys(activeRoleChanges).length;

  return (
    <div className="space-y-4">
      {/* Control Strip */}
      <div className="flex flex-col gap-3 p-4 rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="flex items-center gap-2 max-w-sm flex-1">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search 35 permission atoms..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 bg-background/60"
              />
            </div>
          </div>

          {/* Scope Segmented Switcher & Create Role */}
          <div className="flex items-center gap-2">
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
                All Scopes
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('TENANT')}
                className={`flex items-center gap-1 px-3 py-1 rounded-md font-medium transition-all ${
                  scopeFilter === 'TENANT'
                    ? 'bg-background shadow-xs text-emerald-700 dark:text-emerald-400 font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Building2 className="h-3 w-3" /> Tenant Matrix
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('SYSTEM')}
                className={`flex items-center gap-1 px-3 py-1 rounded-md font-medium transition-all ${
                  scopeFilter === 'SYSTEM'
                    ? 'bg-background shadow-xs text-indigo-700 dark:text-indigo-400 font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Globe className="h-3 w-3" /> Sovereign Matrix
              </button>
            </div>

            <Button
              size="sm"
              onClick={() => setCreateRoleOpen(true)}
              className="gap-1.5 h-9"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create Role</span>
            </Button>
          </div>
        </div>

        {/* Security Plane Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setSelectedPlane('ALL')}
            className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${
              selectedPlane === 'ALL'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background/50 border-border hover:bg-muted/50 text-muted-foreground'
            }`}
          >
            All Planes (35)
          </button>
          {SECURITY_PLANES.map((plane) => {
            const count = CANONICAL_PERMISSIONS.filter((p) => p.plane === plane.id).length;
            const isSelected = selectedPlane === plane.id;
            return (
              <button
                key={plane.id}
                type="button"
                onClick={() => setSelectedPlane(plane.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background/50 border-border hover:bg-muted/50 text-muted-foreground'
                }`}
              >
                <span className="font-semibold">{plane.label}</span>
                <span
                  className={`text-[10px] px-1 rounded ${
                    isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Sticky Glass Matrix Grid */}
      <div className="rounded-xl border border-white/20 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-x-auto max-h-[650px] relative">
        <Table className="border-collapse">
          <TableHeader className="sticky top-0 z-20 bg-background/95 backdrop-blur-md shadow-xs">
            <TableRow>
              <TableHead className="sticky left-0 z-30 bg-background/95 backdrop-blur-md w-[320px] min-w-[280px] font-semibold text-xs border-r">
                Permission Atom & Security Plane
              </TableHead>
              {visibleRoles.map((role) => (
                <TableHead key={role.roleId} className="text-center min-w-[150px] px-3 py-2 border-r last:border-r-0">
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1 font-semibold text-xs font-mono">
                      <span>{role.roleId}</span>
                      {role.systemRole && <Lock className="h-3 w-3 text-muted-foreground" />}
                    </div>
                    <span className="font-sans text-[11px] text-muted-foreground line-clamp-1">
                      {role.roleName}
                    </span>
                    <div className="flex items-center gap-1">
                      <Badge
                        variant="outline"
                        className={`text-[9px] font-mono px-1 py-0 ${
                          role.roleScope === 'SYSTEM'
                            ? 'border-indigo-500/40 text-indigo-700 dark:text-indigo-400 bg-indigo-500/10'
                            : 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
                        }`}
                      >
                        {role.roleScope === 'SYSTEM' ? 'SOVEREIGN' : 'TENANT'}
                      </Badge>
                      <Badge variant="secondary" className="text-[9px] font-mono px-1 py-0">
                        {role.userCount || 0} users
                      </Badge>
                    </div>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={1 + visibleRoles.length}
                  className="h-40 text-center text-muted-foreground"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading canonical RBAC matrix and DAG permissions...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredPerms.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={1 + visibleRoles.length}
                  className="h-32 text-center text-muted-foreground text-xs"
                >
                  No permission atoms match your search or filter.
                </TableCell>
              </TableRow>
            ) : (
              filteredPerms.map((atom) => {
                const planeInfo = SECURITY_PLANES.find((p) => p.id === atom.plane);

                return (
                  <TableRow key={atom.code} className="hover:bg-muted/30 transition-colors">
                    {/* Sticky Left Column: Permission Atom */}
                    <TableCell className="sticky left-0 z-10 bg-background/95 backdrop-blur-md border-r p-3">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold ${planeInfo?.color}`}
                        >
                          <Shield className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-foreground">
                              {atom.code}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] py-0 px-1 border-opacity-40 ${planeInfo?.color}`}
                            >
                              {planeInfo?.label}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-muted-foreground truncate max-w-[260px]">
                            {atom.label} &mdash; {atom.description}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Role Checkbox Cells */}
                    {visibleRoles.map((role) => {
                      const currentPerms = activeRoleChanges[role.roleId] ?? role.permissions;
                      const isChecked = currentPerms.includes(atom.code);
                      const isInherited =
                        role.inheritedRoles?.some((inherited) =>
                          roleMap.get(inherited)?.permissions.includes(atom.code)
                        ) ?? false;

                      return (
                        <TableCell
                          key={role.roleId}
                          className="text-center border-r last:border-r-0 py-2"
                        >
                          <div className="flex justify-center items-center">
                            <Checkbox
                              checked={isChecked || isInherited}
                              disabled={isInherited}
                              onCheckedChange={() => handleToggle(role.roleId, atom.code)}
                              className={isInherited ? 'opacity-50 cursor-not-allowed' : ''}
                              aria-label={`Toggle ${atom.code} for ${role.roleId}`}
                            />
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Floating Staged Commit Strip */}
      {stagedCount > 0 && (
        <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl animate-in fade-in">
          <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
            <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
            <span>
              <strong>{stagedCount}</strong> role{stagedCount > 1 ? 's have' : ' has'} staged
              modifications pending commit.
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveRoleChanges({})}
              className="text-xs h-8"
            >
              <RotateCcw className="h-3 w-3 me-1" />
              Discard All
            </Button>
            <Button
              size="sm"
              onClick={handleCommitAll}
              disabled={updateRoleMutation.isPending}
              className="text-xs h-8 gap-1.5"
            >
              {updateRoleMutation.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-3 w-3" />
                  Commit Changes ({stagedCount})
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      <RoleDefinitionModal
        open={createRoleOpen}
        onOpenChange={setCreateRoleOpen}
      />
    </div>
  );
}

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
  UserKey,
} from 'lucide-react';
import { RoleDefinitionModal } from './role-definition-modal';
import {
  useSystemRoles,
  useUpdateRolePermissions,
  type SystemRoleWithPermissions,
} from '../api/use-system-fleet';

const PERMISSION_ATOMS = [
  { key: 'platform:fleet:read', category: 'Fleet', label: 'View Fleet Diagnostics & Telemetry' },
  { key: 'platform:fleet:mutate', category: 'Fleet', label: 'Provision, Suspend & Edit Fleet' },
  { key: 'platform:tenant:assume', category: 'Fleet', label: 'Assume-Tenant Impersonation' },
  { key: 'platform:quotas:override', category: 'Fleet', label: 'Sovereign Quota Overrides (∞)' },
  { key: 'platform:roles:manage', category: 'Governance', label: 'Manage RBAC Matrix & Policies' },
  { key: 'platform:users:lock', category: 'Governance', label: 'Universal User Credential Lock' },
  { key: 'METADATA_SCHEMA_READ', category: 'Metadata', label: 'Schema Read & Inspect Definitions' },
  { key: 'METADATA_SCHEMA_WRITE', category: 'Metadata', label: 'Schema Studio Mutate / Canonical' },
  { key: 'METADATA_RECORD_READ', category: 'Data Plane', label: 'Entity Record Data Read' },
  { key: 'METADATA_RECORD_WRITE', category: 'Data Plane', label: 'Entity Record Data Mutation' },
  { key: 'TENANT_SETTINGS_MANAGE', category: 'Tenant', label: 'Organization Settings Manage' },
  { key: 'BILLING_MANAGE', category: 'Tenant', label: 'Billing & payOS VietQR Checkout' },
];

export function RbacMatrixGrid() {
  const [search, setSearch] = useState('');
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const { data: roles = [], isLoading } = useSystemRoles();
  const updateRoleMutation = useUpdateRolePermissions();

  const [activeRoleChanges, setActiveRoleChanges] = useState<Record<string, string[]>>({});

  // Optimization: Pre-index roles by roleId into a Map in O(M) time to convert inner loop
  // role lookups from O(M) array scans to O(1) constant time hash accesses.
  const roleMap = useMemo(() => new Map(roles.map((r) => [r.roleId, r])), [roles]);

  const handleToggle = (roleId: string, permKey: string) => {
    const role = roleMap.get(roleId);
    if (!role) return;

    const currentPerms = activeRoleChanges[roleId] ?? role.permissions;
    const hasPerm = currentPerms.includes(permKey);
    const updated = hasPerm
      ? currentPerms.filter((p) => p !== permKey)
      : [...currentPerms, permKey];

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

  // Optimization: Memoize search-filtered permission atoms to prevent redundant array filtering
  // on unrelated component re-renders (such as role modification staging).
  const filteredPerms = useMemo(() => {
    const query = search.toLowerCase();
    return PERMISSION_ATOMS.filter(
      (p) =>
        p.label.toLowerCase().includes(query) ||
        p.key.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
    );
  }, [search]);

  return (
    <div className="space-y-4">
      {/* Matrix Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl border border-white/20 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg">
        <div className="flex items-center gap-2 max-w-sm flex-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search permissions or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-background/50 border-white/20 dark:border-white/10"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4 text-primary" />
            <span>Interactive Sovereign RBAC Matrix. Changes are staged per role.</span>
          </div>

          <Button
            size="sm"
            onClick={() => setCreateRoleOpen(true)}
            className="gap-1.5 shadow-md"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Create Custom Role</span>
          </Button>
        </div>
      </div>

      {/* Main Glass Matrix Grid */}
      <div className="rounded-xl border border-white/20 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[300px]">Permission Atom</TableHead>
              <TableHead className="w-[120px]">Category</TableHead>
              {roles.map((role) => (
                <TableHead key={role.roleId} className="text-center min-w-[140px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-semibold text-xs flex items-center gap-1">
                      {role.roleName}
                      {role.systemRole && <Lock className="h-3 w-3 text-muted-foreground" />}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {role.userCount} users
                    </Badge>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={2 + roles.length} className="h-32 text-center text-muted-foreground">
                  Loading sovereign roles & permission graph...
                </TableCell>
              </TableRow>
            ) : (
              filteredPerms.map((atom) => (
                <TableRow key={atom.key} className="hover:bg-muted/30">
                  <TableCell className="flex items-center gap-2.5">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg border`}>
                      <UserKey className="h-4 w-4" />
                    </div>
                    <div className="grid gap-0.5">
                      <span className="text-sm font-medium">{atom.label}</span>
                      <code className="text-[11px] text-muted-foreground font-mono">{atom.key}</code>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {atom.category}
                    </Badge>
                  </TableCell>

                  {roles.map((role) => {
                    const currentPerms = activeRoleChanges[role.roleId] ?? role.permissions;
                    const isChecked = currentPerms.includes(atom.key);
                    // Optimization: Use O(1) roleMap lookup instead of O(M) array search inside the nested render loop.
                    const isInherited =
                      role.inheritedRoles?.some((inherited) =>
                        roleMap.get(inherited)?.permissions.includes(atom.key)
                      ) ?? false;

                    return (
                      <TableCell key={role.roleId} className="text-center">
                        <div className="flex justify-center items-center">
                          <Checkbox
                            checked={isChecked || isInherited}
                            disabled={isInherited}
                            onCheckedChange={() => handleToggle(role.roleId, atom.key)}
                            className={isInherited ? 'opacity-60 cursor-not-allowed' : ''}
                          />
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Role Commit Bar */}
      {Object.keys(activeRoleChanges).length > 0 && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-xl flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-200">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Unsaved role matrix modifications staged for commit.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveRoleChanges({})}
              className="text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 me-1" />
              Discard
            </Button>
            {roles
              .filter((r) => activeRoleChanges[r.roleId])
              .map((r) => (
                <Button
                  key={r.roleId}
                  size="sm"
                  onClick={() => handleCommitRole(r)}
                  disabled={updateRoleMutation.isPending}
                  className="text-xs gap-1.5"
                >
                  Save {r.roleName}
                </Button>
              ))}
          </div>
        </div>
      )}

      <RoleDefinitionModal
        open={createRoleOpen}
        onOpenChange={setCreateRoleOpen}
      />
    </div>
  );
}

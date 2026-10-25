import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldAlert, UserCheck, AlertCircle, Plus, Trash2, Loader2 } from 'lucide-react';
import { useDelegateUserRoles, useSystemRoles } from '../api/use-system-fleet';
import { CANONICAL_PERMISSIONS } from '../types/rbac-matrix-types';
import type { SandboxGlobalUser } from '@/core/sandbox/handlers/system-sandbox-handler';

interface TenantRoleDelegationModalProps {
  user: SandboxGlobalUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAdminRoles?: string[];
}

export function TenantRoleDelegationModal({
  user,
  open,
  onOpenChange,
  currentAdminRoles = ['ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER', 'ROLE_INTEGRATION_SVC'],
}: TenantRoleDelegationModalProps) {
  const { data: allRoles = [] } = useSystemRoles();
  const delegateMutation = useDelegateUserRoles();

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [reason, setReason] = useState('Delegated administrative privileges via Security Studio');
  const [permissionOverrides, setPermissionOverrides] = useState<
    { permissionCode: string; isGranted: boolean; reason: string }[]
  >([]);
  const [newOverrideCode, setNewOverrideCode] = useState('');
  const [newOverrideGranted, setNewOverrideGranted] = useState(true);

  // Sync state when modal opens
  const handleOpen = (nextOpen: boolean) => {
    if (nextOpen && user) {
      setSelectedRoles(user.roles || []);
      setPermissionOverrides([]);
    }
    onOpenChange(nextOpen);
  };

  if (!user) return null;

  // Filter delegatable roles: Only Tenant-scoped roles and only roles that current admin holds (ceiling)
  const delegatableRoles = allRoles.filter((r) => {
    if (r.roleScope === 'SYSTEM') return false; // Sovereign quarantine
    return currentAdminRoles.includes(r.roleId); // Delegation ceiling
  });

  const toggleRole = (roleId: string) => {
    if (selectedRoles.includes(roleId)) {
      setSelectedRoles(selectedRoles.filter((id) => id !== roleId));
    } else {
      setSelectedRoles([...selectedRoles, roleId]);
    }
  };

  const addOverride = () => {
    if (!newOverrideCode) return;
    if (permissionOverrides.some((o) => o.permissionCode === newOverrideCode)) return;

    setPermissionOverrides([
      ...permissionOverrides,
      {
        permissionCode: newOverrideCode,
        isGranted: newOverrideGranted,
        reason: 'Specific ad-hoc override',
      },
    ]);
    setNewOverrideCode('');
  };

  const removeOverride = (code: string) => {
    setPermissionOverrides(permissionOverrides.filter((o) => o.permissionCode !== code));
  };

  const handleSave = () => {
    delegateMutation.mutate(
      {
        tenantId: user.tenantId,
        userId: user.userId,
        payload: {
          roles: selectedRoles,
          permissionOverrides,
          reason,
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col bg-background/95 backdrop-blur-2xl border-white/20 dark:border-white/10 shadow-2xl">
        <DialogHeader className="gap-1 border-b pb-3">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
            <UserCheck className="h-4 w-4" />
            <span>Tenant Role Delegation & Authority Assignment</span>
          </div>
          <DialogTitle className="text-xl flex items-center justify-between">
            <span>Delegate Roles to {user.displayName}</span>
            <Badge variant="outline" className="font-mono text-xs">
              {user.tenantId}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Assign active tenant roles under strict Delegation Ceiling. Tenant admins cannot grant roles or sovereign permissions they do not possess.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3 max-h-[60vh]">
          <div className="space-y-4 py-3">
            {/* Ceiling Advisory Alert */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <span className="font-semibold">Delegation Ceiling Enforced:</span> You may only delegate roles and permissions actively held by your administrator identity. Sovereign cluster roles (SYSTEM scope) are quarantined.
              </div>
            </div>

            {/* Role Assignment Checkboxes */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Eligible Tenant Roles
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {delegatableRoles.map((role) => {
                  const isChecked = selectedRoles.includes(role.roleId);
                  return (
                    <div
                      key={role.roleId}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                        isChecked
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border/60 hover:border-border'
                      }`}
                      onClick={() => toggleRole(role.roleId)}
                    >
                      <Checkbox
                        id={`role-${role.roleId}`}
                        checked={isChecked}
                        onCheckedChange={() => toggleRole(role.roleId)}
                        className="mt-0.5"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-mono font-semibold truncate">
                          {role.roleId}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {role.roleName}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ad-Hoc Permission Overrides */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Ad-Hoc Permission Overrides
                </Label>
                <Badge variant="outline" className="text-[10px]">
                  {permissionOverrides.length} Active
                </Badge>
              </div>

              {permissionOverrides.length > 0 && (
                <div className="space-y-1.5">
                  {permissionOverrides.map((override) => (
                    <div
                      key={override.permissionCode}
                      className="flex items-center justify-between p-2 rounded bg-muted/20 border text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={override.isGranted ? 'default' : 'destructive'}
                          className="text-[10px]"
                        >
                          {override.isGranted ? 'GRANT' : 'REVOKE'}
                        </Badge>
                        <span>{override.permissionCode}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:bg-destructive/10"
                        onClick={() => removeOverride(override.permissionCode)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <select
                  aria-label="Select permission for override"
                  value={newOverrideCode}
                  onChange={(e) => setNewOverrideCode(e.target.value)}
                  className="flex h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs font-mono"
                >
                  <option value="">Select permission to override...</option>
                  {CANONICAL_PERMISSIONS.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code} &mdash; {p.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Override mode"
                  value={newOverrideGranted ? 'grant' : 'revoke'}
                  onChange={(e) => setNewOverrideGranted(e.target.value === 'grant')}
                  className="flex h-8 w-28 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="grant">Grant (+)</option>
                  <option value="revoke">Revoke (-)</option>
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={addOverride}
                  disabled={!newOverrideCode}
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
            </div>

            {/* Audit Justification */}
            <div className="grid gap-2 pt-2 border-t">
              <Label htmlFor="delegation-reason" className="text-xs">
                Audit Reason & Justification
              </Label>
              <Input
                id="delegation-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for role change (stored in immutable audit trail)"
                className="text-xs"
                required
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={delegateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={delegateMutation.isPending || !reason.trim()}
            className="gap-1.5"
          >
            {delegateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Delegating...
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4" />
                Commit Delegation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

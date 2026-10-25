import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldCheck, Layers, Lock, Building2, Globe } from 'lucide-react';
import type { SandboxRoleWithPermissions } from '@/core/sandbox/handlers/system-sandbox-handler';
import { CANONICAL_PERMISSIONS, SECURITY_PLANES } from '../types/rbac-matrix-types';

interface RoleInspectorDialogProps {
  role: SandboxRoleWithPermissions | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoleInspectorDialog({ role, open, onOpenChange }: RoleInspectorDialogProps) {
  if (!role) return null;

  const rolePerms = new Set(role.permissions || []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col bg-background/95 backdrop-blur-2xl border-white/20 dark:border-white/10 shadow-2xl">
        <DialogHeader className="gap-1 border-b pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4" />
              <span>Role Permissions Inspector</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  role.roleScope === 'SYSTEM'
                    ? 'border-indigo-500/40 text-indigo-700 dark:text-indigo-400 bg-indigo-500/10'
                    : 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
                }
              >
                {role.roleScope === 'SYSTEM' ? (
                  <>
                    <Globe className="h-3 w-3 mr-1" /> Sovereign Cluster
                  </>
                ) : (
                  <>
                    <Building2 className="h-3 w-3 mr-1" /> Tenant Scoped
                  </>
                )}
              </Badge>
              {role.systemRole && (
                <Badge variant="secondary" className="gap-1 text-[11px]">
                  <Lock className="h-3 w-3" /> Core Protected
                </Badge>
              )}
            </div>
          </div>
          <DialogTitle className="text-xl flex items-center gap-2 font-mono">
            {role.roleId}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {role.roleName} &mdash; {role.description || 'No description provided.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 py-2 text-xs border-b">
          <div className="flex flex-col">
            <span className="text-muted-foreground">Tenant Custody</span>
            <span className="font-mono font-medium">{role.tenantId || 'SYSTEM'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground">Min Plan Tier</span>
            <span className="font-medium">{role.minPlanTier || 'COMMUNITY'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground">Assigned Users</span>
            <span className="font-medium">{role.userCount || 0} active</span>
          </div>
        </div>

        <ScrollArea className="flex-1 pr-3 max-h-[50vh]">
          <div className="space-y-4 py-2">
            {SECURITY_PLANES.map((plane) => {
              const planeAtoms = CANONICAL_PERMISSIONS.filter((p) => p.plane === plane.id);
              const grantedAtoms = planeAtoms.filter((p) => rolePerms.has(p.code));

              return (
                <div key={plane.id} className="rounded-lg border bg-muted/10 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium text-xs">{plane.label}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {grantedAtoms.length} / {planeAtoms.length} Granted
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                    {planeAtoms.map((atom) => {
                      const isGranted = rolePerms.has(atom.code);
                      return (
                        <div
                          key={atom.code}
                          className={`flex items-start gap-2 p-2 rounded text-xs border transition-colors ${
                            isGranted
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200'
                              : 'bg-muted/30 border-dashed border-border/50 text-muted-foreground opacity-60'
                          }`}
                        >
                          <div
                            className={`h-2 w-2 rounded-full mt-1 shrink-0 ${
                              isGranted ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                            }`}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="font-mono font-medium truncate text-[11px]">
                              {atom.code}
                            </span>
                            <span className="text-[10px] text-muted-foreground leading-tight">
                              {atom.description}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

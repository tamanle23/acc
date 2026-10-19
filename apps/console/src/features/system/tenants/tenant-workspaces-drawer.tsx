import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Layers, Plus, Trash2, LayoutGrid } from 'lucide-react';
import { useProfileStore, type Profile } from '@/stores/profile-store';
import { useMetadataUiStore } from '@/features/metadata/store/use-metadata-ui-store';
import { type FleetTenantSummary } from '../api/use-system-fleet';
import { CreateWorkspaceModal } from '@/features/settings/workspaces/create-workspace-modal';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TenantWorkspacesDrawerProps {
  tenant: FleetTenantSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TenantWorkspacesDrawer({
  tenant,
  open,
  onOpenChange,
}: TenantWorkspacesDrawerProps) {
  const { profiles, setProfiles, currentProfile, setCurrentProfile } = useProfileStore();
  const { activeWorkspaceId, setActiveTenant, setActiveWorkspace } = useMetadataUiStore();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Profile | null>(null);

  if (!tenant) return null;

  // Filter workspaces belonging specifically to this tenant
  const tenantWorkspaces = profiles.filter((p) => p.tenantId === tenant.tenantId);

  const handleDeleteWorkspace = (workspace: Profile) => {
    if (workspace.isDefault) {
      toast.error(`Workspace "${workspace.name}" is the immutable default workspace and cannot be deleted.`);
      return;
    }
    if (tenantWorkspaces.length <= 1) {
      toast.error(`Workspace "${workspace.name}" is the sole workspace of ${tenant.name} and cannot be deleted.`);
      return;
    }

    const updated = profiles.filter((p) => p.id !== workspace.id);
    setProfiles(updated);

    if (currentProfile?.id === workspace.id) {
      const remainingForTenant = updated.filter((p) => p.tenantId === tenant.tenantId);
      if (remainingForTenant.length > 0) {
        setCurrentProfile(remainingForTenant[0]);
        setActiveWorkspace(remainingForTenant[0].id || '', remainingForTenant[0].name);
      } else {
        // Orphaned tenant: all workspaces wiped
        setActiveWorkspace('', '');
      }
    }

    toast.success(`Workspace "${workspace.name}" has been deleted from ${tenant.name}.`);
    setWorkspaceToDelete(null);
  };

  const handleActivateWorkspace = (workspace: Profile) => {
    setCurrentProfile(workspace);
    setActiveTenant(tenant.tenantId, tenant.name);
    setActiveWorkspace(workspace.id || '', workspace.name);
    toast.info(`Switched active workspace to "${workspace.name}".`);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg bg-background/95 backdrop-blur-2xl border-white/20 p-6 flex flex-col gap-6">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold">
                  Workspaces for {tenant.name}
                </SheetTitle>
                <SheetDescription className="text-xs font-mono">
                  Tenant ID: {tenant.tenantId} • ({tenantWorkspaces.length} /{' '}
                  {tenant.maxWorkspaces === -1 ? '∞' : tenant.maxWorkspaces})
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {tenantWorkspaces.length === 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  ⚠️ Orphaned Tenant: Zero active workspaces
                </span>
              ) : (
                `Managing ${tenantWorkspaces.length} workspace(s)`
              )}
            </span>
            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              Provision Workspace
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3">
            {tenantWorkspaces.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-border bg-muted/20">
                <LayoutGrid className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                <h4 className="text-sm font-semibold mb-1">No Workspaces Found</h4>
                <p className="text-xs text-muted-foreground mb-4">
                  This tenant has zero active workspaces. Workspace routes and runtime navigation are currently hidden for users of this tenant.
                </p>
                <Button
                  size="sm"
                  onClick={() => setIsCreateOpen(true)}
                  className="text-xs gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Provision First Workspace
                </Button>
              </div>
            ) : (
              tenantWorkspaces.map((ws) => {
                const isActive = (ws.id && ws.id === currentProfile?.id) || ws.id === activeWorkspaceId;
                const Logo = ws.logo || LayoutGrid;
                const isDefault = Boolean(ws.isDefault);
                const isSoleWorkspace = tenantWorkspaces.length <= 1;
                const isProtected = isDefault || isSoleWorkspace;

                return (
                  <div
                    key={ws.id ?? ws.name}
                    className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-primary/10 border-primary/40 shadow-sm'
                        : 'bg-white/40 dark:bg-white/5 border-white/20 hover:border-white/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/80 border border-border">
                        <Logo className="h-4 w-4" />
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-semibold text-sm truncate">{ws.name}</span>
                          {isDefault && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-mono bg-primary/10 text-primary border-primary/30">
                              DEFAULT
                            </Badge>
                          )}
                          {isActive && (
                            <Badge variant="default" className="text-[9px] px-1 py-0 h-4 font-mono">
                              ACTIVE
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          ID: {ws.id}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isActive && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleActivateWorkspace(ws)}
                          className="h-8 px-2.5 text-xs text-primary hover:bg-primary/10"
                        >
                          Select
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={isProtected}
                        onClick={() => setWorkspaceToDelete(ws)}
                        className={cn(
                          "h-8 w-8 text-destructive hover:bg-destructive/10",
                          isProtected && "opacity-40 cursor-not-allowed hover:bg-transparent"
                        )}
                        title={
                          isDefault
                            ? "Default workspace (Protected from deletion)"
                            : isSoleWorkspace
                            ? "Sole remaining workspace (Protected from deletion)"
                            : "Delete workspace"
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Provision Workspace Modal targeted for this tenant */}
      <CreateWorkspaceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(workspaceToDelete)}
        onOpenChange={(open) => !open && setWorkspaceToDelete(null)}
        handleConfirm={() => workspaceToDelete && handleDeleteWorkspace(workspaceToDelete)}
        title="Delete Workspace"
        desc={
          workspaceToDelete ? (
            <span>
              Are you sure you want to permanently delete workspace{' '}
              <strong className="font-semibold text-foreground">
                "{workspaceToDelete.name}"
              </strong>{' '}
              from tenant <strong className="font-semibold text-foreground">{tenant.name}</strong>?
              If this is the tenant's last workspace, the tenant will enter an orphaned unprovisioned state.
            </span>
          ) : (
            ''
          )
        }
        confirmText="Delete Workspace"
        destructive
      />
    </>
  );
}

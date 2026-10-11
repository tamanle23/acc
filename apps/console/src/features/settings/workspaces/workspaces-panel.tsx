import React, { useState } from 'react';
import { ContentSection } from '../components/content-section';
import { useProfileStore, getUserDefaultWorkspace, type Profile } from '@/stores/profile-store';
import { useMetadataUiStore } from '@/features/metadata/store/use-metadata-ui-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreateWorkspaceModal } from './create-workspace-modal';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  Building2,
  Plus,
  CheckCircle2,
  ShieldCheck,
  LayoutGrid,
  Sparkles,
  Trash2,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export const WorkspacesPanel: React.FC = () => {
  const { profiles, setProfiles, currentProfile, setCurrentProfile, setUserDefault } = useProfileStore();
  const { activeTenantId, activeTenantName, setActiveTenant, setActiveWorkspace } = useMetadataUiStore();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Profile | null>(null);

  const handleSwitchWorkspace = (p: Profile) => {
    setCurrentProfile(p);
    const tenantId = (p.tenantId as string) || activeTenantId || 'tenant-acme';
    const tenantName = (p.tenantName as string) || p.name;
    const workspaceId = (p.id as string) || p.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

    setActiveTenant(tenantId, tenantName);
    setActiveWorkspace(workspaceId, p.name);
    toast.success(`Đã chuyển sang workspace "${p.name}" (${tenantName})`);
  };

  const handleDeleteWorkspace = (ws: Profile) => {
    if (ws.isDefault) {
      toast.error('Không thể xóa workspace mặc định của tổ chức.');
      return;
    }
    const tenantWorkspaces = profiles.filter((p) => p.tenantId === ws.tenantId);
    if (tenantWorkspaces.length <= 1) {
      toast.error('Không thể xóa workspace duy nhất còn lại của tổ chức.');
      return;
    }

    const updated = profiles.filter((p) => p.id !== ws.id);
    setProfiles(updated);

    if (currentProfile?.id === ws.id) {
      const remainingForTenant = updated.filter((p) => p.tenantId === ws.tenantId);
      if (remainingForTenant.length > 0) {
        setCurrentProfile(remainingForTenant[0]);
        setActiveWorkspace(remainingForTenant[0].id || '', remainingForTenant[0].name);
      } else {
        // All workspaces for this tenant deleted -> Orphaned Tenant state
        setActiveWorkspace('', '');
      }
    }

    toast.success(`Đã xóa workspace "${ws.name}".`);
    setWorkspaceToDelete(null);
  };

  return (
    <ContentSection
      title="Workspaces & Organizations"
      desc="Quản lý danh sách các không gian làm việc (Workspaces) trực thuộc Tổ chức (Tenant). Một tổ chức có thể sở hữu nhiều workspace phân lập."
    >
      <div className="space-y-6">
        {/* Active Tenant Context Card */}
        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tổ chức Hiện tại (Tenant)
                </span>
                <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                  ID: {activeTenantId}
                </Badge>
              </div>
              <h3 className="text-base font-bold text-foreground">
                {activeTenantName || 'Acme International Corp'}
              </h3>
            </div>
          </div>
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs">
            Multi-Tenant RLS Active
          </Badge>
        </div>

        {/* Top Action Bar */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Đang quản trị <span className="font-bold text-foreground">{profiles.length}</span> workspaces trên toàn hệ thống
          </div>
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="text-xs gap-1.5 font-semibold bg-primary text-primary-foreground shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tạo Workspace Mới</span>
          </Button>
        </div>

        {/* Workspaces List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profiles.map((p) => {
            const isCurrent =
              (p.id && p.id === currentProfile?.id) || p.name === currentProfile?.name;
            const Logo = p.logo || LayoutGrid;
            const profileTenantId = (p.tenantId as string) || activeTenantId || 'tenant-acme';
            const belongsToActiveTenant = profileTenantId === activeTenantId;

            const isTenantDefault = Boolean(p.isDefault);
            const tenantProfiles = profiles.filter((ws) => ws.tenantId === p.tenantId);
            const isLastWorkspace = tenantProfiles.length <= 1;
            const isProtectedWorkspace = isTenantDefault || isLastWorkspace;

            const userDefaultWsId = profileTenantId ? getUserDefaultWorkspace(profileTenantId) : null;
            const isUserDefault = userDefaultWsId ? p.id === userDefaultWsId : Boolean(p.isDefault);

            return (
              <div
                key={(p.id as string) ?? p.name}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-blue-500/10 border-blue-500/50 shadow-md ring-1 ring-blue-500/30'
                    : 'bg-white/40 dark:bg-white/5 border-white/20 hover:border-white/40'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                        <Logo className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-sm text-foreground">{p.name}</h4>
                          {isTenantDefault && (
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                              DEFAULT
                            </Badge>
                          )}
                          {isUserDefault && (
                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                              MY DEFAULT
                            </Badge>
                          )}
                          {belongsToActiveTenant && !isTenantDefault && (
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                              (Cùng tổ chức)
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          Tenant: {(p.tenantName as string) || (p.tenantId as string) || 'Organization'}
                        </span>
                      </div>
                    </div>
                    {isCurrent ? (
                      <Badge className="text-[10px] font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        Đang chọn
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {p.plan || 'Workspace'}
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2">
                    Không gian phân vùng dữ liệu thuộc tổ chức {(p.tenantName as string) || 'chính'}, áp dụng bảo mật RLS và cấu trúc Blueprint riêng biệt.
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-white/10 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                      <span>RLS Enforced</span>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (profileTenantId && p.id) {
                          setUserDefault(profileTenantId, p.id);
                          toast.success(`Đã đặt "${p.name}" làm workspace mặc định của bạn`);
                        }
                      }}
                      className={cn(
                        "h-7 px-2 text-[11px] gap-1 font-medium transition-colors",
                        isUserDefault
                          ? "text-amber-600 dark:text-amber-400 bg-amber-500/10"
                          : "text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
                      )}
                      title={isUserDefault ? 'Workspace mặc định của bạn' : 'Đặt làm workspace mặc định của bạn'}
                    >
                      <Star className={cn("h-3.5 w-3.5", isUserDefault && "fill-amber-500 text-amber-500")} />
                      <span>{isUserDefault ? 'Mặc định của tôi' : 'Đặt làm mặc định'}</span>
                    </Button>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-white/5">
                    {isCurrent ? (
                      <span className="text-xs font-semibold text-primary flex items-center gap-1 mr-auto">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Không gian hiện tại</span>
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSwitchWorkspace(p)}
                        className="h-8 text-xs font-semibold text-primary hover:bg-primary/10 mr-auto"
                      >
                        <span>Chuyển sang workspace này →</span>
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={isProtectedWorkspace}
                      onClick={() => setWorkspaceToDelete(p)}
                      className={cn(
                        "h-8 w-8 text-destructive hover:bg-destructive/10",
                        isProtectedWorkspace && "opacity-40 cursor-not-allowed hover:bg-transparent"
                      )}
                      title={
                        isTenantDefault
                          ? "Workspace mặc định của tổ chức (Không thể xóa)"
                          : isLastWorkspace
                          ? "Workspace duy nhất của tổ chức (Không thể xóa)"
                          : "Xóa workspace"
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Create Workspace Modal */}
        <CreateWorkspaceModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={Boolean(workspaceToDelete)}
          onOpenChange={(open) => !open && setWorkspaceToDelete(null)}
          handleConfirm={() => workspaceToDelete && handleDeleteWorkspace(workspaceToDelete)}
          title="Xác nhận xóa Workspace"
          desc={
            workspaceToDelete ? (
              <span>
                Bạn có chắc chắn muốn xóa không gian làm việc{' '}
                <strong className="font-semibold text-foreground">
                  "{workspaceToDelete.name}"
                </strong>{' '}
                thuộc tổ chức <strong className="font-semibold text-foreground">{(workspaceToDelete.tenantName as string) || (workspaceToDelete.tenantId as string)}</strong> không?
                Nếu đây là workspace cuối cùng, tổ chức sẽ chuyển sang trạng thái <em>Orphaned Tenant</em> (không có workspace) và các chức năng workspace sẽ bị ẩn.
              </span>
            ) : (
              ''
            )
          }
          confirmText="Xác nhận xóa"
          destructive
        />
      </div>
    </ContentSection>
  );
};

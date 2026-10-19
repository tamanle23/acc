import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useBlueprintCatalog,
  useProvisionTenantBlueprint,
} from '../../metadata/api/use-blueprints';
import { useMetadataUiStore } from '../../metadata/store/use-metadata-ui-store';
import { useProfileStore } from '@/stores/profile-store';
import { TemplatePreviewModal } from '../../metadata/components/blueprint-gallery/template-preview-modal';
import { Building2, ArrowRight, CheckCircle2, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onWorkspaceCreated?: (newWorkspaceId: string, newWorkspaceName: string) => void;
}

export const CreateWorkspaceModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onWorkspaceCreated,
}) => {
  const { data: blueprints = [], isLoading: isCatalogLoading } = useBlueprintCatalog();
  const provisionMutation = useProvisionTenantBlueprint();
  const { activeTenantId, activeTenantName, setActiveTenant, setActiveWorkspace } = useMetadataUiStore();
  const { profiles, setProfiles, setCurrentProfile } = useProfileStore();

  const [workspaceName, setWorkspaceName] = useState('');
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>('bp_cms_publishing_v1');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) {
      toast.error('Vui lòng nhập tên Workspace');
      return;
    }

    const workspaceSlug = workspaceName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || `ws-${Date.now()}`;

    const effectiveTenantId = activeTenantId || 'tenant-acme';
    const effectiveTenantName = activeTenantName || 'Acme International Corp';

    setIsProvisioning(true);
    try {
      // 1. Provision target blueprint for this workspace under active tenant
      await provisionMutation.mutateAsync({
        tenantId: effectiveTenantId,
        tenantName: effectiveTenantName,
        blueprintId: selectedBlueprintId,
      });

      // 2. Register into profile/workspace store with explicit tenant-workspace relationship
      const newProfile = {
        id: workspaceSlug,
        name: workspaceName,
        logo: LayoutGrid,
        plan: 'Custom Space',
        tenantId: effectiveTenantId,
        tenantName: effectiveTenantName,
      };
      setProfiles([...profiles, newProfile]);
      setCurrentProfile(newProfile);
      setActiveTenant(effectiveTenantId, effectiveTenantName);
      setActiveWorkspace(workspaceSlug, workspaceName);

      toast.success(`Workspace "${workspaceName}" thuộc tổ chức "${effectiveTenantName}" đã được tạo thành công!`);
      if (onWorkspaceCreated) {
        onWorkspaceCreated(workspaceSlug, workspaceName);
      }
      onClose();
    } catch (err: any) {
      toast.error('Khởi tạo workspace thất bại. Vui lòng thử lại.');
    } finally {
      setIsProvisioning(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && !isProvisioning && onClose()}>
        <DialogContent className="max-w-2xl p-6 sm:p-8 rounded-3xl bg-white/90 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-2xl">
          <DialogHeader className="space-y-1 pb-3 border-b border-border/40">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                  Tạo Workspace Mới
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Khởi tạo một không gian làm việc mới trực thuộc tổ chức <span className="font-semibold text-foreground">{activeTenantName || 'Acme International Corp'}</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 py-3">
            {/* Active Parent Tenant Indicator */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Tổ chức sở hữu (Tenant):</span>
                <span className="font-bold text-foreground">{activeTenantName || 'Acme International Corp'}</span>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">
                {activeTenantId}
              </Badge>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Tên Workspace Mới *
              </label>
              <Input
                required
                placeholder="Ví dụ: Warehouse Hub North hoặc Marketing Lab"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="h-9 text-xs bg-white/50 dark:bg-white/5 border-white/20"
              />
              <span className="text-[10px] text-muted-foreground font-mono">
                Workspace Slug: {workspaceName ? workspaceName.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'workspace-slug'}
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Chọn Domain Blueprint khởi tạo *</span>
                <span className="text-[11px] font-normal text-muted-foreground">Tự động cấu hình mô hình & quan hệ</span>
              </label>

              {isCatalogLoading ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Đang tải danh mục blueprints...
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[36vh] overflow-y-auto pr-1">
                  {blueprints.map((bp) => (
                    <div
                      key={bp.id}
                      onClick={() => setSelectedBlueprintId(bp.id)}
                      className={`p-3.5 rounded-2xl cursor-pointer transition-all border text-left flex flex-col justify-between ${
                        selectedBlueprintId === bp.id
                          ? 'bg-blue-500/15 border-blue-500/60 ring-2 ring-blue-500/30'
                          : 'bg-white/40 dark:bg-white/5 border-white/20 hover:border-white/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-foreground truncate">{bp.name}</span>
                          <Badge variant="secondary" className="text-[9px] font-mono shrink-0">
                            {bp.entityTypesCount} m
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">
                          {bp.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-1.5 border-t border-white/10 text-xs">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewId(bp.id);
                          }}
                          className="text-primary hover:underline text-[10px] font-medium"
                        >
                          Xem trước cấu trúc →
                        </button>
                        {selectedBlueprintId === bp.id && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-border/40">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isProvisioning} className="text-xs">
                Hủy
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isProvisioning || !workspaceName.trim()}
                className="text-xs gap-1.5 font-bold bg-primary text-primary-foreground shadow-md"
              >
                {isProvisioning ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Đang khởi tạo Workspace & Pre-warming Cache...</span>
                  </>
                ) : (
                  <>
                    <span>Khởi tạo Workspace</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <TemplatePreviewModal
        blueprintId={previewId}
        isOpen={Boolean(previewId)}
        onClose={() => setPreviewId(null)}
      />
    </>
  );
};

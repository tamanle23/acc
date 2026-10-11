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
import { useSpringAuthStore } from '../../spring-auth/store';
import { useMetadataUiStore } from '../../metadata/store/use-metadata-ui-store';
import { BlueprintCard } from '../../metadata/components/blueprint-gallery/blueprint-card';
import { useNavigate } from '@tanstack/react-router';
import { useProfileStore } from '@/stores/profile-store';
import { Sparkles, ArrowRight, ArrowLeft, CheckCircle2, User, Building, Mail, Key, Layers, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultPlan?: 'BASIC' | 'PRO' | 'PRO_MAX';
  defaultBlueprintId?: string;
  onUpgradePrompt?: (tier: 'PRO' | 'PRO_MAX') => void;
}

export const OnboardingFunnelModal: React.FC<Props> = ({
  isOpen,
  onClose,
  defaultPlan = 'BASIC',
  defaultBlueprintId = 'bp_cms_publishing_v1',
  onUpgradePrompt,
}) => {
  const navigate = useNavigate();
  const { data: blueprints = [] } = useBlueprintCatalog();
  const provisionMutation = useProvisionTenantBlueprint();
  const { setTokens } = useSpringAuthStore();
  const { setActiveTenant, setActiveWorkspace } = useMetadataUiStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPlan, setSelectedPlan] = useState<'BASIC' | 'PRO' | 'PRO_MAX'>(defaultPlan);
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>(defaultBlueprintId);
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Form Fields: Tenant (Organization) & Initial Workspace
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);

  if (!isOpen) return null;

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !organizationName.trim()) {
      toast.error('Vui lòng điền đầy đủ các thông tin bắt buộc');
      return;
    }
    setStep(2);
  };

  const handleCompleteSetup = async () => {
    if (selectedPlan === 'PRO' || selectedPlan === 'PRO_MAX') {
      if (onUpgradePrompt) {
        onUpgradePrompt(selectedPlan);
        onClose();
        return;
      }
    }

    setIsInitializing(true);
    const tenantSlug = organizationName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || `org-${Date.now()}`;

    const effectiveWorkspaceName = workspaceName.trim() || 'Không gian Chính (Default)';
    const workspaceSlug = effectiveWorkspaceName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || `ws-${tenantSlug}-default`;

    try {
      // 1. Provision chosen blueprint for this tenant
      await provisionMutation.mutateAsync({
        tenantId: tenantSlug,
        tenantName: organizationName,
        blueprintId: selectedBlueprintId,
      });

      // 2. Hydrate demo authenticated session for the newly created tenant & user
      const demoToken = `mock_token_${tenantSlug}.${btoa(
        JSON.stringify({
          sub: email,
          name: fullName,
          tid: tenantSlug,
          roles: ['ROLE_ADMIN', 'TENANT_ADMIN'],
          permissions: ['METADATA_SCHEMA_WRITE', 'METADATA_SCHEMA_READ'],
          isSandbox: true,
        })
      )}.mock_signature`;

      // Register default workspace into profile store
      const initialWsProfile = {
        id: workspaceSlug,
        name: effectiveWorkspaceName,
        logo: LayoutGrid,
        plan: 'Default Workspace',
        tenantId: tenantSlug,
        tenantName: organizationName,
        isDefault: true,
      };
      useProfileStore.getState().setProfiles([
        ...useProfileStore.getState().profiles,
        initialWsProfile,
      ]);
      useProfileStore.getState().setCurrentProfile(initialWsProfile);

      setTokens(demoToken, `mock_refresh_${Date.now()}`);
      setActiveTenant(tenantSlug, organizationName);
      setActiveWorkspace(workspaceSlug, effectiveWorkspaceName);

      toast.success(`Chào mừng ${fullName}! Tổ chức & Workspace đã sẵn sàng.`);
      onClose();

      // 3. Smooth transition redirect into metadata studio
      navigate({ to: '/_authenticated/metadata/' });
    } catch (err: any) {
      toast.error('Khởi tạo workspace thất bại. Vui lòng thử lại.');
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && !isInitializing && onClose()}>
        <DialogContent className="max-w-3xl p-6 sm:p-8 rounded-3xl bg-white/90 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-2xl">
          <DialogHeader className="space-y-1 pb-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                    {step === 1 ? 'Khởi tạo Tài khoản & Workspace' : 'Chọn Domain Blueprint Khởi đầu'}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    {step === 1
                      ? 'Bước 1/2: Điền thông tin người quản trị và định danh tổ chức của bạn.'
                      : 'Bước 2/2: Chọn mô hình nghiệp vụ có sẵn để tự động sinh cấu trúc dữ liệu.'}
                  </DialogDescription>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs font-mono">
                {selectedPlan}
              </Badge>
            </div>
          </DialogHeader>

          {/* STEP 1: Registration Form */}
          {step === 1 && (
            <form onSubmit={handleNextStep} className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Họ và tên người quản trị *</span>
                </label>
                <Input
                  required
                  placeholder="Ví dụ: Alex Nguyễn"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-9 text-xs bg-white/50 dark:bg-white/5 border-white/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Địa chỉ Email doanh nghiệp *</span>
                </label>
                <Input
                  required
                  type="email"
                  placeholder="alex@acme-logistics.vn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 text-xs bg-white/50 dark:bg-white/5 border-white/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Tên Tổ chức / Doanh nghiệp (Tenant) *</span>
                </label>
                <Input
                  required
                  placeholder="Acme Global Logistics Corp"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="h-9 text-xs bg-white/50 dark:bg-white/5 border-white/20"
                />
                <span className="text-[10px] text-muted-foreground font-mono">
                  Tenant ID: {organizationName ? organizationName.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'org-slug'}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Tên Không gian làm việc khởi tạo (Workspace)</span>
                </label>
                <Input
                  placeholder="Không gian Chính (Default: Production)"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="h-9 text-xs bg-white/50 dark:bg-white/5 border-white/20"
                />
                <span className="text-[10px] text-muted-foreground">
                  Một tổ chức có thể tạo nhiều workspace sau này (Development, Staging, Kho bãi...).
                </span>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-border/40">
                <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs">
                  Hủy
                </Button>
                <Button type="submit" size="sm" className="text-xs gap-1.5 font-semibold bg-primary text-primary-foreground">
                  <span>Tiếp tục: Chọn Blueprint</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </form>
          )}

          {/* STEP 2: Blueprint Carousel Selection */}
          {step === 2 && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                {blueprints.map((bp) => (
                  <div
                    key={bp.id}
                    onClick={() => setSelectedBlueprintId(bp.id)}
                    className={`p-4 rounded-2xl cursor-pointer transition-all border text-left flex flex-col justify-between ${
                      selectedBlueprintId === bp.id
                        ? 'bg-blue-500/15 border-blue-500/60 ring-2 ring-blue-500/30'
                        : 'bg-white/40 dark:bg-white/5 border-white/20 hover:border-white/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-xs text-foreground">{bp.name}</span>
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          {bp.entityTypesCount} Models
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">
                        {bp.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewId(bp.id);
                        }}
                        className="text-primary hover:underline text-[11px] font-medium"
                      >
                        Xem trước cấu trúc →
                      </button>
                      {selectedBlueprintId === bp.id && (
                        <CheckCircle2 className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Bar */}
              <div className="pt-4 flex items-center justify-between border-t border-border/40">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(1)}
                  disabled={isInitializing}
                  className="text-xs gap-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Quay lại</span>
                </Button>

                <Button
                  size="sm"
                  onClick={handleCompleteSetup}
                  disabled={isInitializing}
                  className="text-xs gap-1.5 font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                >
                  {isInitializing ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Đang khởi tạo Workspace & Pre-warming Cache...</span>
                    </>
                  ) : (
                    <>
                      <span>Khởi tạo Workspace ngay</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Embedded Preview Modal */}
      <TemplatePreviewModal
        blueprintId={previewId}
        isOpen={Boolean(previewId)}
        onClose={() => setPreviewId(null)}
      />
    </>
  );
};

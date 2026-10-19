import React from 'react';
import {
  useBlueprintCatalog,
} from '../../metadata/api/use-blueprints';
import { BlueprintCard } from '../../metadata/components/blueprint-gallery/blueprint-card';
import { TemplatePreviewModal } from '../../metadata/components/blueprint-gallery/template-preview-modal';
import { Sparkles } from 'lucide-react';

interface Props {
  onSelectBlueprint: (blueprintId: string) => void;
}

export const LandingBlueprintsSection: React.FC<Props> = ({ onSelectBlueprint }) => {
  const { data: blueprints = [], isLoading } = useBlueprintCatalog();
  const [previewId, setPreviewId] = React.useState<string | null>(null);

  return (
    <section id="blueprints" className="py-16 sm:py-24 px-4 sm:px-8 max-w-7xl mx-auto border-t border-white/20 dark:border-white/10">
      <div className="text-center space-y-2 mb-12">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Sẵn sàng vận hành ngay</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Khởi tạo Workspace với Kho Domain Blueprints
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
          Chọn một mô hình template chuẩn hóa để nhân bản toàn bộ lược đồ, thuộc tính nghiệp vụ và quan hệ trong chưa đầy 250ms.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 gap-3 text-muted-foreground">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-xs">Đang tải danh mục Domain Blueprints...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {blueprints.map((bp) => (
            <BlueprintCard
              key={bp.id}
              blueprint={bp}
              onPreview={(id) => setPreviewId(id)}
              onSelect={(id) => onSelectBlueprint(id)}
            />
          ))}
        </div>
      )}

      {/* Embedded Preview Modal */}
      <TemplatePreviewModal
        blueprintId={previewId}
        isOpen={Boolean(previewId)}
        onClose={() => setPreviewId(null)}
      />
    </section>
  );
};

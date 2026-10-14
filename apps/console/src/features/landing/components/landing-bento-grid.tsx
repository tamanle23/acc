import React from 'react';
import {
  Database,
  GitFork,
  ShieldCheck,
  Zap,
  Sparkles,
  DownloadCloud,
} from 'lucide-react';

export const LandingBentoGrid: React.FC = () => {
  return (
    <section id="features" className="py-16 sm:py-24 px-4 sm:px-8 max-w-7xl mx-auto">
      <div className="text-center space-y-2 mb-12">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Được thiết kế cho Doanh nghiệp & Vận hành Quy mô lớn
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
          Kết hợp tốc độ của NoSQL với tính toàn vẹn của PostgreSQL và kiến trúc Multi-Tenant phân lập nghiêm ngặt.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Zero-Downtime Dynamic Schemas */}
        <div className="p-6 rounded-3xl bg-white/55 dark:bg-slate-900/60 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg shadow-black/5 flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 border border-blue-500/20">
              <Database className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base text-foreground mb-1.5">
              Zero-Downtime Schema Engine
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Thêm bớt trường dữ liệu, validation rules và UI widgets động ở runtime. Hoàn toàn không khóa bảng PostgreSQL (`ALTER TABLE`), không downtime và tự động đồng bộ JSON Schema Draft-07.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/20 text-[11px] font-mono text-blue-600 dark:text-blue-400">
            L1/L2 Redis & Hazelcast Pre-warm
          </div>
        </div>

        {/* Card 2: Pattern C Multi-Dimensional Graph */}
        <div className="p-6 rounded-3xl bg-white/55 dark:bg-slate-900/60 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg shadow-black/5 flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-4 border border-violet-500/20">
              <GitFork className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base text-foreground mb-1.5">
              Đồ thị Quan hệ Pattern C
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Mô hình quan hệ dạng Adjacency List linh hoạt hỗ trợ 1:1, 1:N, N:N. Truy vấn 2 chiều không chậm trễ mà không cần hardcode Foreign Key cố định giữa các thực thể động.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/20 text-[11px] font-mono text-violet-600 dark:text-violet-400">
            High-Performance Graph Edges
          </div>
        </div>

        {/* Card 3: Hard Multi-Tenant Isolation (RLS) */}
        <div className="p-6 rounded-3xl bg-white/55 dark:bg-slate-900/60 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg shadow-black/5 flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base text-foreground mb-1.5">
              Bảo mật Row-Level Security
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Mỗi bản ghi được đóng dấu `tenant_id` ở tầng cơ sở dữ liệu. Chính sách PostgreSQL RLS (`FORCE ROW LEVEL SECURITY`) ngăn chặn hoàn toàn rủi ro rò rỉ dữ liệu chéo giữa các tổ chức.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/20 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
            Strict Multi-Tenant Hard Isolation
          </div>
        </div>

        {/* Card 4: Sub-250ms Domain Blueprints */}
        <div className="p-6 rounded-3xl bg-white/55 dark:bg-slate-900/60 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg shadow-black/5 flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 border border-amber-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base text-foreground mb-1.5">
              Domain Blueprints Catalog
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Xóa bỏ "nỗi sợ trang giấy trắng" với kho template ngành có sẵn (CMS, Logistics, B2B CRM). Khởi tạo toàn bộ mô hình và quan hệ chỉ trong dưới 250ms với zero runtime coupling.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/20 text-[11px] font-mono text-amber-600 dark:text-amber-400">
            Decoupled Schema Evolution
          </div>
        </div>

        {/* Card 5: GDPR Art. 17 & Streaming Export */}
        <div className="p-6 rounded-3xl bg-white/55 dark:bg-slate-900/60 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg shadow-black/5 flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-4 border border-cyan-500/20">
              <DownloadCloud className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base text-foreground mb-1.5">
              Tuân thủ GDPR & Data Portability
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Xuất dữ liệu 1-click dạng ZIP nén trực tiếp và quy trình tiêu hủy dữ liệu triệt để 5 giai đoạn theo GDPR Article 17 với Chứng nhận Tiêu hủy số hóa (SHA-256 hash).
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/20 text-[11px] font-mono text-cyan-600 dark:text-cyan-400">
            Certificate of Erasure Receipt
          </div>
        </div>

        {/* Card 6: Noisy Neighbor & Quota Defense */}
        <div className="p-6 rounded-3xl bg-white/55 dark:bg-slate-900/60 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg shadow-black/5 flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 border border-rose-500/20">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base text-foreground mb-1.5">
              Noisy Neighbor & ReDoS Guard
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Phòng thủ tài nguyên 3 tầng: Giới hạn tần suất HTTP 429 Token Bucket, kiểm tra biểu thức chính quy ReDoS thời gian thực, và ngắt câu lệnh truy vấn dài tự động.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/20 text-[11px] font-mono text-rose-600 dark:text-rose-400">
            Resource Protection Layer
          </div>
        </div>
      </div>
    </section>
  );
};

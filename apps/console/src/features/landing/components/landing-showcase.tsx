import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Database,
  Cpu,
  GitFork,
  LayoutTemplate,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const LandingShowcase: React.FC = () => {
  const [activeModel, setActiveModel] = useState<'article' | 'vehicle' | 'invoice'>('article');

  return (
    <section id="showcase" className="py-16 sm:py-20 px-4 sm:px-8 max-w-7xl mx-auto">
      <div className="text-center space-y-2 mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Trực quan hóa Studio Quản trị Metadata
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
          Khám phá cách Unipost tự động sinh biểu mẫu, kiểm định dữ liệu thời gian thực và kết nối mạng lưới quan hệ đa chiều.
        </p>

        {/* Model Switcher Pills */}
        <div className="pt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setActiveModel('article')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5',
              activeModel === 'article'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                : 'bg-white/50 dark:bg-slate-900/50 border-white/20 text-muted-foreground hover:text-foreground'
            )}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Articles (CMS)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveModel('vehicle')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5',
              activeModel === 'vehicle'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                : 'bg-white/50 dark:bg-slate-900/50 border-white/20 text-muted-foreground hover:text-foreground'
            )}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Vehicles (Fleet)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveModel('invoice')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5',
              activeModel === 'invoice'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                : 'bg-white/50 dark:bg-slate-900/50 border-white/20 text-muted-foreground hover:text-foreground'
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Invoices (CRM)</span>
          </button>
        </div>
      </div>

      {/* Liquid Glass Studio Preview Window */}
      <div className="rounded-3xl p-4 sm:p-6 bg-white/55 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-2xl shadow-black/10">
        {/* Mock Window Titlebar */}
        <div className="flex items-center justify-between pb-4 border-b border-white/20 dark:border-white/10 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-amber-500/70" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
            <span className="ms-2 text-xs font-mono text-muted-foreground">
              unipost.workspace.studio // {activeModel.toUpperCase()}_SCHEMA_V1
            </span>
          </div>
          <Badge variant="secondary" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            ● Pre-warmed & Validated
          </Badge>
        </div>

        {/* 3-Column Studio Simulation */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Column 1: Schema Fields (4 cols) */}
          <div className="lg:col-span-4 rounded-2xl bg-white/40 dark:bg-black/20 p-4 border border-white/20">
            <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-500" />
              <span>Cấu trúc thuộc tính (Dynamic Schema)</span>
            </h4>
            <div className="space-y-2">
              {activeModel === 'article' && (
                <>
                  <div className="p-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-white/20 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">title</span>
                    <Badge variant="outline" className="text-[9px] font-mono">STRING (text)</Badge>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-white/20 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">slug</span>
                    <Badge variant="outline" className="text-[9px] font-mono">STRING (slug)</Badge>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-white/20 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">status</span>
                    <Badge variant="outline" className="text-[9px] font-mono">ENUM (select)</Badge>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-white/20 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">featured_flag</span>
                    <Badge variant="outline" className="text-[9px] font-mono">BOOLEAN (switch)</Badge>
                  </div>
                </>
              )}
              {activeModel === 'vehicle' && (
                <>
                  <div className="p-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-white/20 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">plate_number</span>
                    <Badge variant="outline" className="text-[9px] font-mono">STRING (text)</Badge>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-white/20 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">vehicle_type</span>
                    <Badge variant="outline" className="text-[9px] font-mono">ENUM (select)</Badge>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-white/20 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">payload_capacity_kg</span>
                    <Badge variant="outline" className="text-[9px] font-mono">DECIMAL (number)</Badge>
                  </div>
                </>
              )}
              {activeModel === 'invoice' && (
                <>
                  <div className="p-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-white/20 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">invoice_number</span>
                    <Badge variant="outline" className="text-[9px] font-mono">STRING (text)</Badge>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-white/20 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">total_amount</span>
                    <Badge variant="outline" className="text-[9px] font-mono">DECIMAL (usd)</Badge>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-white/20 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">payment_status</span>
                    <Badge variant="outline" className="text-[9px] font-mono">ENUM (select)</Badge>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Column 2: Live Dynamic Form Mockup (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl bg-white/40 dark:bg-black/20 p-4 border border-white/20">
            <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
              <LayoutTemplate className="w-3.5 h-3.5 text-emerald-500" />
              <span>Biểu mẫu động được sinh tự động</span>
            </h4>
            <div className="space-y-3">
              {activeModel === 'article' && (
                <>
                  <div className="space-y-1">
                    <label htmlFor="showcase-article-title" className="text-[11px] font-medium text-muted-foreground">Tiêu đề bài viết *</label>
                    <input
                      id="showcase-article-title"
                      aria-label="Tiêu đề bài viết"
                      type="text"
                      disabled
                      value="Kiến trúc Multi-Tenant Dynamic Metadata với Unipost"
                      className="w-full text-xs p-2 rounded-lg bg-white/60 dark:bg-white/5 border border-white/20 text-foreground cursor-default"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Trạng thái phát hành</label>
                    <div className="w-full text-xs p-2 rounded-lg bg-white/60 dark:bg-white/5 border border-white/20 text-foreground flex items-center justify-between">
                      <span>PUBLISHED</span>
                      <span className="text-[10px] text-emerald-500 font-bold">✓ Active</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-foreground font-medium">Đánh dấu Tin Tiêu Điểm</span>
                    <div className="h-5 w-9 rounded-full bg-blue-600 relative">
                      <div className="h-4 w-4 rounded-full bg-white absolute top-0.5 right-0.5 shadow-xs" />
                    </div>
                  </div>
                </>
              )}
              {activeModel === 'vehicle' && (
                <>
                  <div className="space-y-1">
                    <label htmlFor="showcase-plate-number" className="text-[11px] font-medium text-muted-foreground">Biển kiểm soát *</label>
                    <input
                      id="showcase-plate-number"
                      aria-label="Biển kiểm soát"
                      type="text"
                      disabled
                      value="29C-888.99"
                      className="w-full text-xs p-2 rounded-lg bg-white/60 dark:bg-white/5 border border-white/20 text-foreground cursor-default"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="showcase-payload-cap" className="text-[11px] font-medium text-muted-foreground">Tải trọng tối đa (KG)</label>
                    <input
                      id="showcase-payload-cap"
                      aria-label="Tải trọng tối đa"
                      type="text"
                      disabled
                      value="3500 KG"
                      className="w-full text-xs p-2 rounded-lg bg-white/60 dark:bg-white/5 border border-white/20 text-foreground cursor-default"
                    />
                  </div>
                </>
              )}
              {activeModel === 'invoice' && (
                <>
                  <div className="space-y-1">
                    <label htmlFor="showcase-invoice-num" className="text-[11px] font-medium text-muted-foreground">Số hóa đơn *</label>
                    <input
                      id="showcase-invoice-num"
                      aria-label="Số hóa đơn"
                      type="text"
                      disabled
                      value="INV-2026-0042"
                      className="w-full text-xs p-2 rounded-lg bg-white/60 dark:bg-white/5 border border-white/20 text-foreground cursor-default"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="showcase-total-amount" className="text-[11px] font-medium text-muted-foreground">Tổng thanh toán (USD)</label>
                    <input
                      id="showcase-total-amount"
                      aria-label="Tổng thanh toán"
                      type="text"
                      disabled
                      value="$ 12,450.00"
                      className="w-full text-xs p-2 rounded-lg bg-white/60 dark:bg-white/5 border border-white/20 text-foreground cursor-default font-mono font-bold"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Column 3: Graph Relationship Edge (3 cols) */}
          <div className="lg:col-span-3 rounded-2xl bg-white/40 dark:bg-black/20 p-4 border border-white/20 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
                <GitFork className="w-3.5 h-3.5 text-violet-500" />
                <span>Pattern C Graph</span>
              </h4>
              <p className="text-[11px] text-muted-foreground mb-3">
                Quan hệ đồ thị không cần Foreign Key cứng:
              </p>
              <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs space-y-1.5">
                <div className="font-semibold text-violet-700 dark:text-violet-300">
                  {activeModel === 'article'
                    ? 'Article ➔ Category'
                    : activeModel === 'vehicle'
                    ? 'Consignment ➔ Vehicle'
                    : 'Invoice ➔ Account'}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  Cardinality: MANY_TO_ONE (N:1)
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/20 text-[11px] text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Truy vấn 2 chiều không chậm trễ</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

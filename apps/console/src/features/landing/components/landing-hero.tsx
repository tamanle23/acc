import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight, Database, Layers, GitFork, ShieldCheck } from 'lucide-react';

interface Props {
  onGetStarted: () => void;
  onExploreBlueprints: () => void;
}

export const LandingHero: React.FC<Props> = ({
  onGetStarted,
  onExploreBlueprints,
}) => {
  return (
    <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28 px-4 sm:px-8">
      {/* Liquid Glass Background Accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-blue-500/20 via-indigo-500/15 to-purple-500/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-5xl mx-auto text-center relative z-10 flex flex-col items-center">
        {/* Top Feature Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-sm mb-6 text-xs text-foreground font-medium animate-pulse">
          <Sparkles className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          <span>Multi-Tenant Dynamic Metadata Architecture v2.2</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
            Sub-250ms Seeding
          </span>
        </div>

        {/* Main Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-foreground max-w-4xl leading-[1.15]">
          Nền Tảng Quản Trị Dữ Liệu Động &{' '}
          <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-500 bg-clip-text text-transparent">
            Metadata Đa Khách Hàng
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-5 text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
          Xây dựng hệ thống quản lý dữ liệu, biểu mẫu động và đồ thị quan hệ không cần viết code và không cần migration database. Khởi tạo workspace doanh nghiệp ngay tức thì với Domain Blueprints chuẩn hóa.
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            onClick={onGetStarted}
            className="h-11 px-6 text-sm gap-2 font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xl shadow-blue-500/25 transition-all hover:scale-[1.02]"
          >
            <span>🚀 Bắt đầu miễn phí</span>
            <ArrowRight className="h-4 w-4" />
          </Button>

          <Button
            size="lg"
            variant="outline"
            onClick={onExploreBlueprints}
            className="h-11 px-6 text-sm gap-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-white/30 dark:border-white/10 hover:bg-white/80 dark:hover:bg-slate-900/80 text-foreground font-semibold shadow-md"
          >
            <Layers className="h-4 w-4 text-primary" />
            <span>Khám phá Domain Blueprints</span>
          </Button>
        </div>

        {/* Highlight Feature Metric Chips */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-3xl text-left">
          <div className="p-3.5 rounded-2xl bg-white/45 dark:bg-slate-900/45 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-sm">
            <Database className="h-4 w-4 text-blue-500 mb-1" />
            <div className="text-sm font-bold text-foreground">Zero Downtime</div>
            <div className="text-[11px] text-muted-foreground">JSON Schema compile</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/45 dark:bg-slate-900/45 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-sm">
            <GitFork className="h-4 w-4 text-violet-500 mb-1" />
            <div className="text-sm font-bold text-foreground">Pattern C Graph</div>
            <div className="text-[11px] text-muted-foreground">Adjacency edges</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/45 dark:bg-slate-900/45 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-sm">
            <ShieldCheck className="h-4 w-4 text-emerald-500 mb-1" />
            <div className="text-sm font-bold text-foreground">Postgres RLS</div>
            <div className="text-[11px] text-muted-foreground">Cô lập dữ liệu tuyệt đối</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/45 dark:bg-slate-900/45 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-sm">
            <Sparkles className="h-4 w-4 text-amber-500 mb-1" />
            <div className="text-sm font-bold text-foreground">&lt; 250ms Seeding</div>
            <div className="text-[11px] text-muted-foreground">Pre-warmed L1/L2 cache</div>
          </div>
        </div>
      </div>
    </section>
  );
};

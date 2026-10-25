import React from 'react';
import { Layers } from 'lucide-react';

export const LandingFooter: React.FC = () => {
  return (
    <footer className="w-full border-t border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl py-12 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white font-black text-sm">
            U
          </div>
          <div>
            <span className="font-extrabold text-foreground text-sm tracking-tight">
              Acc Platform
            </span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Hệ thống Quản trị Metadata & Dữ liệu Động Đa Khách Hàng.
            </p>
          </div>
        </div>

        <div className="text-xs text-muted-foreground text-center sm:text-right space-y-1">
          <div>Bản quyền © 2026 Acc Inc. Bảo lưu mọi quyền.</div>
          <div className="text-[11px] text-muted-foreground/80">
            Hỗ trợ thanh toán bảo mật đa kênh qua cổng VietQR Napas247.
          </div>
        </div>
      </div>
    </footer>
  );
};

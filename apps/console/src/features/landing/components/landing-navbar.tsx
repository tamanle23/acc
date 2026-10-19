import React from 'react';
import { Button } from '@/components/ui/button';
import { ThemeSwitch } from '@/components/theme-switch';
import { ArrowRight } from 'lucide-react';

interface Props {
  onOpenSignUp: () => void;
  onOpenSignIn: () => void;
}

export const LandingNavbar: React.FC<Props> = ({ onOpenSignUp, onOpenSignIn }) => {
  return (
    <header className="sticky top-0 z-50 w-full px-4 sm:px-8 py-3.5 backdrop-blur-2xl bg-white/70 dark:bg-slate-900/75 border-b border-white/30 dark:border-white/10 transition-all duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-black text-lg">
            U
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-foreground text-base tracking-tight leading-none">
              Unipost
            </span>
            <span className="text-[10px] text-muted-foreground font-mono leading-tight mt-0.5">
              Metadata Platform
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">
            Tính năng
          </a>
          <a href="#showcase" className="hover:text-foreground transition-colors">
            Giải pháp
          </a>
          <a href="#pricing" className="hover:text-foreground transition-colors">
            Bảng giá
          </a>
          <a href="#blueprints" className="hover:text-foreground transition-colors">
            Domain Blueprints
          </a>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          <ThemeSwitch />
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenSignIn}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Đăng nhập
          </Button>
          <Button
            size="sm"
            onClick={onOpenSignUp}
            className="text-xs gap-1.5 font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 hover:shadow-lg transition-all"
          >
            <span>Dùng thử miễn phí</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

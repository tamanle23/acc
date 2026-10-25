import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Badge,
} from './ui';
import {
  useTheme,
  type ThemeMode,
  type GlassStyle,
  type BlurIntensity,
  type AccentColor,
} from '../lib/theme/ThemeProvider';
import { Sliders, Sun, Moon, Sparkles, RefreshCw, Layers, Check } from 'lucide-react';

const GLASS_STYLES: { id: GlassStyle; label: string; desc: string }[] = [
  { id: 'specular', label: 'Specular Sheen', desc: 'Sharpened top-edge highlight with subtle rim reflection' },
  { id: 'frosted', label: 'Frosted Matte', desc: 'Soft diffused surface with zero specular rim distraction' },
  { id: 'cyber', label: 'Cyber Glow', desc: 'Vibrant edge emission tuned for futuristic interfaces' },
];

const BLUR_INTENSITIES: { id: BlurIntensity; label: string; px: string }[] = [
  { id: 'low', label: 'Low', px: '6px' },
  { id: 'medium', label: 'Medium', px: '18px' },
  { id: 'high', label: 'High', px: '40px' },
];

const ACCENT_COLORS: { id: AccentColor; label: string; hex: string }[] = [
  { id: 'cyan', label: 'Cyan', hex: '#06b6d4' },
  { id: 'violet', label: 'Violet', hex: '#8b5cf6' },
  { id: 'emerald', label: 'Emerald', hex: '#10b981' },
  { id: 'amber', label: 'Amber', hex: '#f59e0b' },
  { id: 'rose', label: 'Rose', hex: '#f43f5e' },
];

export function SettingsModal() {
  const { preferences, setTheme, resetTheme, isSettingsOpen, setIsSettingsOpen } = useTheme();

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
      <DialogContent className="sm:max-w-2xl max-w-xl glass-panel text-foreground border-[var(--glass-border)] p-6 rounded-2xl shadow-2xl backdrop-blur-2xl">
        <DialogHeader className="pb-3 border-b border-[var(--glass-border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg glass-badge-accent flex items-center justify-center">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  Studio Liquid Glass Preferences
                  <Badge variant="secondary" className="font-mono text-[10px] glass-badge-accent">
                    Live Reactive
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Tune optical refraction, depth blur, and ambient illumination in real-time.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4 text-xs">
          {/* 1. Theme Mode (Dark Obsidian vs Light Frosted Acrylic) */}
          <div className="space-y-2">
            <label className="font-semibold text-foreground/90 tracking-wide uppercase text-[11px] flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              Workspace Appearance
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTheme({ mode: 'dark' })}
                data-active={preferences.mode === 'dark'}
                className="glass-pill flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium cursor-pointer"
              >
                <Moon className="w-3.5 h-3.5" />
                Dark Obsidian (Default)
              </button>
              <button
                type="button"
                onClick={() => setTheme({ mode: 'light' })}
                data-active={preferences.mode === 'light'}
                className="glass-pill flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium cursor-pointer"
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                Light Frosted Acrylic
              </button>
            </div>
          </div>

          {/* 2. Optical Glass Style */}
          <div className="space-y-2">
            <label className="font-semibold text-foreground/90 tracking-wide uppercase text-[11px] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Optical Glass Finish
            </label>
            <div className="grid grid-cols-3 gap-2">
              {GLASS_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setTheme({ glassStyle: style.id })}
                  data-active={preferences.glassStyle === style.id}
                  className="glass-pill p-2.5 rounded-lg text-left flex flex-col justify-between cursor-pointer"
                >
                  <div className="font-semibold text-foreground flex items-center justify-between mb-1">
                    <span>{style.label}</span>
                    {preferences.glassStyle === style.id && <Check className="w-3 h-3 text-[var(--accent-primary)]" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground leading-tight">{style.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Backdrop Blur Intensity */}
          <div className="space-y-2">
            <label className="font-semibold text-foreground/90 tracking-wide uppercase text-[11px] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-accent-theme" />
              Diffusion Filter Strength
            </label>
            <div className="grid grid-cols-3 gap-2">
              {BLUR_INTENSITIES.map((blur) => (
                <button
                  key={blur.id}
                  type="button"
                  onClick={() => setTheme({ blurIntensity: blur.id })}
                  data-active={preferences.blurIntensity === blur.id}
                  className="glass-pill py-2 px-3 rounded-lg text-center cursor-pointer"
                >
                  <div className="font-medium text-foreground">{blur.label}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{blur.px}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Dynamic Accent Color */}
          <div className="space-y-2">
            <label className="font-semibold text-foreground/90 tracking-wide uppercase text-[11px]">
              Ambient Accent Color
            </label>
            <div className="flex items-center gap-3">
              {ACCENT_COLORS.map((accent) => (
                <button
                  key={accent.id}
                  type="button"
                  onClick={() => setTheme({ accentColor: accent.id })}
                  data-active={preferences.accentColor === accent.id}
                  className="glass-pill group flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer"
                >
                  <span
                    className="w-3 h-3 rounded-full shadow-xs transition-transform group-hover:scale-110"
                    style={{ backgroundColor: accent.hex }}
                  />
                  <span className="text-xs text-foreground font-medium">{accent.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="pt-2">
            <label className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider block mb-1.5">
              Live Material Inspection
            </label>
            <div className="glass-card p-4 rounded-xl relative overflow-hidden flex items-center justify-between border border-[var(--glass-border)]">
              <div>
                <div className="font-semibold text-foreground text-sm">Glassmorphic Container</div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">
                  style: {preferences.glassStyle} • blur: {preferences.blurIntensity} • accent: {preferences.accentColor}
                </div>
              </div>
              <button
                type="button"
                className="glass-button text-xs px-3 py-1.5 rounded-lg text-foreground font-medium cursor-pointer"
              >
                Sample Action
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-[var(--glass-border)] flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetTheme}
            className="text-xs gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Defaults
          </Button>
          <Button
            variant="accent"
            size="sm"
            onClick={() => setIsSettingsOpen(false)}
            className="px-5 cursor-pointer"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

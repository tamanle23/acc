import React, { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';

export interface EasingPreset {
  id: string;
  name: string;
  badge: string;
  description: string;
  path: string;
}

export const GSAP_EASING_PRESETS: EasingPreset[] = [
  {
    id: 'power2.out',
    name: 'Quad Smooth',
    badge: 'Default',
    description: 'Fast entry with natural, smooth deceleration',
    path: 'M 0 45 Q 25 5, 100 5',
  },
  {
    id: 'power2.inOut',
    name: 'S-Curve',
    badge: 'Smooth',
    description: 'Gradual acceleration and gentle deceleration',
    path: 'M 0 45 C 45 45, 55 5, 100 5',
  },
  {
    id: 'back.out',
    name: 'Overshoot',
    badge: 'Punchy',
    description: 'Dynamic overshoot past boundary and snap back',
    path: 'M 0 45 C 35 15, 60 -5, 100 5',
  },
  {
    id: 'elastic.out',
    name: 'Spring',
    badge: 'Rubber',
    description: 'Damped harmonic spring oscillation',
    path: 'M 0 45 C 18 -6, 32 18, 50 -2 Q 75 6, 100 5',
  },
  {
    id: 'bounce.out',
    name: 'Physical Bounce',
    badge: 'Impact',
    description: 'Realistic gravity rebound bounces',
    path: 'M 0 45 Q 18 35, 36 5 Q 45 18, 54 18 Q 63 18, 72 5 Q 79 9, 86 9 Q 93 9, 100 5',
  },
  {
    id: 'expo.out',
    name: 'Snappy Flash',
    badge: 'Aggressive',
    description: 'Instantaneous surge followed by sudden stop',
    path: 'M 0 45 C 5 5, 20 5, 100 5',
  },
  {
    id: 'linear',
    name: 'Linear',
    badge: 'Uniform',
    description: 'Constant unaccelerated velocity',
    path: 'M 0 45 L 100 5',
  },
];

export interface EasingCurveSelectorProps {
  value?: string;
  onChange: (easingId: string) => void;
}

export function EasingCurveSelector({
  value = 'power2.out',
  onChange,
}: EasingCurveSelectorProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-foreground/90 font-semibold flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          GSAP Motion Curve
        </span>
        <span className="text-[10px] text-[var(--accent-primary)] font-mono font-bold uppercase">
          {value}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {GSAP_EASING_PRESETS.map((preset) => {
          const isSelected = value === preset.id;
          const isHovered = hoveredId === preset.id;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange(preset.id)}
              onMouseEnter={() => setHoveredId(preset.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`relative p-2 rounded-xl border text-left transition-all duration-200 cursor-pointer overflow-hidden group ${
                isSelected
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-glow)]/15 shadow-[0_0_15px_var(--accent-glow)]/20'
                  : 'border-[var(--glass-border)] bg-[var(--glass-bg)] hover:border-[var(--accent-primary)]/40 hover:-translate-y-0.5 hover:shadow-md'
              }`}
            >
              {/* Top label & badge */}
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`text-[11px] font-semibold truncate ${
                    isSelected ? 'text-[var(--accent-primary)] font-bold' : 'text-foreground/90'
                  }`}
                >
                  {preset.name}
                </span>
                <span
                  className={`text-[8px] font-mono px-1 py-0.2 rounded uppercase ${
                    isSelected
                      ? 'bg-[var(--accent-primary)] text-slate-950 font-bold'
                      : 'bg-white/10 text-muted-foreground'
                  }`}
                >
                  {preset.badge}
                </span>
              </div>

              {/* SVG Curve Preview */}
              <div className="relative h-12 w-full bg-black/40 rounded-lg p-1 border border-white/5 flex items-center justify-center overflow-hidden">
                {/* Background grid lines */}
                <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#818cf8_1px,transparent_1px)] [background-size:8px_8px]" />

                <svg
                  viewBox="-5 -15 110 70"
                  className="w-full h-full overflow-visible"
                >
                  {/* Subtle baseline and peak guideline */}
                  <line
                    x1="0"
                    y1="45"
                    x2="100"
                    y2="45"
                    stroke="rgba(255,255,255,0.15)"
                    strokeDasharray="2,2"
                    strokeWidth="0.8"
                  />
                  <line
                    x1="0"
                    y1="5"
                    x2="100"
                    y2="5"
                    stroke="rgba(255,255,255,0.15)"
                    strokeDasharray="2,2"
                    strokeWidth="0.8"
                  />

                  {/* Curve Path */}
                  <path
                    d={preset.path}
                    fill="none"
                    stroke={isSelected ? 'var(--accent-primary)' : isHovered ? '#38bdf8' : 'rgba(255,255,255,0.6)'}
                    strokeWidth={isSelected ? '2.5' : '1.8'}
                    strokeLinecap="round"
                    className="transition-colors duration-200"
                    style={{
                      filter: isSelected
                        ? 'drop-shadow(0 0 4px var(--accent-glow))'
                        : undefined,
                    }}
                  />

                  {/* Animated Traveling Ball on Hover or Selected */}
                  {(isSelected || isHovered) && (
                    <circle
                      r="3.5"
                      fill={isSelected ? 'var(--accent-primary)' : '#38bdf8'}
                      className="shadow-sm"
                      style={{
                        offsetPath: `path('${preset.path}')`,
                        animation: 'travelCurve 1.4s infinite cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    />
                  )}
                </svg>
              </div>

              {/* Description footnote */}
              <p className="text-[9px] text-muted-foreground mt-1 line-clamp-1 leading-tight">
                {preset.description}
              </p>

              {/* Active Selection Checkmark Badge */}
              {isSelected && (
                <div className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 bg-[var(--accent-primary)] text-slate-950 rounded-full flex items-center justify-center shadow-xs">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

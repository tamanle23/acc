import React, { useState } from 'react';
import { Check, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { TransitionCurveGraph } from './inspector/TransitionCurveGraph';

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
  const [showGraph, setShowGraph] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-foreground/90 font-semibold flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-accent-theme" />
          GSAP Motion Curve
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-accent-theme font-mono font-bold uppercase">
            {value}
          </span>
          {/* Toggle expanded Bezier curve graph */}
          <button
            type="button"
            onClick={() => setShowGraph(v => !v)}
            className="flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-accent-theme transition-colors"
            aria-label={showGraph ? 'Hide curve graph' : 'Show curve graph'}
          >
            {showGraph ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Graph
          </button>
        </div>
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
                  ? 'border-accent-theme bg-accent-theme/10 shadow-accent-glow'
                  : 'border-glass-border bg-glass-surface hover:border-accent-theme/40 hover:-translate-y-0.5 hover:shadow-md'
              }`}
            >
              {/* Top label & badge */}
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`text-[11px] font-semibold truncate ${
                    isSelected ? 'text-accent-theme font-bold' : 'text-foreground/90'
                  }`}
                >
                  {preset.name}
                </span>
                <span
                  className={`text-[8px] font-mono px-1 py-0.2 rounded uppercase ${
                    isSelected
                      ? 'bg-accent-theme text-primary-foreground font-bold'
                      : 'bg-muted/60 text-muted-foreground'
                  }`}
                >
                  {preset.badge}
                </span>
              </div>

              {/* SVG Curve Preview */}
              <div className="relative h-12 w-full bg-background/70 rounded-lg p-1 border border-glass-border flex items-center justify-center overflow-hidden">
                {/* Background grid lines */}
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(var(--accent-primary)_1px,transparent_1px)] [background-size:8px_8px]" />

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
                    stroke="currentColor"
                    className="text-muted-foreground/30"
                    strokeDasharray="2,2"
                    strokeWidth="0.8"
                  />
                  <line
                    x1="0"
                    y1="5"
                    x2="100"
                    y2="5"
                    stroke="currentColor"
                    className="text-muted-foreground/30"
                    strokeDasharray="2,2"
                    strokeWidth="0.8"
                  />

                  {/* Curve Path */}
                  <path
                    d={preset.path}
                    fill="none"
                    stroke={isSelected || isHovered ? 'var(--accent-primary)' : 'currentColor'}
                    strokeWidth={isSelected ? '2.5' : '1.8'}
                    strokeLinecap="round"
                    className={`transition-colors duration-200 ${isSelected || isHovered ? '' : 'text-muted-foreground/70'}`}
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
                      fill="var(--accent-primary)"
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
                <div className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 bg-accent-theme text-primary-foreground rounded-full flex items-center justify-center shadow-xs">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Expanded interactive Bezier curve graph */}
      {showGraph && (
        <div className="mt-2 w-full">
          <TransitionCurveGraph
            easingId={value}
            height={160}
            showScrubber
            onCurveChange={(p1, p2) => {
              const x1 = p1.x.toFixed(2);
              const y1 = p1.y.toFixed(2);
              const x2 = p2.x.toFixed(2);
              const y2 = p2.y.toFixed(2);
              onChange(`cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`);
            }}
          />
        </div>
      )}
    </div>
  );
}

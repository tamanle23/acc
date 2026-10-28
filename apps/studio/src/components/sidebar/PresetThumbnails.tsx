import React from 'react';
import {
  Type,
  Square,
  Circle,
  ArrowUpRight,
  Eye,
  Sun,
  Zap,
  Sparkles,
  Video,
  Music,
  Volume2,
  Film,
  Radio,
  Play,
} from 'lucide-react';
import type { StagingPreset } from '../../lib/library/stagingPresets';

export function renderPresetIcon(iconName: string) {
  switch (iconName) {
    case 'Type':
      return <Type className="w-3.5 h-3.5 text-accent-theme" />;
    case 'Square':
      return <Square className="w-3.5 h-3.5 text-accent-theme" />;
    case 'Circle':
      return <Circle className="w-3.5 h-3.5 text-accent-theme" />;
    case 'ArrowUpRight':
      return <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />;
    case 'Eye':
      return <Eye className="w-3.5 h-3.5 text-sky-400" />;
    case 'Sun':
      return <Sun className="w-3.5 h-3.5 text-amber-400" />;
    case 'Zap':
      return <Zap className="w-3.5 h-3.5 text-amber-400" />;
    case 'Volume2':
      return <Volume2 className="w-3.5 h-3.5 text-rose-400" />;
    case 'Music':
      return <Music className="w-3.5 h-3.5 text-emerald-400" />;
    case 'Video':
      return <Video className="w-3.5 h-3.5 text-blue-500" />;
    case 'Film':
      return <Film className="w-3.5 h-3.5 text-accent-theme" />;
    case 'Radio':
      return <Radio className="w-3.5 h-3.5 text-amber-500" />;
    case 'Play':
      return <Play className="w-3.5 h-3.5 text-accent-theme" />;
    case 'Sparkles':
    default:
      return <Sparkles className="w-3.5 h-3.5 text-accent-theme" />;
  }
}

interface ShapeModifierParams {
  geometry?: string;
  shapeType?: string;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  strokeDash?: number[];
  isDashed?: boolean;
  cornerRadius?: number;
  radius?: number;
  points?: number;
  innerRadiusRatio?: number;
  gradient?: {
    type?: 'linear' | 'radial';
    colors: string[];
  };
}

export function ShapePresetThumbnail({ preset }: { preset: StagingPreset }) {
  const seq = React.useMemo(() => preset.createSequence({ startFrame: 0 }), [preset]);
  const shapeMod = seq.modifiers?.find((m) => m.type === 'shape/draw' || m.type === 'shape/vector');
  const params = (shapeMod?.params || {}) as ShapeModifierParams;
  const geom: string = params.geometry || params.shapeType || 'rect';

  const strokeColor = params.strokeColor || '#818cf8';
  const fillColor = params.fillColor || (params.gradient ? undefined : 'rgba(99, 102, 241, 0.2)');
  const strokeWidth = params.strokeWidth ? Math.min(Math.max(params.strokeWidth, 1.5), 3) : 2;
  const strokeDasharray = params.strokeDash
    ? params.strokeDash.join(' ')
    : params.isDashed
      ? '4 3'
      : undefined;

  const gradientId = `grad-${preset.id}`;
  const gradient = params.gradient;

  const renderVector = () => {
    switch (geom) {
      case 'circle':
        return (
          <circle
            cx="100"
            cy="40"
            r="28"
            fill={gradient ? `url(#${gradientId})` : fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        );

      case 'pill':
        return (
          <rect
            x="35"
            y="22"
            width="130"
            height="36"
            rx="18"
            fill={gradient ? `url(#${gradientId})` : fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        );

      case 'rounded_rect':
      case 'rounded_box':
        return (
          <rect
            x="30"
            y="12"
            width="140"
            height="56"
            rx={Math.min(params.cornerRadius ?? params.radius ?? 8, 16)}
            fill={gradient ? `url(#${gradientId})` : fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        );

      case 'triangle':
        return (
          <polygon
            points="100,14 145,66 55,66"
            fill={gradient ? `url(#${gradientId})` : fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );

      case 'star': {
        const points = params.points ?? 5;
        const outerR = 26;
        const innerR = outerR * (params.innerRadiusRatio ?? 0.45);
        const pts: string[] = [];
        for (let i = 0; i < points * 2; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const angle = (i * Math.PI) / points - Math.PI / 2;
          pts.push(
            `${(100 + r * Math.cos(angle)).toFixed(1)},${(40 + r * Math.sin(angle)).toFixed(1)}`
          );
        }
        return (
          <polygon
            points={pts.join(' ')}
            fill={gradient ? `url(#${gradientId})` : fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );
      }

      case 'hexagon': {
        const r = 28;
        const pts: string[] = [];
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3 - Math.PI / 6;
          pts.push(
            `${(100 + r * Math.cos(angle)).toFixed(1)},${(40 + r * Math.sin(angle)).toFixed(1)}`
          );
        }
        return (
          <polygon
            points={pts.join(' ')}
            fill={gradient ? `url(#${gradientId})` : fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );
      }

      case 'cross':
        return (
          <path
            d="M93,16 L107,16 L107,33 L124,33 L124,47 L107,47 L107,64 L93,64 L93,47 L76,47 L76,33 L93,33 Z"
            fill={gradient ? `url(#${gradientId})` : fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );

      case 'frame':
        return (
          <rect
            x="25"
            y="12"
            width="150"
            height="56"
            rx="6"
            fill="none"
            stroke={strokeColor}
            strokeWidth={Math.max(strokeWidth, 3)}
          />
        );

      case 'arrow':
        return (
          <path
            d="M80,55 L115,25 M115,25 L115,45 M115,25 L95,25"
            fill="none"
            stroke={strokeColor}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'rect':
      default:
        return (
          <rect
            x="30"
            y="14"
            width="140"
            height="52"
            rx="4"
            fill={gradient ? `url(#${gradientId})` : fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        );
    }
  };

  return (
    <div className="relative w-full h-20 mb-2 rounded-lg overflow-hidden border border-border/40 bg-card/60 pointer-events-none group-hover:border-accent-theme/50 group-hover:bg-card/80 transition-all flex items-center justify-center">
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(var(--accent-primary)_1px,transparent_1px)] [background-size:12px_12px]" />
      <svg viewBox="0 0 200 80" className="w-full h-full relative z-10 drop-shadow-sm">
        {gradient && (
          <defs>
            {gradient.type === 'radial' ? (
              <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
                {gradient.colors.map((c: string, idx: number) => (
                  <stop
                    key={idx}
                    offset={`${(idx / (gradient.colors.length - 1)) * 100}%`}
                    stopColor={c}
                  />
                ))}
              </radialGradient>
            ) : (
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                {gradient.colors.map((c: string, idx: number) => (
                  <stop
                    key={idx}
                    offset={`${(idx / (gradient.colors.length - 1)) * 100}%`}
                    stopColor={c}
                  />
                ))}
              </linearGradient>
            )}
          </defs>
        )}
        {renderVector()}
      </svg>
      <div className="absolute bottom-1 right-1.5 z-20">
        <span className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground/80 bg-background/70 px-1 rounded border border-border/30">
          {geom.replace('_', ' ')}
        </span>
      </div>
    </div>
  );
}

interface TextStyleModifierParams {
  fontFamily?: string;
  fontWeight?: number | string;
  textColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  glowColor?: string;
  glowBlur?: number;
  letterSpacing?: number;
  shadowColor?: string;
  shadowBlur?: number;
}

export function TypographyPresetThumbnail({ preset }: { preset: StagingPreset }) {
  const seq = React.useMemo(() => preset.createSequence({ startFrame: 0 }), [preset]);
  const textMod = seq.modifiers?.find((m) => m.type === 'text/style');
  const params = (textMod?.params || {}) as TextStyleModifierParams;

  const cueText = seq.cues?.[0]?.text || preset.name;
  const fontFamily = params.fontFamily || 'Inter, system-ui, sans-serif';
  const fontWeight = params.fontWeight || 700;
  const textColor = params.textColor || '#ffffff';
  const strokeColor = params.strokeColor;
  const strokeWidth = params.strokeWidth;
  const glowColor = params.glowColor;
  const glowBlur = params.glowBlur ?? 8;
  const letterSpacing = params.letterSpacing ? `${params.letterSpacing}px` : 'normal';

  const textShadowParts: string[] = [];
  if (glowColor) {
    textShadowParts.push(`0 0 ${glowBlur}px ${glowColor}`);
    textShadowParts.push(`0 0 ${glowBlur * 2}px ${glowColor}`);
  }
  if (params.shadowColor) {
    textShadowParts.push(`0 2px ${params.shadowBlur ?? 4}px ${params.shadowColor}`);
  }
  const textShadow =
    textShadowParts.length > 0 ? textShadowParts.join(', ') : '0 2px 8px rgba(0,0,0,0.5)';

  const webkitTextStroke =
    strokeColor && strokeWidth ? `${strokeWidth}px ${strokeColor}` : undefined;

  return (
    <div className="relative w-full h-20 mb-2 rounded-lg overflow-hidden border border-border/40 bg-card/60 pointer-events-none group-hover:border-accent-theme/50 group-hover:bg-card/80 transition-all flex items-center justify-center p-2">
      <div className="absolute inset-0 opacity-15 bg-[linear-gradient(to_right,var(--accent-primary)_1px,transparent_1px),linear-gradient(to_bottom,var(--accent-primary)_1px,transparent_1px)] bg-[size:16px_16px]" />

      <div className="relative z-10 text-center px-2 w-full flex flex-col items-center justify-center overflow-hidden">
        <span
          className="truncate max-w-full leading-tight select-none font-bold"
          style={{
            fontFamily,
            fontWeight,
            color: textColor,
            textShadow,
            WebkitTextStroke: webkitTextStroke,
            letterSpacing,
            fontSize: '15px',
          }}
        >
          {cueText}
        </span>
      </div>

      <div className="absolute bottom-1 right-1.5 z-20">
        <span className="text-[8px] font-mono text-muted-foreground/80 bg-background/80 px-1 rounded border border-border/30">
          {fontFamily.split(',')[0].replace(/['"]/g, '')}
        </span>
      </div>
    </div>
  );
}

import { createMemo, For, Show } from 'solid-js';
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
} from 'lucide-solid';
import type { StagingPreset } from '../../lib/library/stagingPresets';

export function renderPresetIcon(iconName: string) {
  switch (iconName) {
    case 'Type':
      return <Type class="w-3.5 h-3.5 text-accent-theme" />;
    case 'Square':
      return <Square class="w-3.5 h-3.5 text-accent-theme" />;
    case 'Circle':
      return <Circle class="w-3.5 h-3.5 text-accent-theme" />;
    case 'ArrowUpRight':
      return <ArrowUpRight class="w-3.5 h-3.5 text-rose-500" />;
    case 'Eye':
      return <Eye class="w-3.5 h-3.5 text-sky-400" />;
    case 'Sun':
      return <Sun class="w-3.5 h-3.5 text-amber-400" />;
    case 'Zap':
      return <Zap class="w-3.5 h-3.5 text-amber-400" />;
    case 'Volume2':
      return <Volume2 class="w-3.5 h-3.5 text-rose-400" />;
    case 'Music':
      return <Music class="w-3.5 h-3.5 text-emerald-400" />;
    case 'Video':
      return <Video class="w-3.5 h-3.5 text-blue-500" />;
    case 'Film':
      return <Film class="w-3.5 h-3.5 text-accent-theme" />;
    case 'Radio':
      return <Radio class="w-3.5 h-3.5 text-amber-500" />;
    case 'Play':
      return <Play class="w-3.5 h-3.5 text-accent-theme" />;
    case 'Sparkles':
    default:
      return <Sparkles class="w-3.5 h-3.5 text-accent-theme" />;
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

export function ShapePresetThumbnail(props: { preset: StagingPreset }) {
  const seq = createMemo(() => props.preset.createSequence({ startFrame: 0 }));
  const shapeMod = () => seq().modifiers?.find((m) => m.type === 'shape/draw' || m.type === 'shape/vector');
  const params = () => ((shapeMod()?.params || {}) as ShapeModifierParams);
  const geom = () => params().geometry || params().shapeType || 'rect';

  const strokeColor = () => params().strokeColor || '#818cf8';
  const fillColor = () => params().fillColor || (params().gradient ? undefined : 'rgba(99, 102, 241, 0.2)');
  const strokeWidth = () => (params().strokeWidth ? Math.min(Math.max(params().strokeWidth!, 1.5), 3) : 2);
  const strokeDasharray = () =>
    params().strokeDash
      ? params().strokeDash!.join(' ')
      : params().isDashed
        ? '4 3'
        : undefined;

  const gradientId = () => `grad-${props.preset.id}`;
  const gradient = () => params().gradient;

  const renderVector = () => {
    switch (geom()) {
      case 'circle':
        return (
          <circle
            cx="100"
            cy="40"
            r="28"
            fill={gradient() ? `url(#${gradientId()})` : fillColor()}
            stroke={strokeColor()}
            stroke-width={strokeWidth()}
            stroke-dasharray={strokeDasharray()}
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
            fill={gradient() ? `url(#${gradientId()})` : fillColor()}
            stroke={strokeColor()}
            stroke-width={strokeWidth()}
            stroke-dasharray={strokeDasharray()}
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
            rx={Math.min(params().cornerRadius ?? params().radius ?? 8, 16)}
            fill={gradient() ? `url(#${gradientId()})` : fillColor()}
            stroke={strokeColor()}
            stroke-width={strokeWidth()}
            stroke-dasharray={strokeDasharray()}
          />
        );

      case 'triangle':
        return (
          <polygon
            points="100,14 145,66 55,66"
            fill={gradient() ? `url(#${gradientId()})` : fillColor()}
            stroke={strokeColor()}
            stroke-width={strokeWidth()}
          />
        );

      case 'star': {
        const points = params().points ?? 5;
        const outerR = 26;
        const innerR = outerR * (params().innerRadiusRatio ?? 0.45);
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
            fill={gradient() ? `url(#${gradientId()})` : fillColor()}
            stroke={strokeColor()}
            stroke-width={strokeWidth()}
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
            fill={gradient() ? `url(#${gradientId()})` : fillColor()}
            stroke={strokeColor()}
            stroke-width={strokeWidth()}
          />
        );
      }

      case 'cross':
        return (
          <path
            d="M93,16 L107,16 L107,33 L124,33 L124,47 L107,47 L107,64 L93,64 L93,47 L76,47 L76,33 L93,33 Z"
            fill={gradient() ? `url(#${gradientId()})` : fillColor()}
            stroke={strokeColor()}
            stroke-width={strokeWidth()}
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
            stroke={strokeColor()}
            stroke-width={Math.max(strokeWidth(), 3)}
          />
        );

      case 'arrow':
        return (
          <path
            d="M80,55 L115,25 M115,25 L115,45 M115,25 L95,25"
            fill="none"
            stroke={strokeColor()}
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
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
            fill={gradient() ? `url(#${gradientId()})` : fillColor()}
            stroke={strokeColor()}
            stroke-width={strokeWidth()}
            stroke-dasharray={strokeDasharray()}
          />
        );
    }
  };

  return (
    <div class="relative w-full h-20 mb-2 rounded-lg overflow-hidden border border-border/40 bg-card/60 pointer-events-none group-hover:border-accent-theme/50 group-hover:bg-card/80 transition-all flex items-center justify-center">
      <div class="absolute inset-0 opacity-20 bg-[radial-gradient(var(--accent-primary)_1px,transparent_1px)] [background-size:12px_12px]" />
      <svg viewBox="0 0 200 80" class="w-full h-full relative z-10 drop-shadow-sm">
        <Show when={gradient()}>
          <defs>
            <Show
              when={gradient()?.type === 'radial'}
              fallback={
                <linearGradient id={gradientId()} x1="0%" y1="0%" x2="100%" y2="100%">
                  <For each={gradient()?.colors || []}>
                    {(c, idx) => (
                      <stop
                        offset={`${(idx() / (gradient()!.colors.length - 1)) * 100}%`}
                        stop-color={c}
                      />
                    )}
                  </For>
                </linearGradient>
              }
            >
              <radialGradient id={gradientId()} cx="50%" cy="50%" r="50%">
                <For each={gradient()?.colors || []}>
                  {(c, idx) => (
                    <stop
                      offset={`${(idx() / (gradient()!.colors.length - 1)) * 100}%`}
                      stop-color={c}
                    />
                  )}
                </For>
              </radialGradient>
            </Show>
          </defs>
        </Show>
        {renderVector()}
      </svg>
      <div class="absolute bottom-1 right-1.5 z-20">
        <span class="text-[8px] font-mono uppercase tracking-wider text-muted-foreground/80 bg-background/70 px-1 rounded border border-border/30">
          {geom().replace('_', ' ')}
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

export function TypographyPresetThumbnail(props: { preset: StagingPreset }) {
  const seq = createMemo(() => props.preset.createSequence({ startFrame: 0 }));
  const textMod = () =>
    seq().modifiers?.find(
      (m) =>
        (m.type as string) === 'text/draw' ||
        (m.type as string) === 'text/overlay' ||
        m.type === 'timed_text/style' ||
        (m.type as string) === 'text/style'
    );
  const params = () => ((textMod()?.params || {}) as TextStyleModifierParams & { text?: string });

  const cueText = () => params().text || seq().cues?.[0]?.text || props.preset.name;
  const fontFamily = () => params().fontFamily || 'Inter, system-ui, sans-serif';
  const fontWeight = () => params().fontWeight || 700;
  const textColor = () => params().textColor || '#ffffff';
  const strokeColor = () => params().strokeColor;
  const strokeWidth = () => params().strokeWidth;
  const glowColor = () => params().glowColor;
  const glowBlur = () => params().glowBlur ?? 8;
  const letterSpacing = () => (params().letterSpacing ? `${params().letterSpacing}px` : 'normal');

  const textShadow = () => {
    const textShadowParts: string[] = [];
    if (glowColor()) {
      textShadowParts.push(`0 0 ${glowBlur()}px ${glowColor()}`);
      textShadowParts.push(`0 0 ${glowBlur() * 2}px ${glowColor()}`);
    }
    if (params().shadowColor) {
      textShadowParts.push(`0 2px ${params().shadowBlur ?? 4}px ${params().shadowColor}`);
    }
    return textShadowParts.length > 0 ? textShadowParts.join(', ') : '0 2px 8px rgba(0,0,0,0.5)';
  };

  const webkitTextStroke = () =>
    strokeColor() && strokeWidth() ? `${strokeWidth()}px ${strokeColor()}` : undefined;

  return (
    <div class="relative w-full h-20 mb-2 rounded-lg overflow-hidden border border-border/40 bg-card/60 pointer-events-none group-hover:border-accent-theme/50 group-hover:bg-card/80 transition-all flex items-center justify-center p-2">
      <div class="absolute inset-0 opacity-15 bg-[linear-gradient(to_right,var(--accent-primary)_1px,transparent_1px),linear-gradient(to_bottom,var(--accent-primary)_1px,transparent_1px)] bg-[size:16px_16px]" />

      <div class="relative z-10 text-center px-2 w-full flex flex-col items-center justify-center overflow-hidden">
        <span
          class="truncate max-w-full leading-tight select-none font-bold"
          style={{
            "font-family": fontFamily(),
            "font-weight": fontWeight(),
            color: textColor(),
            "text-shadow": textShadow(),
            "-webkit-text-stroke": webkitTextStroke(),
            "letter-spacing": letterSpacing(),
            "font-size": '15px',
          }}
        >
          {cueText()}
        </span>
      </div>

      <div class="absolute bottom-1 right-1.5 z-20">
        <span class="text-[8px] font-mono text-muted-foreground/80 bg-background/80 px-1 rounded border border-border/30">
          {fontFamily().split(',')[0].replace(/['"]/g, '')}
        </span>
      </div>
    </div>
  );
}

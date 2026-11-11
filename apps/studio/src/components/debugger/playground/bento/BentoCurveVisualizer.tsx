import { createSignal, onMount, onCleanup, createEffect, For, Show } from 'solid-js';
import { TrendingUp, Activity, Sparkles } from 'lucide-solid';
import { Badge } from '../../../ui/badge';
import type { PlaygroundEngine } from '../usePlaygroundEngine';

export interface BentoCurveVisualizerProps {
  engine: PlaygroundEngine;
  class?: string;
}

export type EasingType = 'linear' | 'easeOutCubic' | 'easeInOutCubic' | 'easeInOutBack' | 'equal_power' | 'elastic';

const EASING_FUNCTIONS: Record<EasingType, { name: string; fn: (t: number) => number; desc: string }> = {
  linear: {
    name: 'Linear',
    fn: (t) => t,
    desc: 'Constant velocity rate',
  },
  easeOutCubic: {
    name: 'Ease Out Cubic',
    fn: (t) => 1 - Math.pow(1 - t, 3),
    desc: 'Smooth deceleration to stop',
  },
  easeInOutCubic: {
    name: 'Ease In-Out Cubic',
    fn: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    desc: 'Gentle acceleration & deceleration',
  },
  easeInOutBack: {
    name: 'Back In-Out',
    fn: (t) => {
      const c1 = 1.70158;
      const c2 = c1 * 1.525;
      return t < 0.5
        ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
        : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    },
    desc: 'Elastic overshoot & settle',
  },
  equal_power: {
    name: 'Equal Power',
    fn: (t) => Math.sin((t * Math.PI) / 2),
    desc: 'Constant acoustic / crossfade energy',
  },
  elastic: {
    name: 'Elastic Out',
    fn: (t) => {
      if (t === 0) return 0;
      if (t === 1) return 1;
      return Math.pow(2, -10 * t) * Math.sin(((t * 10 - 0.75) * (2 * Math.PI)) / 3) + 1;
    },
    desc: 'Dynamic spring vibration',
  },
};

export function BentoCurveVisualizer(props: BentoCurveVisualizerProps) {
  const { state } = props.engine;
  const [selectedCurve, setSelectedCurve] = createSignal<EasingType>('easeOutCubic');
  let canvasRef: HTMLCanvasElement | undefined;
  let animId: number | null = null;

  const currentCurveInfo = () => EASING_FUNCTIONS[selectedCurve()];

  const drawGraph = () => {
    if (!canvasRef) return;
    const ctx = canvasRef.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const width = canvasRef.width;
    const height = canvasRef.height;
    const pad = 20;
    const plotW = width - pad * 2;
    const plotH = height - pad * 2;

    ctx.clearRect(0, 0, width, height);

    // Read system theme variables
    let accent = '#06b6d4';
    let isDark = true;
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const rootStyle = getComputedStyle(document.documentElement);
      const themeAccent = rootStyle.getPropertyValue('--accent-primary').trim();
      if (themeAccent) accent = themeAccent;
      isDark = document.documentElement.classList.contains('dark');
    }

    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
    const hairlineColor = isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)';

    // Background grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    for (let i = 0; i <= 4; i++) {
      const x = pad + (plotW * i) / 4;
      const y = pad + (plotH * i) / 4;

      ctx.beginPath();
      ctx.moveTo(x, pad);
      ctx.lineTo(x, height - pad);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(width - pad, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Curve Path
    const curveDef = currentCurveInfo();
    const steps = 100;

    // Glowing Under-Area Fill
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pad, height - pad);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const val = curveDef.fn(t);
      const px = pad + t * plotW;
      const py = height - pad - val * plotH;
      ctx.lineTo(px, py);
    }
    ctx.lineTo(width - pad, height - pad);
    ctx.closePath();

    const areaGrad = ctx.createLinearGradient(0, pad, 0, height - pad);
    areaGrad.addColorStop(0, isDark ? 'rgba(6, 182, 212, 0.25)' : 'rgba(6, 182, 212, 0.15)');
    areaGrad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
    ctx.fillStyle = areaGrad;
    ctx.fill();
    ctx.restore();

    // Glowing Curve Stroke
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = accent;

    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const val = curveDef.fn(t);
      const px = pad + t * plotW;
      const py = height - pad - val * plotH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();

    // Current Playhead Position Marker
    const progress = Math.min(1, Math.max(0, state.currentFrame / Math.max(1, state.totalFrames - 1)));
    const curVal = curveDef.fn(progress);
    const markerX = pad + progress * plotW;
    const markerY = height - pad - curVal * plotH;

    // Playhead vertical hairline
    ctx.save();
    ctx.strokeStyle = hairlineColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(markerX, pad);
    ctx.lineTo(markerX, height - pad);
    ctx.stroke();
    ctx.restore();

    // Glowing Playhead Ball
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
    ctx.beginPath();
    ctx.arc(markerX, markerY, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  };

  const renderLoop = () => {
    drawGraph();
    animId = requestAnimationFrame(renderLoop);
  };

  onMount(() => {
    animId = requestAnimationFrame(renderLoop);
  });

  onCleanup(() => {
    if (animId !== null) cancelAnimationFrame(animId);
  });

  // Current calculated value at playhead
  const currentValue = () => {
    const progress = Math.min(1, Math.max(0, state.currentFrame / Math.max(1, state.totalFrames - 1)));
    return currentCurveInfo().fn(progress);
  };

  return (
    <div
      class={`flex flex-col h-full w-full min-h-0 min-w-0 glass-panel rounded-2xl border border-[var(--glass-border)] border-t-[var(--glass-border-highlight)] bg-glass-surface/50 backdrop-blur-xl shadow-lg p-2.5 transition-all duration-200 overflow-hidden select-none ${
        props.class || ''
      }`}
    >
      {/* Header */}
      <div class="flex items-center justify-between gap-2 mb-1.5 shrink-0">
        <div class="flex items-center gap-2">
          <div class="flex h-6 w-6 items-center justify-center rounded-md bg-accent-theme/15 text-accent-theme border border-accent-theme/30">
            <TrendingUp class="h-3.5 w-3.5" />
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-foreground">Motion Curves</span>
            </div>
            <p class="text-[9px] text-muted-foreground">Temporal interpolation</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Badge variant="outline" class="text-[9px] py-0 px-1.5 h-4 font-mono text-accent-theme border-accent-theme/30 bg-accent-theme/10">
            f(t) = {currentValue().toFixed(3)}
          </Badge>
        </div>
      </div>

      {/* Curve Selector Pills */}
      <div class="flex flex-wrap gap-1 mb-1.5 shrink-0">
        <For each={Object.keys(EASING_FUNCTIONS) as EasingType[]}>
          {(curveKey) => {
            const isSelected = () => selectedCurve() === curveKey;
            return (
              <button
                type="button"
                onClick={() => setSelectedCurve(curveKey)}
                class={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors border ${
                  isSelected()
                    ? 'bg-accent-theme/20 text-accent-theme border-accent-theme/40 font-bold shadow-xs'
                    : 'bg-glass-surface/40 text-muted-foreground border-glass-border hover:text-foreground hover:bg-glass-surface'
                }`}
              >
                {EASING_FUNCTIONS[curveKey].name}
              </button>
            );
          }}
        </For>
      </div>

      {/* Canvas Graph Viewport */}
      <div class="relative w-full flex-1 min-h-0 rounded-xl bg-background/50 border border-glass-border overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} width={400} height={200} class="w-full h-full object-contain" />

        {/* Legend info in bottom right */}
        <div class="absolute bottom-1 right-2 text-[8px] font-mono text-muted-foreground pointer-events-none">
          t: {((state.currentFrame / Math.max(1, state.totalFrames - 1)) * 100).toFixed(0)}%
        </div>
      </div>

      {/* Curve description */}
      <div class="mt-1 text-[9px] text-muted-foreground italic flex items-center justify-between shrink-0">
        <span class="truncate">{currentCurveInfo().desc}</span>
        <span class="font-mono text-[8px] shrink-0">[0..1]</span>
      </div>
    </div>
  );
}

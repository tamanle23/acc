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
    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    const width = canvasRef.width;
    const height = canvasRef.height;
    const pad = 24;
    const plotW = width - pad * 2;
    const plotH = height - pad * 2;

    ctx.clearRect(0, 0, width, height);

    // Background grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
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
    areaGrad.addColorStop(0, 'rgba(168, 85, 247, 0.25)');
    areaGrad.addColorStop(1, 'rgba(168, 85, 247, 0.0)');
    ctx.fillStyle = areaGrad;
    ctx.fill();
    ctx.restore();

    // Glowing Curve Stroke
    ctx.save();
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2.5;

    const lineGrad = ctx.createLinearGradient(pad, 0, width - pad, 0);
    lineGrad.addColorStop(0, '#818cf8');
    lineGrad.addColorStop(0.5, '#c084fc');
    lineGrad.addColorStop(1, '#f472b6');
    ctx.strokeStyle = lineGrad;

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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(markerX, pad);
    ctx.lineTo(markerX, height - pad);
    ctx.stroke();
    ctx.restore();

    // Glowing Playhead Ball
    ctx.save();
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(markerX, markerY, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
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
      class={`flex flex-col rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-xl overflow-hidden p-3.5 transition-all duration-200 ${
        props.class || ''
      }`}
    >
      {/* Header */}
      <div class="flex items-center justify-between gap-2 mb-2">
        <div class="flex items-center gap-2">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <TrendingUp class="h-3.5 w-3.5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-white tracking-wide">Motion & Bezier Curves</span>
            </div>
            <p class="text-[10px] text-slate-400">Temporal interpolation & easing</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Badge variant="outline" class="text-[10px] py-0 px-2 h-5 font-mono text-purple-300 border-purple-500/30">
            f(t) = {currentValue().toFixed(3)}
          </Badge>
        </div>
      </div>

      {/* Curve Selector Pills */}
      <div class="flex flex-wrap gap-1 mb-2">
        <For each={Object.keys(EASING_FUNCTIONS) as EasingType[]}>
          {(curveKey) => {
            const isSelected = () => selectedCurve() === curveKey;
            return (
              <button
                type="button"
                onClick={() => setSelectedCurve(curveKey)}
                class={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors border ${
                  isSelected()
                    ? 'bg-purple-600/40 text-purple-200 border-purple-500/50 shadow-sm'
                    : 'bg-white/5 text-slate-400 border-white/5 hover:text-white hover:bg-white/10'
                }`}
              >
                {EASING_FUNCTIONS[curveKey].name}
              </button>
            );
          }}
        </For>
      </div>

      {/* Canvas Graph Viewport */}
      <div class="relative w-full flex-1 min-h-[140px] rounded-xl bg-slate-950/80 border border-white/5 overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} width={400} height={200} class="w-full h-full object-contain" />

        {/* Legend info in bottom right */}
        <div class="absolute bottom-1.5 right-2 text-[9px] font-mono text-slate-500 pointer-events-none">
          t: {((state.currentFrame / Math.max(1, state.totalFrames - 1)) * 100).toFixed(0)}%
        </div>
      </div>

      {/* Curve description */}
      <div class="mt-2 text-[10px] text-slate-400 italic flex items-center justify-between">
        <span>{currentCurveInfo().desc}</span>
        <span class="text-slate-500 font-mono text-[9px]">Normalized [0..1] domain</span>
      </div>
    </div>
  );
}

// ============================================================================
// KINETIX STUDIO v5.0 - INTERACTIVE MULTI-TRACK KEYFRAME GRAPH EDITOR
// Visual dual-handle cubic-bezier spline curve authoring with tangent manipulation,
// velocity dy/dx overlay, angle-locking modes, and per-segment easing presets.
// ============================================================================

import { createSignal, createMemo, For, Show, onMount, onCleanup, type Component } from 'solid-js';
import { useStudio } from '@/context/studio-context';
import type { BezierKnot, CustomKeyframeTracks, TangentMode } from '@/types/motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  computeKnotTangentPoints,
  clampKnotTangents,
  alignTangents,
  applyEasingPresetToKnotPair,
  type BezierPresetName,
} from '@/core/domain/motion';
import { evaluateBezierTrack } from '@/engine/choreography';
import { Sliders, RotateCcw, Activity, Trash2, Zap, Gauge } from 'lucide-solid';

type ActiveTrackKey = keyof CustomKeyframeTracks;

const TRACK_META: Record<ActiveTrackKey, { label: string; color: string; desc: string }> = {
  energyTrack: { label: 'Kinetic Energy', color: '#ccff00', desc: 'Controls typography wave height & tracking velocity' },
  heroZoomTrack: { label: 'Hero 2.5D Scale', color: '#00f0ff', desc: 'Controls focal subject breakout pop & perspective zoom' },
  turbulenceTrack: { label: 'Shader Turbulence', color: '#a855f7', desc: 'Controls fluid speed, caustic ripples & noise' },
  lightingTrack: { label: 'Lighting Strobe', color: '#f59e0b', desc: 'Controls specular flares, secondary reveal & glare' },
};

export const KeyframeTrackEditor: Component = () => {
  const studio = useStudio();
  const [activeTrack, setActiveTrack] = createSignal<ActiveTrackKey>('energyTrack');
  const [selectedKnotIdx, setSelectedKnotIdx] = createSignal<number | null>(0);
  const [showVelocityGraph, setShowVelocityGraph] = createSignal(true);

  // Dragging state
  const [draggingTarget, setDraggingTarget] = createSignal<{
    type: 'knot' | 'cpIn' | 'cpOut';
    knotIdx: number;
  } | null>(null);

  let svgRef: SVGSVGElement | undefined;

  const choreoMode = () => studio.state.choreoMode ?? 'procedural-3phase';
  const customTracks = () => studio.state.customKeyframes;

  const currentKnots = createMemo((): BezierKnot[] => {
    const tracks = customTracks();
    if (!tracks) return [];
    return tracks[activeTrack()] || [];
  });

  const svgWidth = 560;
  const svgHeight = 150;
  const padX = 24;
  const padY = 20;
  const plotW = svgWidth - padX * 2;
  const plotH = svgHeight - padY * 2;

  // Converts normalized (t, val) to SVG coordinates
  const toSvgX = (t: number) => padX + Math.max(0, Math.min(1, t)) * plotW;
  const toSvgY = (v: number) => padY + (1 - Math.max(0, Math.min(1.5, v))) * plotH;

  // Converts SVG pixel coordinates back to normalized (t, val)
  const fromSvgX = (x: number) => Math.min(1, Math.max(0, (x - padX) / plotW));
  const fromSvgY = (y: number) => Math.max(0, Math.min(1.5, 1 - (y - padY) / plotH));

  // Generates SVG path string for the cubic-bezier spline
  const pathD = createMemo(() => {
    const knots = currentKnots();
    if (knots.length < 2) return '';
    const sorted = [...knots].sort((a, b) => a.t - b.t);

    let d = `M ${toSvgX(sorted[0]!.t)} ${toSvgY(sorted[0]!.val)}`;
    for (let i = 0; i < sorted.length - 1; i++) {
      const k0 = sorted[i]!;
      const k1 = sorted[i + 1]!;
      const dt = k1.t - k0.t;

      const cp1X = toSvgX(k0.t + (k0.cpOut ? k0.cpOut[0] : dt * (1 / 3)));
      const cp1Y = toSvgY(k0.cpOut ? k0.val + k0.cpOut[1] : k0.val);
      const cp2X = toSvgX(k1.t + (k1.cpIn ? k1.cpIn[0] : -dt * (1 / 3)));
      const cp2Y = toSvgY(k1.cpIn ? k1.val + k1.cpIn[1] : k1.val);
      const endX = toSvgX(k1.t);
      const endY = toSvgY(k1.val);

      d += ` C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
    }
    return d;
  });

  // Generates velocity graph overlay path (|dy/dx| curve)
  const velocityPathD = createMemo(() => {
    if (!showVelocityGraph()) return '';
    const knots = currentKnots();
    if (knots.length < 2) return '';

    const steps = 48;
    const baseLineY = svgHeight - padY;
    let d = '';

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const eps = 0.005;
      const v0 = evaluateBezierTrack(knots, Math.max(0, t - eps));
      const v1 = evaluateBezierTrack(knots, Math.min(1, t + eps));
      const velocity = Math.abs(v1 - v0) / (2 * eps);

      // Map velocity [0, 4] to plot height [0, plotH * 0.4]
      const velHeight = Math.min(plotH * 0.45, velocity * 12);
      const px = toSvgX(t);
      const py = baseLineY - velHeight;

      if (i === 0) {
        d += `M ${px} ${py}`;
      } else {
        d += ` L ${px} ${py}`;
      }
    }
    return d;
  });

  // Selected knot tangents memo
  const selectedTangentPoints = createMemo(() => {
    const idx = selectedKnotIdx();
    if (idx === null) return null;
    const knots = currentKnots();
    const knot = knots[idx];
    if (!knot) return null;

    return computeKnotTangentPoints(knot, toSvgX, toSvgY);
  });

  const commitKnots = (newKnots: BezierKnot[]) => {
    studio.patchState({
      choreoMode: 'custom-keyframe',
      customKeyframes: {
        ...(customTracks() || {
          energyTrack: [],
          heroZoomTrack: [],
          turbulenceTrack: [],
          lightingTrack: [],
        }),
        [activeTrack()]: newKnots,
      },
    });
  };

  const handleSvgPointerDown = (e: PointerEvent) => {
    // If clicked on empty space, insert a new knot
    const rect = svgRef?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const t = Number(fromSvgX(clickX).toFixed(3));
    const val = Number(fromSvgY(clickY).toFixed(3));

    const existing = [...currentKnots()];
    const newKnot: BezierKnot = {
      t,
      val: Math.min(1, val),
      cpIn: [-0.08, 0],
      cpOut: [0.08, 0],
      tangentMode: 'smooth',
    };
    existing.push(newKnot);
    existing.sort((a, b) => a.t - b.t);

    const insertedIdx = existing.findIndex((k) => k.t === t);
    setSelectedKnotIdx(insertedIdx >= 0 ? insertedIdx : null);
    commitKnots(existing);
  };

  const handlePointerMove = (e: PointerEvent) => {
    const target = draggingTarget();
    if (!target || !svgRef) return;

    const rect = svgRef.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const normT = fromSvgX(mouseX);
    const normVal = fromSvgY(mouseY);

    const knots = [...currentKnots()];
    const knot = knots[target.knotIdx];
    if (!knot) return;

    if (target.type === 'knot') {
      // Reposition knot
      const prevT = target.knotIdx > 0 ? knots[target.knotIdx - 1]!.t + 0.01 : 0;
      const nextT = target.knotIdx < knots.length - 1 ? knots[target.knotIdx + 1]!.t - 0.01 : 1;
      knot.t = Number(Math.max(prevT, Math.min(nextT, normT)).toFixed(3));
      knot.val = Number(Math.max(0, Math.min(1.2, normVal)).toFixed(3));
    } else if (target.type === 'cpIn') {
      // Modify in-tangent
      const dt = normT - knot.t;
      const dval = normVal - knot.val;
      knot.cpIn = [dt, dval];
      clampKnotTangents(knot, 0.5, 0.5);
      alignTangents(knot, 'cpIn', knot.tangentMode ?? 'smooth');
    } else if (target.type === 'cpOut') {
      // Modify out-tangent
      const dt = normT - knot.t;
      const dval = normVal - knot.val;
      knot.cpOut = [dt, dval];
      clampKnotTangents(knot, 0.5, 0.5);
      alignTangents(knot, 'cpOut', knot.tangentMode ?? 'smooth');
    }

    commitKnots(knots);
  };

  const handlePointerUp = () => {
    setDraggingTarget(null);
  };

  const handleApplyPreset = (presetName: BezierPresetName) => {
    const knots = [...currentKnots()];
    if (knots.length < 2) return;

    let k0Idx = selectedKnotIdx() ?? 0;
    if (k0Idx >= knots.length - 1) {
      k0Idx = knots.length - 2;
    }
    const k1Idx = k0Idx + 1;

    applyEasingPresetToKnotPair(knots[k0Idx]!, knots[k1Idx]!, presetName);
    commitKnots(knots);
    studio.triggerToast(`Applied ${presetName} to segment [${k0Idx} -> ${k1Idx}]`);
  };

  const handleChangeTangentMode = (mode: TangentMode) => {
    const idx = selectedKnotIdx();
    if (idx === null) return;
    const knots = [...currentKnots()];
    const knot = knots[idx];
    if (!knot) return;

    alignTangents(knot, 'cpOut', mode);
    commitKnots(knots);
    studio.triggerToast(`Tangent Mode: ${mode.toUpperCase()}`);
  };

  const handleDeleteSelectedKnot = () => {
    const idx = selectedKnotIdx();
    if (idx === null) return;
    const knots = [...currentKnots()];
    if (knots.length <= 2) {
      studio.triggerToast('Minimum 2 keyframe knots required');
      return;
    }

    knots.splice(idx, 1);
    setSelectedKnotIdx(Math.max(0, idx - 1));
    commitKnots(knots);
    studio.triggerToast('Deleted keyframe knot');
  };

  const handleResetTrack = () => {
    const defaults: Record<ActiveTrackKey, BezierKnot[]> = {
      energyTrack: [
        { t: 0, val: 0.2, cpOut: [0.1, 0.1], tangentMode: 'smooth' },
        { t: 0.35, val: 0.6, cpIn: [-0.08, -0.1], cpOut: [0.08, 0.1], tangentMode: 'smooth' },
        { t: 0.7, val: 1.0, cpIn: [-0.1, 0], cpOut: [0.08, -0.2], tangentMode: 'smooth' },
        { t: 1.0, val: 0.2, cpIn: [-0.1, 0.1], tangentMode: 'smooth' },
      ],
      heroZoomTrack: [
        { t: 0, val: 0.85, cpOut: [0.15, 0.05], tangentMode: 'smooth' },
        { t: 0.5, val: 1.1, cpIn: [-0.12, 0], cpOut: [0.12, 0], tangentMode: 'smooth' },
        { t: 1.0, val: 0.85, cpIn: [-0.15, -0.05], tangentMode: 'smooth' },
      ],
      turbulenceTrack: [
        { t: 0, val: 0.4, cpOut: [0.15, 0.1], tangentMode: 'smooth' },
        { t: 0.6, val: 0.9, cpIn: [-0.12, 0], cpOut: [0.1, -0.1], tangentMode: 'smooth' },
        { t: 1.0, val: 0.4, cpIn: [-0.12, 0], tangentMode: 'smooth' },
      ],
      lightingTrack: [
        { t: 0, val: 0.2, cpOut: [0.15, 0.2], tangentMode: 'smooth' },
        { t: 0.7, val: 0.95, cpIn: [-0.1, 0.1], cpOut: [0.08, -0.2], tangentMode: 'smooth' },
        { t: 1.0, val: 0.2, cpIn: [-0.1, 0], tangentMode: 'smooth' },
      ],
    };

    studio.patchState({
      customKeyframes: {
        ...(customTracks() || defaults),
        [activeTrack()]: defaults[activeTrack()],
      },
    });
    setSelectedKnotIdx(0);
    studio.triggerToast(`Reset ${TRACK_META[activeTrack()].label} Track`);
  };

  // Keyboard shortcut listener for Delete/Backspace
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
      if (selectedKnotIdx() !== null) {
        handleDeleteSelectedKnot();
      }
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  });

  return (
    <div class="p-3 bg-card/85 backdrop-blur-md border border-border rounded-lg space-y-2.5 text-xs text-foreground font-sans">
      {/* HEADER CONTROLS */}
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Activity class="w-3.5 h-3.5 text-primary" />
          <span class="font-mono text-xs font-bold uppercase tracking-wider">
            Dual-Handle Bézier Graph Deck
          </span>
          <Badge variant={choreoMode() === 'custom-keyframe' ? 'lime' : 'secondary'}>
            {choreoMode() === 'custom-keyframe' ? 'ACTIVE: CUSTOM BEZIER' : 'PROCEDURAL 3-PHASE'}
          </Badge>
        </div>

        <div class="flex items-center gap-1.5">
          <Button
            size="xs"
            variant={showVelocityGraph() ? 'primary' : 'ghost'}
            onClick={() => setShowVelocityGraph(!showVelocityGraph())}
            title="Toggle Velocity Curve Overlay (dy/dx)"
          >
            <Gauge class="w-3 h-3 mr-1" />
            Velocity
          </Button>

          <Button
            size="xs"
            variant={choreoMode() === 'custom-keyframe' ? 'primary' : 'outline'}
            onClick={() => {
              const next = choreoMode() === 'custom-keyframe' ? 'procedural-3phase' : 'custom-keyframe';
              studio.patchState({ choreoMode: next });
              studio.triggerToast(`Choreography: ${next.toUpperCase()}`);
            }}
          >
            <Sliders class="w-3 h-3 mr-1" />
            {choreoMode() === 'custom-keyframe' ? 'Disable Keyframing' : 'Enable Keyframing'}
          </Button>

          <Button size="xs" variant="ghost" onClick={handleResetTrack} title="Reset Track Curve">
            <RotateCcw class="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* TRACK TAB PILLS */}
      <div class="flex items-center gap-1 bg-background/50 p-1 rounded border border-border/50">
        <For each={Object.keys(TRACK_META) as ActiveTrackKey[]}>
          {(tKey) => {
            const meta = TRACK_META[tKey];
            const isActive = () => activeTrack() === tKey;
            return (
              <button
                type="button"
                onClick={() => {
                  setActiveTrack(tKey);
                  setSelectedKnotIdx(0);
                }}
                class={`flex-1 py-1 px-2 rounded font-mono text-xs text-center transition-all ${
                  isActive()
                    ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                {meta.label}
              </button>
            );
          }}
        </For>
      </div>

      {/* TOOLBAR: EASING PRESETS & TANGENT MODES */}
      <div class="flex flex-wrap items-center justify-between gap-1.5 bg-muted/20 px-2 py-1.5 rounded border border-border/40 text-[11px] font-mono">
        {/* Presets */}
        <div class="flex items-center gap-1">
          <span class="text-muted-foreground mr-1 flex items-center gap-1">
            <Zap class="w-3 h-3 text-amber-400" /> Presets:
          </span>
          <button
            type="button"
            onClick={() => handleApplyPreset('ease')}
            class="px-1.5 py-0.5 rounded bg-muted/60 hover:bg-primary/20 hover:text-primary transition-colors"
          >
            Ease
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('snappyBounce')}
            class="px-1.5 py-0.5 rounded bg-muted/60 hover:bg-primary/20 hover:text-primary transition-colors"
          >
            Snappy
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('gentleSpring')}
            class="px-1.5 py-0.5 rounded bg-muted/60 hover:bg-primary/20 hover:text-primary transition-colors"
          >
            Spring
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('dramaticClimax')}
            class="px-1.5 py-0.5 rounded bg-muted/60 hover:bg-primary/20 hover:text-primary transition-colors"
          >
            Climax
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('linear')}
            class="px-1.5 py-0.5 rounded bg-muted/60 hover:bg-primary/20 hover:text-primary transition-colors"
          >
            Linear
          </button>
        </div>

        {/* Tangent Mode for Selected Knot */}
        <Show when={selectedKnotIdx() !== null}>
          <div class="flex items-center gap-1">
            <span class="text-muted-foreground mr-1">Tangent:</span>
            <button
              type="button"
              onClick={() => handleChangeTangentMode('smooth')}
              class={`px-1.5 py-0.5 rounded transition-colors ${
                currentKnots()[selectedKnotIdx()!]?.tangentMode === 'smooth' || !currentKnots()[selectedKnotIdx()!]?.tangentMode
                  ? 'bg-primary text-primary-foreground font-bold'
                  : 'bg-muted/60 hover:bg-muted'
              }`}
            >
              Smooth
            </button>
            <button
              type="button"
              onClick={() => handleChangeTangentMode('broken')}
              class={`px-1.5 py-0.5 rounded transition-colors ${
                currentKnots()[selectedKnotIdx()!]?.tangentMode === 'broken'
                  ? 'bg-primary text-primary-foreground font-bold'
                  : 'bg-muted/60 hover:bg-muted'
              }`}
            >
              Broken
            </button>
            <button
              type="button"
              onClick={() => handleChangeTangentMode('flat')}
              class={`px-1.5 py-0.5 rounded transition-colors ${
                currentKnots()[selectedKnotIdx()!]?.tangentMode === 'flat'
                  ? 'bg-primary text-primary-foreground font-bold'
                  : 'bg-muted/60 hover:bg-muted'
              }`}
            >
              Flat
            </button>
            <button
              type="button"
              onClick={handleDeleteSelectedKnot}
              title="Delete Selected Knot (Del)"
              class="p-1 rounded text-red-400 hover:bg-red-500/20 transition-colors ml-1"
            >
              <Trash2 class="w-3 h-3" />
            </button>
          </div>
        </Show>
      </div>

      {/* INTERACTIVE SVG BEZIER SPLINE CANVAS */}
      <div class="relative bg-background/80 rounded border border-border/60 overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          class="w-full h-[150px] cursor-crosshair block select-none"
          onPointerDown={handleSvgPointerDown}
        >
          {/* Subtle Grid Lines (4x4 beat divisions) */}
          <For each={[0.25, 0.5, 0.75]}>
            {(frac) => (
              <>
                <line
                  x1={toSvgX(frac)}
                  y1={padY}
                  x2={toSvgX(frac)}
                  y2={svgHeight - padY}
                  stroke="currentColor"
                  stroke-opacity="0.08"
                  stroke-dasharray="2 4"
                />
                <line
                  x1={padX}
                  y1={toSvgY(frac)}
                  x2={svgWidth - padX}
                  y2={toSvgY(frac)}
                  stroke="currentColor"
                  stroke-opacity="0.08"
                  stroke-dasharray="2 4"
                />
              </>
            )}
          </For>

          {/* Current playhead progress line */}
          <line
            x1={toSvgX(studio.rawProgress)}
            y1={padY}
            x2={toSvgX(studio.rawProgress)}
            y2={svgHeight - padY}
            stroke="#ffffff"
            stroke-width="1.5"
            stroke-opacity="0.75"
          />

          {/* Velocity Graph Overlay (dy/dx) */}
          <Show when={showVelocityGraph()}>
            <path
              d={velocityPathD()}
              fill="none"
              stroke="#6366f1"
              stroke-width="1.5"
              stroke-dasharray="3 3"
              stroke-opacity="0.75"
            />
          </Show>

          {/* Bezier Spline Curve Area */}
          <path
            d={`${pathD()} L ${toSvgX(1)} ${toSvgY(0)} L ${toSvgX(0)} ${toSvgY(0)} Z`}
            fill={TRACK_META[activeTrack()].color}
            fill-opacity="0.12"
          />

          {/* Bezier Spline Stroke */}
          <path
            d={pathD()}
            fill="none"
            stroke={TRACK_META[activeTrack()].color}
            stroke-width="2.5"
            stroke-linecap="round"
          />

          {/* Tangent Arms & Handles for Selected Knot */}
          <Show when={selectedTangentPoints()}>
            {(pts) => (
              <g class="pointer-events-auto">
                {/* In-Tangent Arm */}
                <line
                  x1={pts().knotX}
                  y1={pts().knotY}
                  x2={pts().inX}
                  y2={pts().inY}
                  stroke="#00f0ff"
                  stroke-width="1.5"
                  stroke-opacity="0.85"
                />
                <circle
                  cx={pts().inX}
                  cy={pts().inY}
                  r="5"
                  fill="#00f0ff"
                  stroke="#08090c"
                  stroke-width="1.5"
                  class="cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const idx = selectedKnotIdx();
                    if (idx !== null) setDraggingTarget({ type: 'cpIn', knotIdx: idx });
                  }}
                />

                {/* Out-Tangent Arm */}
                <line
                  x1={pts().knotX}
                  y1={pts().knotY}
                  x2={pts().outX}
                  y2={pts().outY}
                  stroke="#ff0077"
                  stroke-width="1.5"
                  stroke-opacity="0.85"
                />
                <circle
                  cx={pts().outX}
                  cy={pts().outY}
                  r="5"
                  fill="#ff0077"
                  stroke="#08090c"
                  stroke-width="1.5"
                  class="cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const idx = selectedKnotIdx();
                    if (idx !== null) setDraggingTarget({ type: 'cpOut', knotIdx: idx });
                  }}
                />
              </g>
            )}
          </Show>

          {/* Draggable Knots */}
          <For each={currentKnots()}>
            {(k, idx) => (
              <circle
                cx={toSvgX(k.t)}
                cy={toSvgY(k.val)}
                r={selectedKnotIdx() === idx() ? '6' : '4.5'}
                fill={TRACK_META[activeTrack()].color}
                stroke={selectedKnotIdx() === idx() ? '#ffffff' : '#08090c'}
                stroke-width={selectedKnotIdx() === idx() ? '2' : '1.5'}
                class="hover:scale-125 transition-transform cursor-pointer"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSelectedKnotIdx(idx());
                  setDraggingTarget({ type: 'knot', knotIdx: idx() });
                }}
              />
            )}
          </For>
        </svg>
      </div>

      <div class="flex items-center justify-between text-[11px] font-mono text-muted-foreground px-1">
        <span>Click on canvas to add knot. Drag handles to shape curve.</span>
        <Show when={showVelocityGraph()}>
          <span class="flex items-center gap-1 text-indigo-400">
            <span class="inline-block w-2.5 h-0.5 bg-indigo-400 border-dashed" /> Velocity (dy/dx)
          </span>
        </Show>
      </div>
    </div>
  );
};

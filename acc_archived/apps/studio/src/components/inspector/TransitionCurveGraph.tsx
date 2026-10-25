import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GSAP_EASING_PRESETS, type EasingPreset } from '../EasingCurveSelector';

import { parseCubicBezier } from '@acc/ir';

// --- Types ---

/** A 2D point normalized to [0,1] range */
export interface BezierPoint {
  x: number;
  y: number;
}

/** Full cubic bezier descriptor with two control points */
export interface CubicBezier {
  p1: BezierPoint; // control point 1
  p2: BezierPoint; // control point 2
}

/** Map from GSAP easing ID to its cubic bezier approximation */
const EASING_TO_BEZIER: Record<string, CubicBezier> = {
  'power2.out':   { p1: { x: 0.25, y: 0.46 }, p2: { x: 0.45, y: 0.94 } },
  'power2.inOut': { p1: { x: 0.45, y: 0.05 }, p2: { x: 0.55, y: 0.95 } },
  'back.out':     { p1: { x: 0.34, y: 1.56 }, p2: { x: 0.64, y: 1.0  } },
  'elastic.out':  { p1: { x: 0.22, y: 1.0  }, p2: { x: 0.36, y: 1.0  } },
  'bounce.out':   { p1: { x: 0.21, y: 1.28 }, p2: { x: 0.47, y: 0.98 } },
  'expo.out':     { p1: { x: 0.19, y: 1.0  }, p2: { x: 0.22, y: 1.0  } },
  'linear':       { p1: { x: 0.0,  y: 0.0  }, p2: { x: 1.0,  y: 1.0  } },
  'power1.in':    { p1: { x: 0.55, y: 0.0  }, p2: { x: 1.0,  y: 0.45 } },
  'circ.out':     { p1: { x: 0.0,  y: 0.55 }, p2: { x: 0.45, y: 1.0  } },
};

function getDefaultBezier(easingId: string): CubicBezier {
  if (easingId && easingId.startsWith('cubic-bezier(')) {
    const parsed = parseCubicBezier(easingId);
    if (parsed) {
      return {
        p1: { x: parsed[0], y: parsed[1] },
        p2: { x: parsed[2], y: parsed[3] },
      };
    }
  }
  return EASING_TO_BEZIER[easingId] ?? { p1: { x: 0.25, y: 0.1 }, p2: { x: 0.25, y: 1.0 } };
}

/** Evaluate a cubic bezier at parameter t ∈ [0,1] */
function cubicBezierY(t: number, p1y: number, p2y: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * t * p1y + 3 * mt * t * t * p2y + t * t * t;
}

/** Build an SVG path from the cubic bezier control points */
function buildBezierPath(p1: BezierPoint, p2: BezierPoint, width: number, height: number, padding: number): string {
  const w = width - 2 * padding;
  const h = height - 2 * padding;
  const toX = (x: number) => padding + x * w;
  const toY = (y: number) => padding + (1 - y) * h;
  const pts: string[] = [];
  const steps = 80;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bx = cubicBezierY(t, p1.x, p2.x);
    const by = cubicBezierY(t, p1.y, p2.y);
    pts.push(`${i === 0 ? 'M' : 'L'} ${toX(bx).toFixed(2)} ${toY(by).toFixed(2)}`);
  }
  return pts.join(' ');
}

// --- Props ---

export interface TransitionCurveGraphProps {
  /** Currently selected GSAP easing preset ID */
  easingId?: string;
  /** Height in pixels (default: 160) */
  height?: number;
  /** Called when user drags control points to a custom curve */
  onCurveChange?: (p1: BezierPoint, p2: BezierPoint) => void;
  /** Show playhead scrubbing animation */
  showScrubber?: boolean;
}

const PADDING = 28;
const HANDLE_RADIUS = 6;
const BASE_WIDTH = 280;

/**
 * TransitionCurveGraph — Interactive cubic Bézier curve visualizer.
 *
 * Renders the selected easing as a full-size, interactive SVG graph with:
 * - Two draggable control points (P1 and P2)
 * - Grid guide lines and axis labels
 * - Animated scrubber ball showing timing at playback
 * - Preset display synced with EasingCurveSelector.tsx
 */
export const TransitionCurveGraph: React.FC<TransitionCurveGraphProps> = ({
  easingId = 'power2.out',
  height = 160,
  onCurveChange,
  showScrubber = true,
}) => {
  const [bezier, setBezier] = useState<CubicBezier>(() => getDefaultBezier(easingId));
  const [dragging, setDragging] = useState<'p1' | 'p2' | null>(null);
  const [scrubT, setScrubT] = useState(0);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const ANIM_DURATION = 1400; // ms

  // Sync bezier when easingId changes externally
  useEffect(() => {
    setBezier(getDefaultBezier(easingId));
  }, [easingId]);

  // Animate scrubber ball
  useEffect(() => {
    if (!showScrubber) return;
    const animate = (ts: number) => {
      if (startTimeRef.current === null) startTimeRef.current = ts;
      const elapsed = (ts - startTimeRef.current) % ANIM_DURATION;
      setScrubT(elapsed / ANIM_DURATION);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
      startTimeRef.current = null;
    };
  }, [showScrubber, easingId]);

  const toSvgCoords = useCallback((norm: BezierPoint) => ({
    x: PADDING + norm.x * (BASE_WIDTH - 2 * PADDING),
    y: PADDING + (1 - norm.y) * (height - 2 * PADDING),
  }), [height]);

  const fromSvgCoords = useCallback((svgX: number, svgY: number): BezierPoint => ({
    x: Math.max(0, Math.min(1, (svgX - PADDING) / (BASE_WIDTH - 2 * PADDING))),
    y: (1 - (svgY - PADDING) / (height - 2 * PADDING)),
  }), [height]);

  const getSvgPoint = useCallback((e: React.PointerEvent<SVGSVGElement>): BezierPoint | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scaleX = BASE_WIDTH / rect.width;
    const scaleY = height / rect.height;
    return fromSvgCoords((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
  }, [fromSvgCoords, height]);

  const handlePointerDown = (point: 'p1' | 'p2') => (e: React.PointerEvent<SVGCircleElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as SVGCircleElement).setPointerCapture(e.pointerId);
    setDragging(point);
  };

  const handleSvgPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const pt = getSvgPoint(e);
    if (!pt) return;
    const next = { ...bezier, [dragging]: pt };
    setBezier(next);
    onCurveChange?.(next.p1, next.p2);
  }, [dragging, bezier, getSvgPoint, onCurveChange]);

  const handleSvgPointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  // Build curve path
  const curvePath = buildBezierPath(bezier.p1, bezier.p2, BASE_WIDTH, height, PADDING);

  // Handle positions
  const p1svg = toSvgCoords(bezier.p1);
  const p2svg = toSvgCoords(bezier.p2);

  // Scrubber position along curve
  const scrubBx = cubicBezierY(scrubT, bezier.p1.x, bezier.p2.x);
  const scrubBy = cubicBezierY(scrubT, bezier.p1.y, bezier.p2.y);
  const scrubPos = toSvgCoords({ x: scrubBx, y: scrubBy });

  // Grid lines
  const gridLines = [0.25, 0.5, 0.75];

  const preset = GSAP_EASING_PRESETS.find(p => p.id === easingId);

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Header */}
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-muted-foreground uppercase tracking-wider">Bezier Curve</span>
        <span className="text-accent-theme font-semibold">{preset?.name ?? easingId}</span>
      </div>

      {/* SVG Graph Container */}
      <div
        className="relative w-full rounded-xl border border-glass-border bg-background/70 overflow-hidden"
        style={{ height }}
      >
        {/* Subtle dot grid background */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--accent-primary) 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        />

        <svg
          ref={svgRef}
          viewBox={`0 0 ${BASE_WIDTH} ${height}`}
          className="w-full h-full touch-none block"
          preserveAspectRatio="none"
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
          onPointerLeave={handleSvgPointerUp}
          style={{ cursor: dragging ? 'grabbing' : 'default' }}
        >
          {/* Grid lines */}
          {gridLines.map(v => {
            const xPos = PADDING + v * (BASE_WIDTH - 2 * PADDING);
            const yPos = PADDING + v * (height - 2 * PADDING);
            return (
              <g key={v}>
                <line x1={xPos} y1={PADDING} x2={xPos} y2={height - PADDING}
                  stroke="currentColor" strokeWidth="0.5" strokeDasharray="3,3"
                  className="text-muted-foreground/20" />
                <line x1={PADDING} y1={yPos} x2={BASE_WIDTH - PADDING} y2={yPos}
                  stroke="currentColor" strokeWidth="0.5" strokeDasharray="3,3"
                  className="text-muted-foreground/20" />
              </g>
            );
          })}

          {/* Axes */}
          <line x1={PADDING} y1={PADDING} x2={PADDING} y2={height - PADDING}
            stroke="currentColor" strokeWidth="1" className="text-muted-foreground/40" />
          <line x1={PADDING} y1={height - PADDING} x2={BASE_WIDTH - PADDING} y2={height - PADDING}
            stroke="currentColor" strokeWidth="1" className="text-muted-foreground/40" />

          {/* Diagonal reference line */}
          <line x1={PADDING} y1={height - PADDING} x2={BASE_WIDTH - PADDING} y2={PADDING}
            stroke="currentColor" strokeWidth="1" strokeDasharray="4,4"
            className="text-muted-foreground/25" />

          {/* Handle stems */}
          <line
            x1={PADDING} y1={height - PADDING}
            x2={p1svg.x} y2={p1svg.y}
            stroke="var(--accent-primary)" strokeWidth="1" opacity="0.5"
          />
          <line
            x1={BASE_WIDTH - PADDING} y1={PADDING}
            x2={p2svg.x} y2={p2svg.y}
            stroke="var(--accent-primary)" strokeWidth="1" opacity="0.5"
          />

          {/* Bezier curve */}
          <path
            d={curvePath}
            fill="none"
            stroke="var(--accent-primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 0 5px var(--accent-glow))' }}
          />

          {/* Area fill under curve */}
          <path
            d={`${curvePath} L ${BASE_WIDTH - PADDING} ${height - PADDING} L ${PADDING} ${height - PADDING} Z`}
            fill="var(--accent-primary)"
            opacity="0.06"
          />

          {/* Start & end fixed points */}
          <circle cx={PADDING} cy={height - PADDING} r="4" fill="var(--accent-primary)" opacity="0.7" />
          <circle cx={BASE_WIDTH - PADDING} cy={PADDING} r="4" fill="var(--accent-primary)" opacity="0.7" />

          {/* Control point P1 (draggable) */}
          <circle
            cx={p1svg.x} cy={p1svg.y} r={HANDLE_RADIUS}
            fill="var(--accent-primary)" stroke="white" strokeWidth="1.5"
            style={{ cursor: 'grab', filter: 'drop-shadow(0 0 3px var(--accent-glow))' }}
            onPointerDown={handlePointerDown('p1')}
          />
          <text x={p1svg.x + 8} y={p1svg.y - 4} fontSize="8" fill="var(--accent-primary)" opacity="0.8" fontFamily="monospace">
            P1
          </text>

          {/* Control point P2 (draggable) */}
          <circle
            cx={p2svg.x} cy={p2svg.y} r={HANDLE_RADIUS}
            fill="var(--accent-primary)" stroke="white" strokeWidth="1.5"
            style={{ cursor: 'grab', filter: 'drop-shadow(0 0 3px var(--accent-glow))' }}
            onPointerDown={handlePointerDown('p2')}
          />
          <text x={p2svg.x + 8} y={p2svg.y - 4} fontSize="8" fill="var(--accent-primary)" opacity="0.8" fontFamily="monospace">
            P2
          </text>

          {/* Animated scrubber ball */}
          {showScrubber && (
            <circle
              cx={scrubPos.x} cy={scrubPos.y} r="5"
              fill="white"
              style={{ filter: 'drop-shadow(0 0 4px var(--accent-glow))' }}
            />
          )}
        </svg>
      </div>

      {/* Bezier values readout */}
      <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground px-1">
        <span>
          P1: ({bezier.p1.x.toFixed(2)}, {bezier.p1.y.toFixed(2)})
        </span>
        <span>
          P2: ({bezier.p2.x.toFixed(2)}, {bezier.p2.y.toFixed(2)})
        </span>
      </div>

      {/* Hint */}
      <p className="text-[9px] text-muted-foreground/60 text-center leading-tight">
        Drag P1 &amp; P2 to customize • Values sync with GSAP preset
      </p>
    </div>
  );
};

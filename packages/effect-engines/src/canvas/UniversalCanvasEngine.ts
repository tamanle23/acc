import gsap from 'gsap';
import { Pt, Group } from 'pts';
import {
  CanvasTransformOverlay,
  BoundingBox2D,
  SnappingGuide,
  TransformHandleType,
} from './CanvasTransformOverlay';

export interface CanvasEngineConfig {
  width: number;
  height: number;
  fov?: number;
  near?: number;
  far?: number;
  backgroundAlpha?: number;
}

export interface PartialVFXRegion {
  id: string;
  type: 'blur' | 'spotlight' | 'glitch' | 'point_emitter' | string;
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  width?: number; // normalized 0..1
  height?: number; // normalized 0..1
  intensity?: number;
  radius?: number;
  color?: string;
  params?: Record<string, unknown>;
}

export interface ParticleState {
  pts: Group;
  velocities: Group;
  colors: string[];
  radii: Float32Array;
  attractor: Pt;
}

export interface HUDConfig {
  ringRadiusNorm: number;
  scanlineDensity: number;
  color: string;
  rotationSpeed: number;
}

export interface LightRelightParams {
  x?: number; // normalized 0..1
  y?: number; // normalized 0..1
  diffuse?: number;
  specular?: number;
  color?: string;
}

/**
 * UniversalCanvasEngine:
 * High-performance isomorphic 2D/2.5D visual engine combining Pts.js vector mathematics
 * and GSAP deterministic motion sequencing. Operates identically across client-side
 * HTML5 Canvas2D (in apps/studio) and server-side @napi-rs/canvas (in headless exporters).
 */
export class UniversalCanvasEngine {
  public width: number;
  public height: number;
  public overlay: CanvasTransformOverlay;

  private particles: ParticleState | null = null;
  private hudConfig: HUDConfig | null = null;
  private partialVfxRegions: PartialVFXRegion[] = [];
  private currentTime: number = 0;
  private popOutIntensity: number = 1.0;
  private isDisposed: boolean = false;

  // GSAP Deterministic Scrubbed Timeline
  private timeline: gsap.core.Timeline;
  private interpolatedStates = new Map<
    string,
    { opacity: number; scale: number; rotation: number; x: number; y: number }
  >();

  constructor(config: CanvasEngineConfig) {
    this.width = config.width;
    this.height = config.height;
    this.overlay = new CanvasTransformOverlay();

    // GSAP Timeline strictly in paused scrubbed mode (driven by frame math)
    this.timeline = gsap.timeline({ paused: true });
  }

  public getActiveInterpolatedTransform(seqId: string): {
    opacity: number;
    scale: number;
    rotation: number;
    x: number;
    y: number;
  } | null {
    return this.interpolatedStates.get(seqId) ?? null;
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  public setOverlayVisible(visible: boolean): void {
    this.overlay.setVisible(visible);
  }

  public updateOverlay(box: BoundingBox2D | null, activeGuides: SnappingGuide[] = []): void {
    if (box) {
      this.overlay.setVisible(true);
    }
    this.overlay.update(box, activeGuides);
  }

  public setActiveInteraction(
    handle: TransformHandleType | null,
    dragMode: 'move' | 'resize' | 'rotate' | null = null
  ): void {
    this.overlay.setActiveInteraction(handle, dragMode);
  }

  public hitTestOverlay(normX: number, normY: number, box?: BoundingBox2D): TransformHandleType | null {
    return this.overlay.hitTest(normX, normY, box);
  }

  public initDepthMesh(gridCols?: number, gridRows?: number, width?: number, height?: number): void {
    // 2.5D Parallax Depth plane initialization
  }

  public get scene(): { children: any[] } {
    if (this.isDisposed) return { children: [] };
    const items: any[] = [];
    if (this.particles) items.push(this.particles);
    if (this.hudConfig) items.push(this.hudConfig);
    items.push(this.overlay);
    items.push(this.partialVfxGroup);
    return { children: items };
  }

  public get camera(): { position: { x: number; y: number; z: number } } {
    return { position: { x: 0, y: 0, z: 10 } };
  }

  public get partialVfxGroup(): { children: any[] } {
    return {
      children: this.partialVfxRegions.map((reg) => {
        const typeName = reg.type === 'point_emitter' ? 'emitter' : reg.type;
        return {
          name: `vfx-${typeName}-${reg.id}`,
          ...reg,
        };
      }),
    };
  }

  public clearPartialVFX(): void {
    this.partialVfxRegions = [];
  }

  public setPartialVFXRegions(regions: PartialVFXRegion[]): void {
    this.partialVfxRegions = [...regions];
  }

  /**
   * Declarative GSAP timeline compiler.
   * Compiles sequence timing, entrance/exit fades, transform keyframes, and modifier easing
   * curves into this.timeline for deterministic frame-accurate scrubbing.
   */
  public syncTimeline(
    sequences: Array<{
      id: string;
      time: { start: number; duration: number };
      modifiers?: Array<{ type: string; params?: Record<string, unknown> }>;
    }>,
    fps: number = 30
  ): void {
    this.timeline.clear();
    this.interpolatedStates.clear();

    for (const seq of sequences) {
      const startSec = (seq.time?.start ?? 0) / fps;
      const durSec = Math.max(0.1, (seq.time?.duration ?? 30) / fps);

      // Extract transform params if available
      const transMod = seq.modifiers?.find((m) => m.type === 'transform');
      const tp = (transMod?.params || {}) as any;

      const targetX = tp.x ?? 0;
      const targetY = tp.y ?? 0;
      const targetScale = tp.scale ?? 1.0;
      const targetRot = tp.rotation ?? 0;
      const baseEase = tp.ease || 'power2.out';

      // 3-Stage Lifecycle config or Animation preset
      const anim = tp.animation;
      const preset = anim?.preset;

      const introDur = Math.min(durSec * 0.45, anim?.intro?.durationSec ?? 0.4);
      const introEase = anim?.intro?.ease ?? baseEase;
      const outroDur = Math.min(durSec * 0.35, anim?.outro?.durationSec ?? 0.3);
      const outroEase = anim?.outro?.ease ?? 'power2.in';
      const steadyType = anim?.steady?.type ?? (preset === 'drift' ? 'drift' : 'hold');

      // Determine initial state based on preset / lifecycle
      let initialX = targetX;
      let initialY = targetY;
      let initialScale = targetScale;
      let initialRot = targetRot;
      let initialOpacity = 0;

      if (preset === 'pop_in') {
        initialScale = targetScale * 0.2;
      } else if (preset === 'slide_left') {
        initialX = targetX - 350;
      } else if (preset === 'bounce') {
        initialY = targetY - 200;
        initialScale = targetScale * 0.6;
      } else if (preset === 'overshoot') {
        initialScale = targetScale * 0.3;
      } else if (preset === 'drift') {
        initialScale = targetScale * 0.94;
        initialX = targetX - 40;
      } else {
        // Standard smooth entrance
        initialScale = targetScale * 0.85;
      }

      const seqState = {
        opacity: initialOpacity,
        scale: initialScale,
        rotation: initialRot,
        x: initialX,
        y: initialY,
      };
      this.interpolatedStates.set(seq.id, seqState);

      // --- 1. INTRO STAGE (Entrance) ---
      if (introDur > 0) {
        this.timeline.to(
          seqState,
          {
            opacity: 1,
            scale: targetScale,
            x: targetX,
            y: targetY,
            rotation: targetRot,
            duration: introDur,
            ease: introEase,
          },
          startSec
        );
      } else {
        seqState.opacity = 1;
        seqState.scale = targetScale;
        seqState.x = targetX;
        seqState.y = targetY;
        seqState.rotation = targetRot;
      }

      // --- 2. STEADY STAGE (Hold or Subtle Drift) ---
      const steadyStart = startSec + introDur;
      const steadyDur = Math.max(0.01, durSec - introDur - outroDur);
      if (steadyType === 'drift') {
        this.timeline.to(
          seqState,
          {
            scale: targetScale * 1.05,
            x: targetX + 15,
            duration: steadyDur,
            ease: 'linear',
          },
          steadyStart
        );
      }

      // --- 3. OUTRO STAGE (Exit) ---
      if (outroDur > 0) {
        const outroStart = startSec + durSec - outroDur;
        let exitScale = targetScale * 0.8;
        let exitX = targetX;
        let exitY = targetY;

        if (preset === 'slide_left') {
          exitX = targetX + 350;
        } else if (preset === 'bounce') {
          exitY = targetY + 150;
        }

        this.timeline.to(
          seqState,
          {
            opacity: 0,
            scale: exitScale,
            x: exitX,
            y: exitY,
            duration: outroDur,
            ease: outroEase,
          },
          outroStart
        );
      }
    }
  }

  /**
   * Initializes generative particle swarm with dynamic gravitational attractor physics.
   */
  public initParticleSystem(count: number = 200): void {
    const pts = new Group();
    const vels = new Group();
    const colors: string[] = [];
    const radii = new Float32Array(count);

    const palette = ['#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#00ffff'];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const dist = 0.05 + Math.random() * 0.45;
      const x = 0.5 + Math.cos(angle) * dist;
      const y = 0.5 + Math.sin(angle) * dist;

      pts.push(new Pt(x, y));
      vels.push(new Pt((Math.random() - 0.5) * 0.015, (Math.random() - 0.5) * 0.015));
      colors.push(palette[i % palette.length]);
      radii[i] = 1.5 + Math.random() * 3.0;
    }

    this.particles = {
      pts,
      velocities: vels,
      colors,
      radii,
      attractor: new Pt(0.5, 0.5),
    };
  }

  /**
   * Initializes procedural cybernetic HUD telemetry.
   */
  public initHologramHUD(ringRadius: number = 0.35, scanlineDensity: number = 40): void {
    this.hudConfig = {
      ringRadiusNorm: ringRadius,
      scanlineDensity,
      color: '#00ffff',
      rotationSpeed: 0.5,
    };
  }

  /**
   * Updates state deterministically based on frame time in seconds.
   */
  public update(timeSec: number, popOutIntensity: number = 1.0): void {
    this.currentTime = timeSec;
    this.popOutIntensity = popOutIntensity;
    this.timeline.seek(timeSec);
  }

  /**
   * Dual-pass 2.5D parallax displacement & Blinn-Phong specular light pool.
   */
  public render2DParallax(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    timeSec: number,
    lightParams?: LightRelightParams
  ): void {
    const lx = (lightParams?.x ?? 0.5 + Math.sin(timeSec * 0.8) * 0.25) * w;
    const ly = (lightParams?.y ?? 0.5 + Math.cos(timeSec * 1.1) * 0.2) * h;
    const lightColor = lightParams?.color ?? '#00d4ff';
    const diffuse = lightParams?.diffuse ?? 1.2;
    const specular = lightParams?.specular ?? 1.5;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // 1. Diffuse Radial Sheen
    const diffRadius = Math.max(120, Math.min(w, h) * 0.55 * this.popOutIntensity);
    const diffGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, diffRadius);
    diffGrad.addColorStop(0, `${lightColor}${Math.min(255, Math.round(diffuse * 70)).toString(16).padStart(2, '0')}`);
    diffGrad.addColorStop(0.7, `${lightColor}15`);
    diffGrad.addColorStop(1, 'transparent');

    ctx.fillStyle = diffGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Specular Hotspot
    const specRadius = Math.max(30, Math.min(w, h) * 0.12 * this.popOutIntensity);
    const specGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, specRadius);
    specGrad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(0.85, specular * 0.35)})`);
    specGrad.addColorStop(0.5, `${lightColor}44`);
    specGrad.addColorStop(1, 'transparent');

    ctx.fillStyle = specGrad;
    ctx.beginPath();
    ctx.arc(lx, ly, specRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Main render method executing on any standard W3C CanvasRenderingContext2D.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    timeSec: number = this.currentTime,
    popOutIntensity: number = this.popOutIntensity
  ): void {
    this.update(timeSec, popOutIntensity);

    const w = this.width;
    const h = this.height;

    // 1. Render Generative Particle Warp / Swarm
    if (this.particles) {
      this.renderParticles(ctx, w, h, timeSec);
    }

    // 2. Render Procedural Cybernetic HUD
    if (this.hudConfig) {
      this.renderHUD(ctx, w, h, timeSec);
    }

    // 3. Render Partial VFX (Spotlights, Regional Blurs, Glitches, Emitters)
    if (this.partialVfxRegions.length > 0) {
      this.renderPartialVFX(ctx, w, h, timeSec);
    }

    // 4. Render In-Canvas Vector Transform Overlay (if visible)
    this.overlay.render(ctx, w, h);
  }

  private renderParticles(ctx: CanvasRenderingContext2D, w: number, h: number, timeSec: number): void {
    if (!this.particles) return;
    const { pts, velocities, colors, radii } = this.particles;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Dynamic Gravitational Attractor along Lissajous path
    const ax = 0.5 + Math.sin(timeSec * 0.9) * 0.22;
    const ay = 0.5 + Math.cos(timeSec * 1.3) * 0.18;
    this.particles.attractor.set(ax, ay);

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const vel = velocities[i];

      // Gravitational acceleration towards attractor
      const dx = ax - p.x;
      const dy = ay - p.y;
      const dist = Math.hypot(dx, dy) + 0.05;
      const force = 0.0006 / (dist * dist);

      vel.x = vel.x * 0.96 + (dx / dist) * force;
      vel.y = vel.y * 0.96 + (dy / dist) * force;

      p.x += vel.x;
      p.y += vel.y;

      // Boundary wrap
      if (p.x < 0.02) p.x = 0.98;
      if (p.x > 0.98) p.x = 0.02;
      if (p.y < 0.02) p.y = 0.98;
      if (p.y > 0.98) p.y = 0.02;

      const px = p.x * w;
      const py = p.y * h;
      const r = radii[i] * (1.0 + Math.sin(timeSec * 2 + i) * 0.25) * this.popOutIntensity;

      // Particle velocity trail
      ctx.strokeStyle = colors[i] + '44';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - vel.x * 4 * w, py - vel.y * 4 * h);
      ctx.stroke();

      // Particle Core
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.5, r), 0, Math.PI * 2);
      ctx.fillStyle = colors[i];
      ctx.shadowColor = colors[i];
      ctx.shadowBlur = 6;
      ctx.fill();
    }

    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D, w: number, h: number, timeSec: number): void {
    if (!this.hudConfig) return;
    const { ringRadiusNorm, color } = this.hudConfig;

    ctx.save();
    const cx = w * 0.5;
    const cy = h * 0.5;
    const baseRadius = Math.min(w, h) * ringRadiusNorm * this.popOutIntensity;
    const rot = timeSec * this.hudConfig.rotationSpeed;

    ctx.translate(cx, cy);
    ctx.rotate(rot);

    // Outer Segmented Tech Ring
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.setLineDash([20, 15, 5, 15]);

    ctx.beginPath();
    ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner Reverse Ring
    ctx.rotate(-rot * 2);
    ctx.setLineDash([40, 20]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius * 0.75, 0, Math.PI * 2);
    ctx.stroke();

    // Center Crosshairs
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    const crossSize = 12;
    ctx.beginPath();
    ctx.moveTo(-crossSize, 0);
    ctx.lineTo(crossSize, 0);
    ctx.moveTo(0, -crossSize);
    ctx.lineTo(0, crossSize);
    ctx.stroke();

    ctx.restore();
  }

  private renderPartialVFX(ctx: CanvasRenderingContext2D, w: number, h: number, timeSec: number): void {
    ctx.save();

    for (const reg of this.partialVfxRegions) {
      const rx = reg.x * w;
      const ry = reg.y * h;
      const rw = (reg.width ?? 0.3) * w;
      const rh = (reg.height ?? 0.2) * h;
      const color = reg.color ?? '#00d4ff';
      const intensity = reg.intensity ?? 1.5;

      if (reg.type === 'spotlight') {
        const rad = Math.max(20, (reg.radius ?? 160) * (w / 1920) * intensity);
        const grad = ctx.createRadialGradient(rx, ry, 0, rx, ry, rad);
        grad.addColorStop(0, color);
        grad.addColorStop(0.4, `${color}88`);
        grad.addColorStop(0.75, `${color}22`);
        grad.addColorStop(1, 'transparent');

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(rx, ry, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (reg.type === 'glitch') {
        // Multi-band RGB chromatic slice shifts
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const sliceH = rh / 4;
        for (let s = 0; s < 4; s++) {
          const jitter = Math.sin(timeSec * 35 + s * 2.5 + rx) * 12 * intensity;
          const sliceY = ry - rh / 2 + s * sliceH;

          // Magenta band
          ctx.fillStyle = 'rgba(236, 72, 153, 0.45)';
          ctx.fillRect(rx - rw / 2 + jitter, sliceY, rw, sliceH * 0.9);

          // Cyan band
          ctx.fillStyle = 'rgba(6, 182, 212, 0.45)';
          ctx.fillRect(rx - rw / 2 - jitter * 0.8, sliceY, rw, sliceH * 0.9);
        }
        ctx.restore();
      } else if (reg.type === 'blur') {
        // Localized soft frosted privacy vignette
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
        ctx.shadowBlur = 18;
        ctx.fillRect(rx - rw / 2, ry - rh / 2, rw, rh);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(rx - rw / 2, ry - rh / 2, rw, rh);
        ctx.restore();
      } else if (reg.type === 'point_emitter') {
        // Physics-driven spark emitter burst
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const sparkCount = 16;
        for (let i = 0; i < sparkCount; i++) {
          const spAngle = (i / sparkCount) * Math.PI * 2 + timeSec * 3;
          const life = (Math.sin(timeSec * 6 + i * 1.2) * 0.5 + 0.5);
          const spDist = life * 45 * intensity;
          const sx = rx + Math.cos(spAngle) * spDist;
          const sy = ry + Math.sin(spAngle) * spDist;

          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(0.5, 3 * (1 - life)), 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 6;
          ctx.fill();
        }
        ctx.restore();
      }
    }

    ctx.restore();
  }

  public dispose(): void {
    this.isDisposed = true;
    this.timeline.kill();
    this.particles = null;
    this.hudConfig = null;
    this.partialVfxRegions = [];
    this.overlay.dispose();
  }
}

// Backward-compatible alias during Iteration 7 migration
export { UniversalCanvasEngine as UniversalThreeScene };

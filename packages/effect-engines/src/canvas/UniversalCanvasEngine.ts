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
}

export interface HUDConfig {
  ringRadiusNorm: number;
  scanlineDensity: number;
  color: string;
  rotationSpeed: number;
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

  // GSAP Deterministic Scrubbed Timeline
  private timeline: gsap.core.Timeline;

  constructor(config: CanvasEngineConfig) {
    this.width = config.width;
    this.height = config.height;
    this.overlay = new CanvasTransformOverlay();

    // GSAP Timeline strictly in paused scrubbed mode (driven by frame math)
    this.timeline = gsap.timeline({ paused: true });
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  public setOverlayVisible(visible: boolean): void {
    this.overlay.setVisible(visible);
  }

  public updateOverlay(box: BoundingBox2D | null, activeGuides: SnappingGuide[] = []): void {
    this.overlay.update(box, activeGuides);
  }

  public hitTestOverlay(normX: number, normY: number, box?: BoundingBox2D): TransformHandleType | null {
    return this.overlay.hitTest(normX, normY, box);
  }

  public initDepthMesh(gridCols?: number, gridRows?: number, width?: number, height?: number): void {
    // 2.5D Parallax Depth plane initialization
  }

  private isDisposed: boolean = false;

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
   * Initializes generative particle warp / starfield network using Pts.js vectors.
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
      vels.push(new Pt((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02));
      colors.push(palette[i % palette.length]);
      radii[i] = 1.5 + Math.random() * 3.5;
    }

    this.particles = {
      pts,
      velocities: vels,
      colors,
      radii,
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
    const { pts, colors, radii } = this.particles;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const t = timeSec * 0.8;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      // Orbit & pulse math
      const orbitSpeed = 0.2 + (i % 5) * 0.1;
      const angle = t * orbitSpeed + (i * Math.PI) / 10;
      const radiusOffset = Math.sin(t * 1.5 + i) * 0.04;

      const px = (p.x + Math.cos(angle) * radiusOffset) * w;
      const py = (p.y + Math.sin(angle) * radiusOffset) * h;
      const r = radii[i] * (1.0 + Math.sin(t * 2 + i) * 0.3) * this.popOutIntensity;

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
        const rad = Math.max(20, (reg.radius ?? 160) * (w / 1920));
        const grad = ctx.createRadialGradient(rx, ry, 0, rx, ry, rad);
        grad.addColorStop(0, color);
        grad.addColorStop(0.7, `${color}44`);
        grad.addColorStop(1, 'transparent');

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(rx, ry, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (reg.type === 'glitch') {
        // RGB split slices
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(236, 72, 153, 0.4)'; // Magenta split
        const jitter = Math.sin(timeSec * 30 + rx) * 8 * intensity;
        ctx.fillRect(rx - rw / 2 + jitter, ry - rh / 2, rw, rh * 0.4);

        ctx.fillStyle = 'rgba(6, 182, 212, 0.4)'; // Cyan split
        ctx.fillRect(rx - rw / 2 - jitter, ry - rh / 2 + rh * 0.5, rw, rh * 0.4);
        ctx.restore();
      } else if (reg.type === 'blur') {
        // Simulated soft focus vignette box
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 16;
        ctx.fillRect(rx - rw / 2, ry - rh / 2, rw, rh);
        ctx.restore();
      } else if (reg.type === 'point_emitter') {
        // Spark burst
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 12; i++) {
          const spAngle = (i / 12) * Math.PI * 2 + timeSec * 4;
          const spDist = (Math.sin(timeSec * 5 + i) * 0.5 + 0.5) * 35;
          const sx = rx + Math.cos(spAngle) * spDist;
          const sy = ry + Math.sin(spAngle) * spDist;

          ctx.beginPath();
          ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
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

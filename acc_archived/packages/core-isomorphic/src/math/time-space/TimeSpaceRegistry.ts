import { TimeSpaceStateMachine, createTimeSpaceMachine } from './TimeSpaceStateMachine';
import { Pt, Group, Curve } from '../pts/DeterministicPtsEngine';
import { StatelessHashNoise } from '../pts/StatelessHashNoise';
import { DeterministicPtsForm } from '../pts/DeterministicPtsForm';

export type TimeSpaceFactory = (params?: any) => TimeSpaceStateMachine;

export class TimeSpaceRegistry {
  private static templates: Map<string, TimeSpaceFactory> = new Map();

  public static register(templateId: string, factory: TimeSpaceFactory): void {
    this.templates.set(templateId, factory);
  }

  public static has(templateId: string): boolean {
    return this.templates.has(templateId);
  }

  public static instantiate(templateId: string, params?: any): TimeSpaceStateMachine {
    const factory = this.templates.get(templateId);
    if (!factory) {
      // Fallback: create generic default machine
      return createTimeSpaceMachine({
        initialState: { progress: 0, opacity: 1 },
        setup: (tl, state) => {
          tl.to(state, { progress: 1, duration: 2, ease: 'linear' });
        },
      });
    }
    return factory(params);
  }

  public static getRegisteredTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  public static clear(): void {
    this.templates.clear();
    this.registerDefaults();
  }

  public static registerDefaults(): void {
    // 1. Callout Leader Line & Reticle
    this.register('callout_leader', (params = {}) => {
      const targetX = params.targetX ?? 0.0;
      const targetY = params.targetY ?? 0.0;
      const labelX = params.labelX ?? 0.4;
      const labelY = params.labelY ?? -0.3;
      const labelText = params.text ?? 'TARGET ACQUIRED';

      return createTimeSpaceMachine({
        initialState: {
          drawProgress: 0,
          reticleScale: 0,
          alpha: 1,
        },
        phases: {
          enter: {
            duration: 0.6,
            setup: (tl, state) => {
              tl.to(state, { reticleScale: 1, duration: 0.3, ease: 'back.out(2)' })
                .to(state, { drawProgress: 1, duration: 0.3, ease: 'power2.out' }, '-=0.1');
            },
          },
          idle: {
            duration: 2.0,
            setup: (tl, state) => {
              tl.to(state, { reticleScale: 1.15, duration: 1.0, yoyo: true, repeat: -1, ease: 'sine.inOut' });
            },
          },
          exit: {
            duration: 0.4,
            setup: (tl, state) => {
              tl.to(state, { alpha: 0, reticleScale: 0.5, duration: 0.4, ease: 'power2.in' });
            },
          },
        },
        generateGeometry: (state, space) => {
          const anchor = space.toPixels([targetX, targetY]);
          const box = space.toPixels([labelX, labelY]);

          const mid = new Pt((anchor[0] + box[0]) / 2, anchor[1]);
          const basePts = [anchor, mid, box];
          const fullCurve = Curve.bezier(basePts, 0.4);

          const progressCount = Math.max(2, Math.floor(fullCurve.length * state.drawProgress));
          const activeCurve = fullCurve.slice(0, progressCount);

          return {
            points: [anchor, box],
            groups: [activeCurve],
            polygons: [],
            meta: {
              box,
              anchor,
              text: labelText,
            },
          };
        },
        render: (snapshot, ctx) => {
          const form = new DeterministicPtsForm(ctx);
          const state = snapshot.state;
          ctx.save();
          ctx.globalAlpha = state.alpha;

          if (snapshot.geometry.groups[0]) {
            form.line(snapshot.geometry.groups[0], { stroke: '#00ffff', lineWidth: 2 });
          }

          if (snapshot.geometry.points[0]) {
            const anchor = snapshot.geometry.points[0];
            form.point(anchor, 6 * state.reticleScale, { fill: '#00ffff', stroke: '#ffffff', lineWidth: 1.5 });
          }

          if (snapshot.geometry.meta?.box && state.drawProgress >= 0.8) {
            const box = snapshot.geometry.meta.box;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(box[0], box[1] - 15, 140, 30, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px monospace';
            ctx.fillText(snapshot.geometry.meta.text, box[0] + 8, box[1] + 5);
          }

          ctx.restore();
        },
      });
    });

    // 2. Kinetic Title Modern
    this.register('kinetic_title', (params = {}) => {
      const text = params.text ?? 'PRODUCTION READY';
      return createTimeSpaceMachine({
        initialState: {
          scale: 0,
          yOffset: 50,
          opacity: 0,
        },
        phases: {
          enter: {
            duration: 0.5,
            setup: (tl, state) => {
              tl.to(state, { scale: 1, yOffset: 0, opacity: 1, duration: 0.5, ease: 'elastic.out(1, 0.75)' });
            },
          },
          idle: {
            duration: 3.0,
            setup: (tl, state) => {
              tl.to(state, { scale: 1.02, duration: 1.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
            },
          },
          exit: {
            duration: 0.3,
            setup: (tl, state) => {
              tl.to(state, { scale: 0.8, yOffset: -30, opacity: 0, duration: 0.3, ease: 'power2.in' });
            },
          },
        },
        generateGeometry: (state, space, time) => {
          const jitterX = StatelessHashNoise.hash(time.seed, time.frame, 1) * 2;
          const jitterY = StatelessHashNoise.hash(time.seed, time.frame, 2) * 2;
          const center = new Pt(space.center[0] + jitterX, space.center[1] + state.yOffset + jitterY);
          return {
            points: [center],
            groups: [],
            polygons: [],
            meta: { text, scale: state.scale, opacity: state.opacity },
          };
        },
        render: (snapshot, ctx) => {
          ctx.save();
          const meta = snapshot.geometry.meta;
          const pt = snapshot.geometry.points[0] || [0, 0];
          ctx.globalAlpha = meta.opacity;
          ctx.font = '900 48px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 12;
          ctx.translate(pt[0], pt[1]);
          ctx.scale(meta.scale, meta.scale);
          ctx.fillText(meta.text, 0, 0);
          ctx.restore();
        },
      });
    });

    // 3. Ambient Particle Field
    this.register('particle_ambient', (params = {}) => {
      const count = params.particleCount ?? 20;
      return createTimeSpaceMachine({
        initialState: {
          turbulence: 1,
          phaseTime: 0,
        },
        setup: (tl, state) => {
          tl.to(state, { turbulence: 2, duration: 4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
        },
        generateGeometry: (state, space, time) => {
          const pts: Pt[] = [];
          for (let i = 0; i < count; i++) {
            const baseNormX = StatelessHashNoise.hash(time.seed, 0, i * 2);
            const baseNormY = StatelessHashNoise.hash(time.seed, 0, i * 2 + 1);
            const curl = StatelessHashNoise.curlNoise2D(
              time.seed,
              time.frame,
              baseNormX * 2,
              baseNormY * 2
            );
            const normX = ((baseNormX + curl.x * 0.2 * state.turbulence + 1) % 2) - 1;
            const normY = ((baseNormY + curl.y * 0.2 * state.turbulence + 1) % 2) - 1;
            pts.push(space.toPixels([normX, normY]));
          }
          return {
            points: pts,
            groups: [],
            polygons: [],
          };
        },
      });
    });
  }
}

// Auto-register default templates on load
TimeSpaceRegistry.registerDefaults();

import { TimeSpaceStateMachine, createTimeSpaceMachine } from './TimeSpaceStateMachine';
import { Pt, Group, Curve, Circle, Polygon } from '../pts/DeterministicPtsEngine';
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
        render: (snapshot, ctx) => {
          const form = new DeterministicPtsForm(ctx);
          ctx.save();
          for (const pt of snapshot.geometry.points) {
            form.point(pt, 3, { fill: 'rgba(0, 240, 255, 0.75)', stroke: '#ffffff', lineWidth: 1 });
          }
          ctx.restore();
        },
      });
    });

    // 4. HUD Tactical Reticle (Broadcast & Sci-Fi FUI Targeting System)
    this.register('hud_tactical_reticle', (params = {}) => {
      const targetX = params.targetX ?? 0.0;
      const targetY = params.targetY ?? 0.0;
      const labelText = params.text ?? 'LOCK // AZM 184°';

      return createTimeSpaceMachine({
        initialState: {
          scale: 0,
          rotation: 0,
          counterRotation: 0,
          sweepAngle: 0,
          alpha: 1,
        },
        phases: {
          enter: {
            duration: 0.5,
            setup: (tl, state) => {
              tl.to(state, { scale: 1, duration: 0.5, ease: 'back.out(2)' });
            },
          },
          idle: {
            duration: 4.0,
            setup: (tl, state) => {
              tl.to(state, { rotation: 360, duration: 4.0, ease: 'none', repeat: -1 })
                .to(state, { counterRotation: -360, duration: 6.0, ease: 'none', repeat: -1 }, 0)
                .to(state, { sweepAngle: Math.PI * 2, duration: 2.0, ease: 'none', repeat: -1 }, 0);
            },
          },
          exit: {
            duration: 0.4,
            setup: (tl, state) => {
              tl.to(state, { alpha: 0, scale: 0.2, duration: 0.4, ease: 'power2.in' });
            },
          },
        },
        generateGeometry: (state, space) => {
          const center = space.toPixels([targetX, targetY]);
          const radius = Math.min(space.width, space.height) * 0.12 * state.scale;
          return {
            points: [center],
            groups: [],
            polygons: [],
            meta: {
              center,
              radius,
              rotation: state.rotation,
              counterRotation: state.counterRotation,
              sweepAngle: state.sweepAngle,
              alpha: state.alpha,
              text: labelText,
            },
          };
        },
        render: (snapshot, ctx) => {
          const meta = snapshot.geometry.meta;
          if (!meta || meta.radius <= 0) return;
          const [cx, cy] = [meta.center[0], meta.center[1]];
          const r = meta.radius;

          ctx.save();
          ctx.globalAlpha = meta.alpha;

          // Outer segmented dial
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate((meta.rotation * Math.PI) / 180);
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 1.5;
          for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, r, i * (Math.PI / 2) + 0.15, (i + 1) * (Math.PI / 2) - 0.15);
            ctx.stroke();
          }
          // Radial tick marks
          ctx.lineWidth = 1;
          for (let i = 0; i < 12; i++) {
            const angle = (i * Math.PI * 2) / 12;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * (r - 6), Math.sin(angle) * (r - 6));
            ctx.lineTo(Math.cos(angle) * (r + 4), Math.sin(angle) * (r + 4));
            ctx.stroke();
          }
          ctx.restore();

          // Inner counter-rotating ring with tick dashes
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate((meta.counterRotation * Math.PI) / 180);
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();

          // Crosshair and center targeting dot
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          const crossLen = r * 0.4;
          ctx.beginPath();
          ctx.moveTo(cx - crossLen, cy);
          ctx.lineTo(cx - 4, cy);
          ctx.moveTo(cx + 4, cy);
          ctx.lineTo(cx + crossLen, cy);
          ctx.moveTo(cx, cy - crossLen);
          ctx.lineTo(cx, cy - 4);
          ctx.moveTo(cx, cy + 4);
          ctx.lineTo(cx, cy + crossLen);
          ctx.stroke();

          // Center dot
          ctx.fillStyle = '#ff0055';
          ctx.beginPath();
          ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
          ctx.fill();

          // Corner HUD brackets
          const bSize = r * 1.25;
          const bArm = 12;
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
          ctx.lineWidth = 2;
          // Top-Left
          ctx.beginPath();
          ctx.moveTo(cx - bSize, cy - bSize + bArm);
          ctx.lineTo(cx - bSize, cy - bSize);
          ctx.lineTo(cx - bSize + bArm, cy - bSize);
          // Bottom-Right
          ctx.moveTo(cx + bSize, cy + bSize - bArm);
          ctx.lineTo(cx + bSize, cy + bSize);
          ctx.lineTo(cx + bSize - bArm, cy + bSize);
          ctx.stroke();

          // Telemetry readout text
          ctx.fillStyle = '#00f0ff';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(meta.text, cx + crossLen + 8, cy - 6);

          ctx.restore();
        },
      });
    });

    // 5. Multi-Target Annotation Callout
    this.register('callout_multitarget', (params = {}) => {
      const targetX = params.targetX ?? -0.2;
      const targetY = params.targetY ?? 0.1;
      const target2X = params.target2X ?? 0.3;
      const target2Y = params.target2Y ?? -0.2;
      const cardX = params.cardX ?? 0.0;
      const cardY = params.cardY ?? -0.4;
      const labelText = params.text ?? 'SENSOR CLUSTER ACTIVE';

      return createTimeSpaceMachine({
        initialState: {
          drawProgress: 0,
          pulse: 1,
          alpha: 1,
        },
        phases: {
          enter: {
            duration: 0.6,
            setup: (tl, state) => {
              tl.to(state, { drawProgress: 1, duration: 0.6, ease: 'power2.out' });
            },
          },
          idle: {
            duration: 2.0,
            setup: (tl, state) => {
              tl.to(state, { pulse: 1.3, duration: 1.0, yoyo: true, repeat: -1, ease: 'sine.inOut' });
            },
          },
          exit: {
            duration: 0.3,
            setup: (tl, state) => {
              tl.to(state, { alpha: 0, duration: 0.3, ease: 'power2.in' });
            },
          },
        },
        generateGeometry: (state, space) => {
          const a1 = space.toPixels([targetX, targetY]);
          const a2 = space.toPixels([target2X, target2Y]);
          const hub = space.toPixels([cardX, cardY]);

          const curve1 = Curve.bezier([a1, new Pt((a1[0] + hub[0]) / 2, a1[1]), hub], 0.3);
          const curve2 = Curve.bezier([a2, new Pt((a2[0] + hub[0]) / 2, a2[1]), hub], 0.3);

          const count1 = Math.max(2, Math.floor(curve1.length * state.drawProgress));
          const count2 = Math.max(2, Math.floor(curve2.length * state.drawProgress));

          return {
            points: [a1, a2, hub],
            groups: [curve1.slice(0, count1), curve2.slice(0, count2)],
            polygons: [],
            meta: {
              a1,
              a2,
              hub,
              pulse: state.pulse,
              alpha: state.alpha,
              drawProgress: state.drawProgress,
              text: labelText,
            },
          };
        },
        render: (snapshot, ctx) => {
          const meta = snapshot.geometry.meta;
          const form = new DeterministicPtsForm(ctx);
          ctx.save();
          ctx.globalAlpha = meta.alpha;

          // Spline leader lines
          if (snapshot.geometry.groups[0]) {
            form.line(snapshot.geometry.groups[0], { stroke: '#00ffff', lineWidth: 1.5 });
          }
          if (snapshot.geometry.groups[1]) {
            form.line(snapshot.geometry.groups[1], { stroke: 'rgba(0, 255, 255, 0.7)', lineWidth: 1.5 });
          }

          // Target node 1
          form.point(meta.a1, 5 * meta.pulse, { fill: '#00ffff', stroke: '#ffffff', lineWidth: 1.5 });
          ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
          ctx.beginPath();
          ctx.arc(meta.a1[0], meta.a1[1], 10 * meta.pulse, 0, Math.PI * 2);
          ctx.stroke();

          // Target node 2
          form.point(meta.a2, 4 * meta.pulse, { fill: '#ffbb00', stroke: '#ffffff', lineWidth: 1.5 });

          // Central Telemetry Hub Card
          if (meta.drawProgress >= 0.7) {
            const hx = meta.hub[0];
            const hy = meta.hub[1];
            ctx.fillStyle = 'rgba(10, 15, 28, 0.85)';
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(hx - 80, hy - 16, 160, 32, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#00ffff';
            ctx.fillRect(hx - 78, hy - 14, 4, 28);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(meta.text, hx + 4, hy + 4);
          }

          ctx.restore();
        },
      });
    });

    // 6. Network Plexus (Proximity Connected Particle Mesh)
    this.register('network_plexus', (params = {}) => {
      const nodeCount = params.nodeCount ?? 28;
      const proximityDist = params.proximityDistance ?? 140;

      return createTimeSpaceMachine({
        initialState: {
          turbulence: 1.0,
          alpha: 1,
        },
        phases: {
          enter: {
            duration: 0.8,
            setup: (tl, state) => {
              tl.to(state, { alpha: 1, duration: 0.8 });
            },
          },
          idle: {
            duration: 4.0,
            setup: (tl, state) => {
              tl.to(state, { turbulence: 2.2, duration: 2.0, yoyo: true, repeat: -1, ease: 'sine.inOut' });
            },
          },
          exit: {
            duration: 0.5,
            setup: (tl, state) => {
              tl.to(state, { alpha: 0, duration: 0.5 });
            },
          },
        },
        generateGeometry: (state, space, time) => {
          const pts: Pt[] = [];
          for (let i = 0; i < nodeCount; i++) {
            const baseNormX = StatelessHashNoise.hash(time.seed, 0, i * 4);
            const baseNormY = StatelessHashNoise.hash(time.seed, 0, i * 4 + 1);
            const curl = StatelessHashNoise.curlNoise2D(time.seed, time.frame, baseNormX * 1.5, baseNormY * 1.5);

            const nx = ((baseNormX + curl.x * 0.25 * state.turbulence + 1) % 2) - 1;
            const ny = ((baseNormY + curl.y * 0.25 * state.turbulence + 1) % 2) - 1;
            pts.push(space.toPixels([nx, ny]));
          }

          // Evaluate pairwise proximity connections
          const lines: { p1: Pt; p2: Pt; dist: number }[] = [];
          for (let i = 0; i < pts.length; i++) {
            for (let j = i + 1; j < pts.length; j++) {
              const dx = pts[i][0] - pts[j][0];
              const dy = pts[i][1] - pts[j][1];
              const d = Math.sqrt(dx * dx + dy * dy);
              if (d < proximityDist) {
                lines.push({ p1: pts[i], p2: pts[j], dist: d });
              }
            }
          }

          return {
            points: pts,
            groups: [],
            polygons: [],
            meta: {
              lines,
              proximityDist,
              alpha: state.alpha,
            },
          };
        },
        render: (snapshot, ctx) => {
          const meta = snapshot.geometry.meta;
          const form = new DeterministicPtsForm(ctx);
          ctx.save();
          ctx.globalAlpha = meta.alpha;

          // Render proximity edge lines
          for (const line of meta.lines) {
            const edgeAlpha = (1.0 - line.dist / meta.proximityDist) * 0.75;
            ctx.strokeStyle = `rgba(0, 240, 255, ${edgeAlpha})`;
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.moveTo(line.p1[0], line.p1[1]);
            ctx.lineTo(line.p2[0], line.p2[1]);
            ctx.stroke();
          }

          // Render nodes
          for (const pt of snapshot.geometry.points) {
            form.point(pt, 3, { fill: '#ffffff', stroke: '#00ffff', lineWidth: 1 });
          }

          ctx.restore();
        },
      });
    });

    // 7. Radial Audio Waveform Ring
    this.register('audio_waveform_ring', (params = {}) => {
      const targetX = params.targetX ?? 0.0;
      const targetY = params.targetY ?? 0.0;
      const sampleCount = 64;

      return createTimeSpaceMachine({
        initialState: {
          radiusScale: 0,
          energy: 1.0,
          rotation: 0,
          alpha: 1,
        },
        phases: {
          enter: {
            duration: 0.5,
            setup: (tl, state) => {
              tl.to(state, { radiusScale: 1, duration: 0.5, ease: 'back.out(1.7)' });
            },
          },
          idle: {
            duration: 3.0,
            setup: (tl, state) => {
              tl.to(state, { energy: 2.0, duration: 0.8, yoyo: true, repeat: -1, ease: 'power1.inOut' })
                .to(state, { rotation: 360, duration: 8.0, ease: 'none', repeat: -1 }, 0);
            },
          },
          exit: {
            duration: 0.3,
            setup: (tl, state) => {
              tl.to(state, { radiusScale: 0.2, alpha: 0, duration: 0.3 });
            },
          },
        },
        generateGeometry: (state, space, time) => {
          const center = space.toPixels([targetX, targetY]);
          const baseRadius = Math.min(space.width, space.height) * 0.14 * state.radiusScale;
          const ringPts: Pt[] = [];

          for (let i = 0; i < sampleCount; i++) {
            const angle = (i * Math.PI * 2) / sampleCount + (state.rotation * Math.PI) / 180;
            const noiseVal = StatelessHashNoise.noise2D(time.seed, time.frame * 0.1, i * 0.4);
            const peak = Math.abs(noiseVal) * 35 * state.energy;
            const r = baseRadius + peak;
            ringPts.push(new Pt(center[0] + Math.cos(angle) * r, center[1] + Math.sin(angle) * r));
          }

          return {
            points: [center],
            groups: [new Group(...ringPts)],
            polygons: [new Group(...ringPts) as any],
            meta: {
              center,
              baseRadius,
              alpha: state.alpha,
            },
          };
        },
        render: (snapshot, ctx) => {
          const meta = snapshot.geometry.meta;
          const form = new DeterministicPtsForm(ctx);
          ctx.save();
          ctx.globalAlpha = meta.alpha;

          // Inner glow core
          form.point(meta.center, meta.baseRadius * 0.7, {
            fill: 'rgba(0, 240, 255, 0.08)',
            stroke: 'rgba(0, 240, 255, 0.4)',
            lineWidth: 1.5,
          });

          // Waveform polygon boundary
          if (snapshot.geometry.polygons[0]) {
            form.polygon(snapshot.geometry.polygons[0], {
              stroke: '#00ffff',
              fill: 'rgba(0, 240, 255, 0.12)',
              lineWidth: 2,
            });
          }

          // Center pulsing core dot
          form.point(meta.center, 5, { fill: '#ffffff', stroke: '#00ffff', lineWidth: 2 });

          ctx.restore();
        },
      });
    });

    // 8. Cyber Lower-Third Banner
    this.register('cyber_lower_third', (params = {}) => {
      const bannerX = params.targetX ?? -0.3;
      const bannerY = params.targetY ?? 0.65;
      const title = params.text ?? 'CHIEF SYSTEMS ARCHITECT';
      const subtitle = params.subtitle ?? 'UNIPOST CORE OS // NODE 01';

      return createTimeSpaceMachine({
        initialState: {
          wipe: 0,
          cardHeight: 0,
          textAlpha: 0,
          alpha: 1,
        },
        phases: {
          enter: {
            duration: 0.6,
            setup: (tl, state) => {
              tl.to(state, { wipe: 1, duration: 0.35, ease: 'power3.out' })
                .to(state, { cardHeight: 1, duration: 0.25, ease: 'power2.out' }, '-=0.1')
                .to(state, { textAlpha: 1, duration: 0.2 }, '-=0.1');
            },
          },
          idle: {
            duration: 3.5,
            setup: () => {},
          },
          exit: {
            duration: 0.4,
            setup: (tl, state) => {
              tl.to(state, { alpha: 0, wipe: 0, duration: 0.4, ease: 'power2.in' });
            },
          },
        },
        generateGeometry: (state, space) => {
          const origin = space.toPixels([bannerX, bannerY]);
          const fullWidth = space.width * 0.45;
          const fullHeight = 60;
          return {
            points: [origin],
            groups: [],
            polygons: [],
            meta: {
              origin,
              fullWidth,
              fullHeight,
              wipe: state.wipe,
              cardHeight: state.cardHeight,
              textAlpha: state.textAlpha,
              alpha: state.alpha,
              title,
              subtitle,
            },
          };
        },
        render: (snapshot, ctx) => {
          const m = snapshot.geometry.meta;
          const ox = m.origin[0];
          const oy = m.origin[1];
          const curW = m.fullWidth * m.wipe;
          const curH = m.fullHeight * m.cardHeight;

          ctx.save();
          ctx.globalAlpha = m.alpha;

          if (curW > 5 && curH > 5) {
            // Chamfered background box
            ctx.fillStyle = 'rgba(11, 15, 25, 0.85)';
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(ox, oy);
            ctx.lineTo(ox + curW - 14, oy);
            ctx.lineTo(ox + curW, oy + 14);
            ctx.lineTo(ox + curW, oy + curH);
            ctx.lineTo(ox + 14, oy + curH);
            ctx.lineTo(ox, oy + curH - 14);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Accent bar
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(ox, oy, 6, curH);

            // Title & Subtitle Typography
            if (m.textAlpha > 0.1) {
              ctx.save();
              ctx.globalAlpha = m.textAlpha * m.alpha;
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 15px sans-serif';
              ctx.fillText(m.title, ox + 20, oy + 26);

              ctx.fillStyle = '#00f0ff';
              ctx.font = 'bold 10px monospace';
              ctx.fillText(m.subtitle, ox + 20, oy + 46);
              ctx.restore();
            }
          }

          ctx.restore();
        },
      });
    });

    // 9. Dynamic Cinematic Countdown
    this.register('dynamic_countdown', (params = {}) => {
      const targetX = params.targetX ?? 0.0;
      const targetY = params.targetY ?? 0.0;
      const durationSeconds = params.durationSeconds ?? 5;

      return createTimeSpaceMachine({
        initialState: {
          scale: 0,
          countdownVal: durationSeconds,
          pulse: 1,
          alpha: 1,
        },
        phases: {
          enter: {
            duration: 0.4,
            setup: (tl, state) => {
              tl.to(state, { scale: 1, duration: 0.4, ease: 'back.out(2)' });
            },
          },
          idle: {
            duration: durationSeconds,
            setup: (tl, state) => {
              tl.to(state, { countdownVal: 0, duration: durationSeconds, ease: 'linear' });
            },
          },
          exit: {
            duration: 0.4,
            setup: (tl, state) => {
              tl.to(state, { scale: 2.0, alpha: 0, duration: 0.4, ease: 'power2.out' });
            },
          },
        },
        generateGeometry: (state, space) => {
          const center = space.toPixels([targetX, targetY]);
          const radius = Math.min(space.width, space.height) * 0.12 * state.scale;
          const progress = Math.max(0, state.countdownVal / durationSeconds);

          return {
            points: [center],
            groups: [],
            polygons: [],
            meta: {
              center,
              radius,
              progress,
              displayNumber: Math.ceil(state.countdownVal),
              alpha: state.alpha,
            },
          };
        },
        render: (snapshot, ctx) => {
          const m = snapshot.geometry.meta;
          if (m.radius <= 0) return;
          const [cx, cy] = [m.center[0], m.center[1]];
          const r = m.radius;

          ctx.save();
          ctx.globalAlpha = m.alpha;

          // Track circle
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();

          // Progress Arc
          ctx.strokeStyle = m.displayNumber <= 2 ? '#ff0055' : '#00f0ff';
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + m.progress * Math.PI * 2, false);
          ctx.stroke();

          // Center Digit
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.floor(r * 0.9)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(m.displayNumber), cx, cy);

          ctx.restore();
        },
      });
    });

    // 10. Energy Shield Hex Lattice
    this.register('energy_shield_hex', (params = {}) => {
      const centerX = params.targetX ?? 0.0;
      const centerY = params.targetY ?? 0.0;
      const hexRadius = 24;

      return createTimeSpaceMachine({
        initialState: {
          rippleRadius: 0,
          shieldAlpha: 0,
        },
        phases: {
          enter: {
            duration: 0.5,
            setup: (tl, state) => {
              tl.to(state, { shieldAlpha: 0.9, duration: 0.5 });
            },
          },
          idle: {
            duration: 3.0,
            setup: (tl, state) => {
              tl.to(state, { rippleRadius: 350, duration: 2.0, repeat: -1, ease: 'power1.out' });
            },
          },
          exit: {
            duration: 0.4,
            setup: (tl, state) => {
              tl.to(state, { shieldAlpha: 0, duration: 0.4 });
            },
          },
        },
        generateGeometry: (state, space) => {
          const center = space.toPixels([centerX, centerY]);
          const hexCenters: Pt[] = [];

          // Generate a localized 7x7 hex grid
          const cols = 7;
          const rows = 7;
          const dx = hexRadius * 1.732;
          const dy = hexRadius * 1.5;

          for (let r = -rows; r <= rows; r++) {
            for (let c = -cols; c <= cols; c++) {
              const x = center[0] + c * dx + ((Math.abs(r) % 2) * dx) / 2;
              const y = center[1] + r * dy;
              hexCenters.push(new Pt(x, y));
            }
          }

          return {
            points: hexCenters,
            groups: [],
            polygons: [],
            meta: {
              center,
              rippleRadius: state.rippleRadius,
              shieldAlpha: state.shieldAlpha,
              hexRadius,
            },
          };
        },
        render: (snapshot, ctx) => {
          const m = snapshot.geometry.meta;
          const [cx, cy] = [m.center[0], m.center[1]];
          ctx.save();
          ctx.globalAlpha = m.shieldAlpha;

          for (const hp of snapshot.geometry.points) {
            const dist = Math.sqrt((hp[0] - cx) ** 2 + (hp[1] - cy) ** 2);
            // Ripple wavefront proximity
            const waveDelta = Math.abs(dist - m.rippleRadius);
            const intensity = Math.max(0, 1 - waveDelta / 80);

            if (intensity > 0.05) {
              ctx.strokeStyle = `rgba(0, 240, 255, ${intensity * 0.8})`;
              ctx.fillStyle = `rgba(0, 240, 255, ${intensity * 0.25})`;
              ctx.lineWidth = 1.2;

              // Draw regular hexagon
              ctx.beginPath();
              for (let k = 0; k < 6; k++) {
                const angle = (k * Math.PI) / 3;
                const hx = hp[0] + Math.cos(angle) * (m.hexRadius - 2);
                const hy = hp[1] + Math.sin(angle) * (m.hexRadius - 2);
                if (k === 0) ctx.moveTo(hx, hy);
                else ctx.lineTo(hx, hy);
              }
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            }
          }

          ctx.restore();
        },
      });
    });

    // 11. Cyberpunk Glitch Data Stream Rain
    this.register('glitch_data_stream', (params = {}) => {
      const columnCount = params.columnCount ?? 14;
      const chars = '0123456789ABCDEF$#@&*';

      return createTimeSpaceMachine({
        initialState: {
          streamOffset: 0,
          alpha: 1,
        },
        phases: {
          enter: {
            duration: 0.4,
            setup: (tl, state) => {
              tl.to(state, { alpha: 1, duration: 0.4 });
            },
          },
          idle: {
            duration: 4.0,
            setup: (tl, state) => {
              tl.to(state, { streamOffset: 100, duration: 4.0, ease: 'none', repeat: -1 });
            },
          },
          exit: {
            duration: 0.3,
            setup: (tl, state) => {
              tl.to(state, { alpha: 0, duration: 0.3 });
            },
          },
        },
        generateGeometry: (state, space) => {
          return {
            points: [],
            groups: [],
            polygons: [],
            meta: {
              columnCount,
              streamOffset: state.streamOffset,
              alpha: state.alpha,
              chars,
              width: space.width,
              height: space.height,
            },
          };
        },
        render: (snapshot, ctx) => {
          const m = snapshot.geometry.meta;
          ctx.save();
          ctx.globalAlpha = m.alpha;
          ctx.font = 'bold 12px monospace';

          const colSpacing = m.width / (m.columnCount + 1);
          for (let c = 1; c <= m.columnCount; c++) {
            const x = c * colSpacing;
            const speed = 1.0 + (c % 3) * 0.5;
            const headY = ((m.streamOffset * 8 * speed + c * 75) % (m.height + 200)) - 100;

            for (let row = 0; row < 12; row++) {
              const y = headY - row * 16;
              if (y >= 0 && y <= m.height) {
                const charIdx = (c * 17 + row + Math.floor(m.streamOffset)) % m.chars.length;
                const char = m.chars[charIdx];

                if (row === 0) {
                  ctx.fillStyle = '#ffffff';
                  ctx.shadowColor = '#00ff88';
                  ctx.shadowBlur = 8;
                } else {
                  const trailAlpha = 1.0 - row / 12;
                  ctx.fillStyle = `rgba(0, 255, 136, ${trailAlpha * 0.75})`;
                  ctx.shadowBlur = 0;
                }

                ctx.fillText(char, x, y);
              }
            }
          }

          ctx.restore();
        },
      });
    });
  }
}

// Auto-register default templates on load
TimeSpaceRegistry.registerDefaults();

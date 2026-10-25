import { createTimeSpaceMachine, TimeSpaceStateMachine, Pt, Curve } from '@acc/core-isomorphic';

export interface CalloutTargetPoint {
  x: number;
  y: number;
}

export interface CalloutSpec {
  labelText: string;
  targetPoint: CalloutTargetPoint;
  boxOffset: { x: number; y: number };
}

export class TrackingCalloutEngine {
  public static renderTrackingCallout(
    ctx: any,
    spec: CalloutSpec
  ): void {
    ctx.save();

    const boxX = spec.targetPoint.x + spec.boxOffset.x;
    const boxY = spec.targetPoint.y + spec.boxOffset.y;

    // Target Anchor Circle
    ctx.beginPath();
    ctx.arc(spec.targetPoint.x, spec.targetPoint.y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#00ffff';
    ctx.fill();

    // Connecting Leader Line
    ctx.beginPath();
    ctx.moveTo(spec.targetPoint.x, spec.targetPoint.y);
    ctx.lineTo(boxX, boxY);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label Card
    ctx.font = 'bold 22px sans-serif';
    const textMetrics = ctx.measureText(spec.labelText);
    const cardW = textMetrics.width + 32;
    const cardH = 40;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.roundRect(boxX, boxY - cardH / 2, cardW, cardH, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(spec.labelText, boxX + 16, boxY + 7);

    ctx.restore();
  }

  /**
   * Creates a deterministic TimeSpaceStateMachine for animated tracking callouts.
   */
  public static createCalloutMachine(spec: CalloutSpec): TimeSpaceStateMachine {
    return createTimeSpaceMachine({
      initialState: {
        drawProgress: 0,
        reticlePulse: 1,
        opacity: 1,
      },
      phases: {
        enter: {
          duration: 0.5,
          setup: (tl, state) => {
            tl.to(state, { drawProgress: 1, opacity: 1, duration: 0.5, ease: 'power2.out' });
          },
        },
        idle: {
          duration: 2.5,
          setup: (tl, state) => {
            tl.to(state, { reticlePulse: 1.25, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
          },
        },
        exit: {
          duration: 0.3,
          setup: (tl, state) => {
            tl.to(state, { opacity: 0, duration: 0.3, ease: 'power2.in' });
          },
        },
      },
      generateGeometry: (state) => {
        const anchor = new Pt(spec.targetPoint.x, spec.targetPoint.y);
        const box = new Pt(spec.targetPoint.x + spec.boxOffset.x, spec.targetPoint.y + spec.boxOffset.y);
        const mid = new Pt((anchor[0] + box[0]) / 2, anchor[1]);
        const curve = Curve.bezier([anchor, mid, box], 0.3);

        const activeCount = Math.max(2, Math.floor(curve.length * state.drawProgress));
        return {
          points: [anchor, box],
          groups: [curve.slice(0, activeCount)],
          polygons: [],
          meta: { spec, state },
        };
      },
      render: (snapshot, ctx) => {
        const state = snapshot.state;
        if (state.opacity <= 0.001) return;

        ctx.save();
        ctx.globalAlpha = state.opacity;

        const anchor = snapshot.geometry.points[0];
        const box = snapshot.geometry.points[1];

        // Anchor
        ctx.beginPath();
        ctx.arc(anchor[0], anchor[1], 8 * state.reticlePulse, 0, Math.PI * 2);
        ctx.fillStyle = '#00ffff';
        ctx.fill();

        // Line
        if (snapshot.geometry.groups[0]) {
          const grp = snapshot.geometry.groups[0];
          ctx.beginPath();
          ctx.moveTo(grp[0][0], grp[0][1]);
          for (let i = 1; i < grp.length; i++) {
            ctx.lineTo(grp[i][0], grp[i][1]);
          }
          ctx.strokeStyle = '#00ffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Card
        if (state.drawProgress >= 0.7) {
          ctx.font = 'bold 22px sans-serif';
          const textMetrics = ctx.measureText(spec.labelText);
          const cardW = textMetrics.width + 32;
          const cardH = 40;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
          ctx.roundRect(box[0], box[1] - cardH / 2, cardW, cardH, 8);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.fillText(spec.labelText, box[0] + 16, box[1] + 7);
        }

        ctx.restore();
      },
    });
  }
}

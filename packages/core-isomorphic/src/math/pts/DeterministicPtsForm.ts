import type { ICanvasContext2D } from '../../../isomorphic/canvas/types';
import { Pt, Group, Curve, Circle } from './DeterministicPtsEngine';

export interface FormDrawStyle {
  fill?: string;
  stroke?: string;
  lineWidth?: number;
  alpha?: number;
}

/**
 * DeterministicPtsForm:
 * Adapter mapping pure Pts shapes to any ICanvasContext2D without browser DOM or rAF dependencies.
 * Also exposes raw Float32Array vertex buffers for WebGL2/WebGPU compositing.
 */
export class DeterministicPtsForm {
  private ctx: ICanvasContext2D;

  constructor(ctx: ICanvasContext2D) {
    this.ctx = ctx;
  }

  public setContext(ctx: ICanvasContext2D): this {
    this.ctx = ctx;
    return this;
  }

  public getContext(): ICanvasContext2D {
    return this.ctx;
  }

  public point(pt: Pt | [number, number], radius: number = 4, style: FormDrawStyle = {}): this {
    const x = pt[0];
    const y = pt[1];
    this.ctx.save();
    if (style.alpha !== undefined) this.ctx.globalAlpha = style.alpha;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (style.fill) {
      this.ctx.fillStyle = style.fill;
      this.ctx.fill();
    }
    if (style.stroke) {
      this.ctx.strokeStyle = style.stroke;
      this.ctx.lineWidth = style.lineWidth ?? 1;
      this.ctx.stroke();
    }
    this.ctx.restore();
    return this;
  }

  public line(pts: Pt[] | Group | [number, number][], style: FormDrawStyle = {}): this {
    if (!pts || pts.length < 2) return this;
    this.ctx.save();
    if (style.alpha !== undefined) this.ctx.globalAlpha = style.alpha;
    this.ctx.beginPath();
    this.ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      this.ctx.lineTo(pts[i][0], pts[i][1]);
    }
    this.ctx.strokeStyle = style.stroke ?? '#ffffff';
    this.ctx.lineWidth = style.lineWidth ?? 1;
    this.ctx.stroke();
    this.ctx.restore();
    return this;
  }

  public polygon(
    pts: Pt[] | Group | [number, number][],
    style: FormDrawStyle = {},
    closePath: boolean = true
  ): this {
    if (!pts || pts.length < 2) return this;
    this.ctx.save();
    if (style.alpha !== undefined) this.ctx.globalAlpha = style.alpha;
    this.ctx.beginPath();
    this.ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      this.ctx.lineTo(pts[i][0], pts[i][1]);
    }
    if (closePath) {
      this.ctx.closePath();
    }
    if (style.fill) {
      this.ctx.fillStyle = style.fill;
      this.ctx.fill();
    }
    if (style.stroke) {
      this.ctx.strokeStyle = style.stroke;
      this.ctx.lineWidth = style.lineWidth ?? 1;
      this.ctx.stroke();
    }
    this.ctx.restore();
    return this;
  }

  public curve(
    pts: Pt[] | Group,
    tension: number = 0.5,
    style: FormDrawStyle = {}
  ): this {
    if (!pts || pts.length < 2) return this;
    const curveGroup = Curve.bezier(pts, tension);
    return this.line(curveGroup, style);
  }

  public circle(
    circleOrPt: Pt | [number, number] | Group,
    radius: number = 10,
    style: FormDrawStyle = {}
  ): this {
    let x = 0;
    let y = 0;
    let r = radius;

    if (Array.isArray(circleOrPt) && circleOrPt.length >= 2 && Array.isArray(circleOrPt[0])) {
      // Circle group with center and radius point
      x = circleOrPt[0][0];
      y = circleOrPt[0][1];
      r = Circle.radius(circleOrPt as any);
    } else {
      x = (circleOrPt as any)[0];
      y = (circleOrPt as any)[1];
    }

    return this.point([x, y], r, style);
  }

  /**
   * Converts geometric point arrays into a flat Float32Array vertex position buffer
   * [x0, y0, x1, y1, ...] for direct WebGL2/WebGPU shader binding.
   */
  public static toBuffer(geometry: (Pt | [number, number])[] | Group[]): Float32Array {
    let totalPoints = 0;
    const pointList: (Pt | [number, number])[] = [];

    for (const item of geometry) {
      if (Array.isArray(item) && item.length > 0 && (Array.isArray(item[0]) || item[0] instanceof Pt)) {
        for (const pt of item as any) {
          pointList.push(pt);
          totalPoints++;
        }
      } else {
        pointList.push(item as Pt | [number, number]);
        totalPoints++;
      }
    }

    const buffer = new Float32Array(totalPoints * 2);
    for (let i = 0; i < totalPoints; i++) {
      buffer[i * 2] = pointList[i][0];
      buffer[i * 2 + 1] = pointList[i][1];
    }
    return buffer;
  }
}

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
}

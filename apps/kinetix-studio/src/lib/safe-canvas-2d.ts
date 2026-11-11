// ============================================================================
// DEFENSIVE CANVAS GEOMETRY ADAPTER (SAFE-CANVAS-2D)
// Guarantees `IndexSizeError: The radius provided is negative` NEVER occurs.
// Provides complete text, transformation, and filter delegation.
// ============================================================================

export type AnyCanvas2DContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export class SafeCanvas2D {
  public readonly raw: AnyCanvas2DContext;

  constructor(ctx: AnyCanvas2DContext) {
    this.raw = ctx;
  }

  private safeRadius(r: number, fallback = 0.001): number {
    if (!Number.isFinite(r)) return fallback;
    return Math.max(fallback, Math.abs(r));
  }

  private safeCoord(v: number, fallback = 0): number {
    return Number.isFinite(v) ? v : fallback;
  }

  save(): void {
    this.raw.save();
  }

  restore(): void {
    this.raw.restore();
  }

  beginPath(): void {
    this.raw.beginPath();
  }

  closePath(): void {
    this.raw.closePath();
  }

  stroke(): void {
    this.raw.stroke();
  }

  fill(): void {
    this.raw.fill();
  }

  clip(): void {
    this.raw.clip();
  }

  clearRect(x: number, y: number, w: number, h: number): void {
    this.raw.clearRect(this.safeCoord(x), this.safeCoord(y), this.safeCoord(w), this.safeCoord(h));
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.raw.fillRect(this.safeCoord(x), this.safeCoord(y), this.safeCoord(w), this.safeCoord(h));
  }

  strokeRect(x: number, y: number, w: number, h: number): void {
    this.raw.strokeRect(this.safeCoord(x), this.safeCoord(y), this.safeCoord(w), this.safeCoord(h));
  }

  rect(x: number, y: number, w: number, h: number): void {
    this.raw.rect(this.safeCoord(x), this.safeCoord(y), this.safeCoord(w), this.safeCoord(h));
  }

  moveTo(x: number, y: number): void {
    this.raw.moveTo(this.safeCoord(x), this.safeCoord(y));
  }

  lineTo(x: number, y: number): void {
    this.raw.lineTo(this.safeCoord(x), this.safeCoord(y));
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.raw.quadraticCurveTo(
      this.safeCoord(cpx),
      this.safeCoord(cpy),
      this.safeCoord(x),
      this.safeCoord(y)
    );
  }

  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number
  ): void {
    this.raw.bezierCurveTo(
      this.safeCoord(cp1x),
      this.safeCoord(cp1y),
      this.safeCoord(cp2x),
      this.safeCoord(cp2y),
      this.safeCoord(x),
      this.safeCoord(y)
    );
  }

  translate(x: number, y: number): void {
    this.raw.translate(this.safeCoord(x), this.safeCoord(y));
  }

  rotate(angle: number): void {
    this.raw.rotate(this.safeCoord(angle));
  }

  scale(x: number, y: number): void {
    this.raw.scale(this.safeCoord(x, 1), this.safeCoord(y, 1));
  }

  transform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.raw.transform(
      this.safeCoord(a, 1),
      this.safeCoord(b, 0),
      this.safeCoord(c, 0),
      this.safeCoord(d, 1),
      this.safeCoord(e, 0),
      this.safeCoord(f, 0)
    );
  }

  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.raw.setTransform(
      this.safeCoord(a, 1),
      this.safeCoord(b, 0),
      this.safeCoord(c, 0),
      this.safeCoord(d, 1),
      this.safeCoord(e, 0),
      this.safeCoord(f, 0)
    );
  }

  resetTransform(): void {
    if (typeof this.raw.resetTransform === 'function') {
      this.raw.resetTransform();
    } else {
      this.raw.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  setLineDash(segments: number[]): void {
    this.raw.setLineDash(segments.map((s) => Math.max(0, this.safeCoord(s))));
  }

  arc(
    x: number,
    y: number,
    radius: number,
    startAngle = 0,
    endAngle = Math.PI * 2,
    counterclockwise = false
  ): void {
    const safeR = this.safeRadius(radius, 0.5);
    this.raw.arc(
      this.safeCoord(x),
      this.safeCoord(y),
      safeR,
      this.safeCoord(startAngle),
      this.safeCoord(endAngle),
      counterclockwise
    );
  }

  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void {
    this.raw.arcTo(
      this.safeCoord(x1),
      this.safeCoord(y1),
      this.safeCoord(x2),
      this.safeCoord(y2),
      this.safeRadius(radius, 0.001)
    );
  }

  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation = 0,
    startAngle = 0,
    endAngle = Math.PI * 2,
    counterclockwise = false
  ): void {
    const safeRx = this.safeRadius(radiusX, 0.5);
    const safeRy = this.safeRadius(radiusY, 0.5);
    this.raw.ellipse(
      this.safeCoord(x),
      this.safeCoord(y),
      safeRx,
      safeRy,
      this.safeCoord(rotation),
      this.safeCoord(startAngle),
      this.safeCoord(endAngle),
      counterclockwise
    );
  }

  roundRect(x: number, y: number, w: number, h: number, radius = 4): void {
    const safeR = this.safeRadius(radius, 0);
    const rx = this.safeCoord(x);
    const ry = this.safeCoord(y);
    const rw = this.safeCoord(w);
    const rh = this.safeCoord(h);
    if (typeof this.raw.roundRect === 'function') {
      this.raw.roundRect(rx, ry, rw, rh, safeR);
    } else {
      this.raw.rect(rx, ry, rw, rh);
    }
  }

  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number
  ): CanvasGradient {
    return this.raw.createRadialGradient(
      this.safeCoord(x0),
      this.safeCoord(y0),
      this.safeRadius(r0, 0.01),
      this.safeCoord(x1),
      this.safeCoord(y1),
      this.safeRadius(r1, 1.0)
    );
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient {
    return this.raw.createLinearGradient(
      this.safeCoord(x0),
      this.safeCoord(y0),
      this.safeCoord(x1),
      this.safeCoord(y1)
    );
  }

  // --- TEXT RENDERING METHODS ---
  fillText(text: string, x: number, y: number, maxWidth?: number): void {
    if (maxWidth !== undefined) {
      this.raw.fillText(text, this.safeCoord(x), this.safeCoord(y), this.safeCoord(maxWidth));
    } else {
      this.raw.fillText(text, this.safeCoord(x), this.safeCoord(y));
    }
  }

  strokeText(text: string, x: number, y: number, maxWidth?: number): void {
    if (maxWidth !== undefined) {
      this.raw.strokeText(text, this.safeCoord(x), this.safeCoord(y), this.safeCoord(maxWidth));
    } else {
      this.raw.strokeText(text, this.safeCoord(x), this.safeCoord(y));
    }
  }

  measureText(text: string): TextMetrics {
    return this.raw.measureText(text);
  }

  drawImage(image: CanvasImageSource, dx: number, dy: number, dw?: number, dh?: number): void {
    if (dw !== undefined && dh !== undefined) {
      this.raw.drawImage(
        image,
        this.safeCoord(dx),
        this.safeCoord(dy),
        this.safeCoord(dw),
        this.safeCoord(dh)
      );
    } else {
      this.raw.drawImage(image, this.safeCoord(dx), this.safeCoord(dy));
    }
  }

  getImageData(sx: number, sy: number, sw: number, sh: number, settings?: ImageDataSettings): ImageData {
    return this.raw.getImageData(
      this.safeCoord(sx),
      this.safeCoord(sy),
      this.safeCoord(sw),
      this.safeCoord(sh),
      settings
    );
  }

  putImageData(imagedata: ImageData, dx: number, dy: number): void {
    this.raw.putImageData(imagedata, this.safeCoord(dx), this.safeCoord(dy));
  }

  // --- PROPERTY GETTERS & SETTERS ---
  get fillStyle(): string | CanvasGradient | CanvasPattern {
    return this.raw.fillStyle;
  }

  set fillStyle(val: string | CanvasGradient | CanvasPattern) {
    this.raw.fillStyle = val;
  }

  get strokeStyle(): string | CanvasGradient | CanvasPattern {
    return this.raw.strokeStyle;
  }

  set strokeStyle(val: string | CanvasGradient | CanvasPattern) {
    this.raw.strokeStyle = val;
  }

  get lineWidth(): number {
    return this.raw.lineWidth;
  }

  set lineWidth(val: number) {
    this.raw.lineWidth = Math.max(0.1, this.safeCoord(val, 1));
  }

  get lineCap(): CanvasLineCap {
    return this.raw.lineCap;
  }

  set lineCap(val: CanvasLineCap) {
    this.raw.lineCap = val;
  }

  get lineJoin(): CanvasLineJoin {
    return this.raw.lineJoin;
  }

  set lineJoin(val: CanvasLineJoin) {
    this.raw.lineJoin = val;
  }

  get miterLimit(): number {
    return this.raw.miterLimit;
  }

  set miterLimit(val: number) {
    this.raw.miterLimit = this.safeCoord(val, 10);
  }

  get globalAlpha(): number {
    return this.raw.globalAlpha;
  }

  set globalAlpha(val: number) {
    this.raw.globalAlpha = Math.min(1, Math.max(0, this.safeCoord(val, 1)));
  }

  get globalCompositeOperation(): GlobalCompositeOperation {
    return this.raw.globalCompositeOperation;
  }

  set globalCompositeOperation(val: GlobalCompositeOperation) {
    this.raw.globalCompositeOperation = val;
  }

  get font(): string {
    return this.raw.font;
  }

  set font(val: string) {
    this.raw.font = val;
  }

  get textAlign(): CanvasTextAlign {
    return this.raw.textAlign;
  }

  set textAlign(val: CanvasTextAlign) {
    this.raw.textAlign = val;
  }

  get textBaseline(): CanvasTextBaseline {
    return this.raw.textBaseline;
  }

  set textBaseline(val: CanvasTextBaseline) {
    this.raw.textBaseline = val;
  }

  get shadowColor(): string {
    return this.raw.shadowColor;
  }

  set shadowColor(val: string) {
    this.raw.shadowColor = val;
  }

  get shadowBlur(): number {
    return this.raw.shadowBlur;
  }

  set shadowBlur(val: number) {
    this.raw.shadowBlur = Math.max(0, this.safeCoord(val, 0));
  }

  get shadowOffsetX(): number {
    return this.raw.shadowOffsetX;
  }

  set shadowOffsetX(val: number) {
    this.raw.shadowOffsetX = this.safeCoord(val, 0);
  }

  get shadowOffsetY(): number {
    return this.raw.shadowOffsetY;
  }

  set shadowOffsetY(val: number) {
    this.raw.shadowOffsetY = this.safeCoord(val, 0);
  }

  get filter(): string {
    return this.raw.filter;
  }

  set filter(val: string) {
    this.raw.filter = val;
  }

  get letterSpacing(): string {
    return (this.raw as unknown as { letterSpacing?: string }).letterSpacing ?? '0px';
  }

  set letterSpacing(val: string) {
    if ('letterSpacing' in this.raw) {
      (this.raw as unknown as { letterSpacing: string }).letterSpacing = val;
    }
  }
}

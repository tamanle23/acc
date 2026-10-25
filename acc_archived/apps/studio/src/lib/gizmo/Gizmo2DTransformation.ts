import { Pt } from 'pts';

export type TransformHandleType =
  | 'body'
  | 'rotate'
  | 'tl' // top-left
  | 'tc' // top-center
  | 'tr' // top-right
  | 'ml' // middle-left
  | 'mr' // middle-right
  | 'bl' // bottom-left
  | 'bc' // bottom-center
  | 'br'; // bottom-right

export interface BoundingBox2D {
  x: number; // normalized center X (0.0 to 1.0)
  y: number; // normalized center Y (0.0 to 1.0)
  width: number; // normalized width (0.0 to 1.0)
  height: number; // normalized height (0.0 to 1.0)
  rotation: number; // rotation in degrees
}

export interface SnappingGuide {
  id: string;
  type: 'centerX' | 'centerY' | 'safe16_9' | 'safe9_16' | 'edge';
  orientation: 'horizontal' | 'vertical';
  position: number; // normalized coordinate (0.0 to 1.0)
  label: string;
}

export interface SnapResult {
  x: number;
  y: number;
  snappedX: boolean;
  snappedY: boolean;
  activeGuides: SnappingGuide[];
}

export class MagneticSnapEngine {
  public static readonly DEFAULT_THRESHOLD = 0.018; // ~1.8% of viewport

  public static getStandardGuides(): SnappingGuide[] {
    return [
      { id: 'center-x', type: 'centerX', orientation: 'vertical', position: 0.5, label: 'Center X' },
      { id: 'center-y', type: 'centerY', orientation: 'horizontal', position: 0.5, label: 'Center Y' },
      // 16:9 Title Safe Area (10% margin)
      { id: 'safe16_9-left', type: 'safe16_9', orientation: 'vertical', position: 0.10, label: 'Safe 16:9 Left' },
      { id: 'safe16_9-right', type: 'safe16_9', orientation: 'vertical', position: 0.90, label: 'Safe 16:9 Right' },
      { id: 'safe16_9-top', type: 'safe16_9', orientation: 'horizontal', position: 0.10, label: 'Safe 16:9 Top' },
      { id: 'safe16_9-bottom', type: 'safe16_9', orientation: 'horizontal', position: 0.90, label: 'Safe 16:9 Bottom' },
      // 9:16 Vertical Safe Area (Reels/TikTok: top 15%, bottom 20%, sides 6%)
      { id: 'safe9_16-top', type: 'safe9_16', orientation: 'horizontal', position: 0.15, label: 'Safe 9:16 Top' },
      { id: 'safe9_16-bottom', type: 'safe9_16', orientation: 'horizontal', position: 0.80, label: 'Safe 9:16 Bottom' },
      { id: 'safe9_16-left', type: 'safe9_16', orientation: 'vertical', position: 0.06, label: 'Safe 9:16 Left' },
      { id: 'safe9_16-right', type: 'safe9_16', orientation: 'vertical', position: 0.94, label: 'Safe 9:16 Right' },
    ];
  }

  public static snap(
    x: number,
    y: number,
    width: number,
    height: number,
    threshold: number = MagneticSnapEngine.DEFAULT_THRESHOLD,
    disabled: boolean = false
  ): SnapResult {
    if (disabled) {
      return { x, y, snappedX: false, snappedY: false, activeGuides: [] };
    }

    const guides = MagneticSnapEngine.getStandardGuides();
    const activeGuides: SnappingGuide[] = [];

    let snappedX = false;
    let snappedY = false;
    let finalX = x;
    let finalY = y;

    const halfW = width / 2;
    const halfH = height / 2;

    const left = x - halfW;
    const right = x + halfW;
    const top = y - halfH;
    const bottom = y + halfH;

    for (const guide of guides) {
      if (guide.orientation === 'vertical' && !snappedX) {
        if (Math.abs(x - guide.position) < threshold) {
          finalX = guide.position;
          snappedX = true;
          activeGuides.push(guide);
        } else if (Math.abs(left - guide.position) < threshold) {
          finalX = guide.position + halfW;
          snappedX = true;
          activeGuides.push(guide);
        } else if (Math.abs(right - guide.position) < threshold) {
          finalX = guide.position - halfW;
          snappedX = true;
          activeGuides.push(guide);
        }
      } else if (guide.orientation === 'horizontal' && !snappedY) {
        if (Math.abs(y - guide.position) < threshold) {
          finalY = guide.position;
          snappedY = true;
          activeGuides.push(guide);
        } else if (Math.abs(top - guide.position) < threshold) {
          finalY = guide.position + halfH;
          snappedY = true;
          activeGuides.push(guide);
        } else if (Math.abs(bottom - guide.position) < threshold) {
          finalY = guide.position - halfH;
          snappedY = true;
          activeGuides.push(guide);
        }
      }
    }

    return {
      x: finalX,
      y: finalY,
      snappedX,
      snappedY,
      activeGuides,
    };
  }
}

/**
 * Gizmo2DTransformation (formerly CanvasTransformOverlay):
 * High-performance 2D vector selection layer rendered directly via standard HTML5 2D Context
 * and Pts.js geometry. Provides 8-point bounding box handles, rotation stem, and magnetic snapping.
 */
export class Gizmo2DTransformation {
  public static readonly HANDLE_RADIUS = 0.015; // normalized ~1.5%
  public static readonly ROTATION_STEM_OFFSET = 0.045; // normalized ~4.5%

  private visible: boolean = false;
  private currentBox: BoundingBox2D | null = null;
  private activeGuides: SnappingGuide[] = [];
  private activeHandle: TransformHandleType | null = null;
  private dragMode: 'move' | 'resize' | 'rotate' | null = null;

  constructor() {}

  public setVisible(visible: boolean): void {
    this.visible = visible;
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public get rootGroup(): { visible: boolean } {
    return { visible: this.visible };
  }

  public setActiveInteraction(
    handle: TransformHandleType | null,
    dragMode: 'move' | 'resize' | 'rotate' | null = null
  ): void {
    this.activeHandle = handle;
    this.dragMode = dragMode;
  }

  public update(box: BoundingBox2D | null, activeGuides: SnappingGuide[] = []): void {
    if (box) {
      this.visible = true;
    }
    this.currentBox = box ? { ...box } : null;
    this.activeGuides = [...activeGuides];
  }

  /**
   * Dedicated 2D vector snapping guide renderer (no 3D gizmos or scale handles).
   */
  public renderGuides(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    guides: SnappingGuide[] = this.activeGuides
  ): void {
    if (!guides || guides.length === 0) return;

    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);

    for (const guide of guides) {
      if (guide.type === 'centerX' || guide.type === 'centerY') {
        ctx.strokeStyle = '#00ffff'; // Neon cyan for center crosshairs
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 8;
      } else {
        ctx.strokeStyle = '#ec4899'; // Neon pink for safe margins
        ctx.shadowColor = '#ec4899';
        ctx.shadowBlur = 6;
      }

      ctx.beginPath();
      if (guide.orientation === 'vertical') {
        const gx = guide.position * canvasWidth;
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, canvasHeight);
      } else {
        const gy = guide.position * canvasHeight;
        ctx.moveTo(0, gy);
        ctx.lineTo(canvasWidth, gy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  public render(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    box: BoundingBox2D | null = this.currentBox,
    guides: SnappingGuide[] = this.activeGuides
  ): void {
    if (!this.visible || !box) return;

    ctx.save();

    // 1. Render Active Magnetic Snapping Guides
    if (guides && guides.length > 0) {
      this.renderGuides(ctx, canvasWidth, canvasHeight, guides);
    }

    // 2. Setup Coordinate Transform for Box
    const cx = box.x * canvasWidth;
    const cy = box.y * canvasHeight;
    const w = box.width * canvasWidth;
    const h = box.height * canvasHeight;
    const halfW = w / 2;
    const halfH = h / 2;

    ctx.translate(cx, cy);
    ctx.rotate((box.rotation * Math.PI) / 180);

    // Center Pivot Anchor Crosshair
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1;
    const anchorSize = 6;
    ctx.beginPath();
    ctx.moveTo(-anchorSize, 0);
    ctx.lineTo(anchorSize, 0);
    ctx.moveTo(0, -anchorSize);
    ctx.lineTo(0, anchorSize);
    ctx.stroke();
    ctx.restore();

    // 3. Draw Bounding Box Line Loop
    ctx.strokeStyle = '#38bdf8'; // Sky cyan
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.4)';
    ctx.shadowBlur = 6;
    ctx.strokeRect(-halfW, -halfH, w, h);

    // 4. Draw Rotation Stem & Knob
    const stemOffsetPx = Gizmo2DTransformation.ROTATION_STEM_OFFSET * canvasHeight;
    const knobY = -halfH - stemOffsetPx;

    ctx.beginPath();
    ctx.moveTo(0, -halfH);
    ctx.lineTo(0, knobY);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Rotation Knob
    const knobRadius = 6.5;
    ctx.beginPath();
    ctx.arc(0, knobY, knobRadius, 0, Math.PI * 2);
    ctx.fillStyle = this.activeHandle === 'rotate' ? '#38bdf8' : '#0284c7';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Floating Angle Readout Badge (when rotating)
    if (this.dragMode === 'rotate' || this.activeHandle === 'rotate') {
      ctx.save();
      const badgeText = `${box.rotation.toFixed(1)}°`;
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      const textWidth = ctx.measureText(badgeText).width;
      const badgeW = textWidth + 14;
      const badgeH = 20;
      const badgeX = -badgeW / 2;
      const badgeY = knobY - 26;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4) : ctx.rect(badgeX, badgeY, badgeW, badgeH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, 0, badgeY + badgeH / 2);
      ctx.restore();
    }

    // 5. Draw 8 Scale Handles
    const handlePositions: Array<[number, number, TransformHandleType]> = [
      [-halfW, -halfH, 'tl'],
      [0, -halfH, 'tc'],
      [halfW, -halfH, 'tr'],
      [-halfW, 0, 'ml'],
      [halfW, 0, 'mr'],
      [-halfW, halfH, 'bl'],
      [0, halfH, 'bc'],
      [halfW, halfH, 'br'],
    ];

    const handleSize = 8;
    const halfHandle = handleSize / 2;

    for (const [hx, hy, hType] of handlePositions) {
      const isCurrentActive = this.activeHandle === hType;
      ctx.fillStyle = isCurrentActive ? '#38bdf8' : '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.fillRect(hx - halfHandle, hy - halfHandle, handleSize, handleSize);

      ctx.strokeStyle = isCurrentActive ? '#ffffff' : '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hx - halfHandle, hy - halfHandle, handleSize, handleSize);
    }

    // Floating Dimension Readout Badge (when resizing)
    const isResizing =
      this.dragMode === 'resize' ||
      (this.activeHandle && this.activeHandle !== 'body' && this.activeHandle !== 'rotate');
    if (isResizing) {
      ctx.save();
      const pxW = Math.round(box.width * canvasWidth);
      const pxH = Math.round(box.height * canvasHeight);
      const dimText = `${pxW} × ${pxH}`;
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      const dimTextW = ctx.measureText(dimText).width;
      const dimBadgeW = dimTextW + 16;
      const dimBadgeH = 20;
      const dimBadgeX = -dimBadgeW / 2;
      const dimBadgeY = halfH + 14;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(dimBadgeX, dimBadgeY, dimBadgeW, dimBadgeH, 4) : ctx.rect(dimBadgeX, dimBadgeY, dimBadgeW, dimBadgeH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dimText, 0, dimBadgeY + dimBadgeH / 2);
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Fast hit-test resolving which handle or element region was clicked.
   * Input: normalized pointer coordinates [0, 1].
   */
  public hitTest(
    pointerNormX: number,
    pointerNormY: number,
    box: BoundingBox2D = this.currentBox || { x: 0.5, y: 0.5, width: 0.5, height: 0.5, rotation: 0 }
  ): TransformHandleType | null {
    const dx = pointerNormX - box.x;
    const dy = pointerNormY - box.y;
    const rad = (-box.rotation * Math.PI) / 180;

    const pt = new Pt(dx, dy);
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);
    const localX = pt.x * cosR - pt.y * sinR;
    const localY = pt.x * sinR + pt.y * cosR;

    const halfW = box.width / 2;
    const halfH = box.height / 2;
    const r = Gizmo2DTransformation.HANDLE_RADIUS;

    // 1. Check Rotation Knob
    const knobLocalY = -halfH - Gizmo2DTransformation.ROTATION_STEM_OFFSET;
    if (Math.hypot(localX - 0, localY - knobLocalY) <= r * 1.5) {
      return 'rotate';
    }

    // 2. Check 8 Handles
    const handlePositions: Array<[TransformHandleType, number, number]> = [
      ['tl', -halfW, -halfH],
      ['tc', 0, -halfH],
      ['tr', halfW, -halfH],
      ['ml', -halfW, 0],
      ['mr', halfW, 0],
      ['bl', -halfW, halfH],
      ['bc', 0, halfH],
      ['br', halfW, halfH],
    ];

    for (const [handleType, hx, hy] of handlePositions) {
      if (Math.hypot(localX - hx, localY - hy) <= r * 1.2) {
        return handleType;
      }
    }

    // 3. Check Inside Box Body
    if (Math.abs(localX) <= halfW && Math.abs(localY) <= halfH) {
      return 'body';
    }

    return null;
  }

  public static computeDragTransform(
    startBox: BoundingBox2D,
    handle: TransformHandleType,
    currentPointer: { x: number; y: number },
    startPointer: { x: number; y: number },
    lockAspectRatio: boolean = false,
    disableSnapping: boolean = false
  ): { box: BoundingBox2D; snapResult?: SnapResult } {
    if (handle === 'body') {
      const deltaX = currentPointer.x - startPointer.x;
      const deltaY = currentPointer.y - startPointer.y;
      const proposedX = startBox.x + deltaX;
      const proposedY = startBox.y + deltaY;

      const snapResult = MagneticSnapEngine.snap(
        proposedX,
        proposedY,
        startBox.width,
        startBox.height,
        MagneticSnapEngine.DEFAULT_THRESHOLD,
        disableSnapping
      );

      return {
        box: {
          ...startBox,
          x: snapResult.x,
          y: snapResult.y,
        },
        snapResult,
      };
    }

    if (handle === 'rotate') {
      const currentAngleRad = Math.atan2(currentPointer.y - startBox.y, currentPointer.x - startBox.x);
      const startAngleRad = Math.atan2(startPointer.y - startBox.y, startPointer.x - startBox.x);

      let deltaDeg = ((currentAngleRad - startAngleRad) * 180) / Math.PI;
      let newRot = (startBox.rotation + deltaDeg) % 360;
      if (newRot < 0) newRot += 360;

      // 15-degree magnetic rotation snapping
      if (!disableSnapping) {
        const snapThreshold = 4.0;
        const nearest15 = Math.round(newRot / 15) * 15;
        if (Math.abs(newRot - nearest15) < snapThreshold) {
          newRot = nearest15 % 360;
        }
      }

      return {
        box: {
          ...startBox,
          rotation: Math.round(newRot * 10) / 10,
        },
      };
    }

    // Scale / Resize Handle Dragging
    const rad = (-startBox.rotation * Math.PI) / 180;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);

    const curDx = currentPointer.x - startBox.x;
    const curDy = currentPointer.y - startBox.y;
    const curLocalX = curDx * cosR - curDy * sinR;
    const curLocalY = curDx * sinR + curDy * cosR;

    const startDx = startPointer.x - startBox.x;
    const startDy = startPointer.y - startBox.y;
    const startLocalX = startDx * cosR - startDy * sinR;
    const startLocalY = startDx * sinR + startDy * cosR;

    const deltaLocalX = curLocalX - startLocalX;
    const deltaLocalY = curLocalY - startLocalY;

    let newWidth = startBox.width;
    let newHeight = startBox.height;

    switch (handle) {
      case 'br':
        newWidth = Math.max(0.04, startBox.width + deltaLocalX * 2);
        newHeight = Math.max(0.04, startBox.height + deltaLocalY * 2);
        break;
      case 'bl':
        newWidth = Math.max(0.04, startBox.width - deltaLocalX * 2);
        newHeight = Math.max(0.04, startBox.height + deltaLocalY * 2);
        break;
      case 'tr':
        newWidth = Math.max(0.04, startBox.width + deltaLocalX * 2);
        newHeight = Math.max(0.04, startBox.height - deltaLocalY * 2);
        break;
      case 'tl':
        newWidth = Math.max(0.04, startBox.width - deltaLocalX * 2);
        newHeight = Math.max(0.04, startBox.height - deltaLocalY * 2);
        break;
      case 'mr':
        newWidth = Math.max(0.04, startBox.width + deltaLocalX * 2);
        break;
      case 'ml':
        newWidth = Math.max(0.04, startBox.width - deltaLocalX * 2);
        break;
      case 'bc':
        newHeight = Math.max(0.04, startBox.height + deltaLocalY * 2);
        break;
      case 'tc':
        newHeight = Math.max(0.04, startBox.height - deltaLocalY * 2);
        break;
    }

    if (lockAspectRatio) {
      const origAspect = startBox.width / Math.max(0.001, startBox.height);
      if (handle === 'mr' || handle === 'ml') {
        newHeight = newWidth / origAspect;
      } else {
        newWidth = newHeight * origAspect;
      }
    }

    return {
      box: {
        ...startBox,
        width: Math.round(newWidth * 1000) / 1000,
        height: Math.round(newHeight * 1000) / 1000,
      },
    };
  }

  public dispose(): void {
    this.currentBox = null;
    this.activeGuides = [];
  }
}

// Backward compatibility alias for transition
export { Gizmo2DTransformation as CanvasTransformOverlay };

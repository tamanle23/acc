import * as THREE from 'three';
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

    const guides = this.getStandardGuides();
    const activeGuides: SnappingGuide[] = [];
    let snappedX = x;
    let hasSnappedX = false;
    let snappedY = y;
    let hasSnappedY = false;

    // Test points for X axis: center, left edge, right edge
    const xCandidates = [
      { val: x, offset: 0 },
      { val: x - width / 2, offset: width / 2 },
      { val: x + width / 2, offset: -width / 2 },
    ];

    for (const guide of guides.filter((g) => g.orientation === 'vertical')) {
      for (const cand of xCandidates) {
        if (Math.abs(cand.val - guide.position) <= threshold) {
          snappedX = guide.position + cand.offset;
          hasSnappedX = true;
          activeGuides.push(guide);
          break;
        }
      }
      if (hasSnappedX) break;
    }

    // Test points for Y axis: center, top edge, bottom edge
    const yCandidates = [
      { val: y, offset: 0 },
      { val: y - height / 2, offset: height / 2 },
      { val: y + height / 2, offset: -height / 2 },
    ];

    for (const guide of guides.filter((g) => g.orientation === 'horizontal')) {
      for (const cand of yCandidates) {
        if (Math.abs(cand.val - guide.position) <= threshold) {
          snappedY = guide.position + cand.offset;
          hasSnappedY = true;
          activeGuides.push(guide);
          break;
        }
      }
      if (hasSnappedY) break;
    }

    return {
      x: snappedX,
      y: snappedY,
      snappedX: hasSnappedX,
      snappedY: hasSnappedY,
      activeGuides,
    };
  }
}

/**
 * CanvasTransformOverlay:
 * High-performance in-canvas 2D vector transform and direct staging layer.
 * Manages 8-point bounding boxes, rotation stems, raycast hit testing, and magnetic snapping.
 */
export class CanvasTransformOverlay {
  public rootGroup: THREE.Group;
  private boxLine: THREE.LineLoop;
  private handlesGroup: THREE.Group;
  private guidesLineSegments: THREE.LineSegments;
  private stemLine: THREE.Line;
  private rotateKnob: THREE.Mesh;

  private currentBox: BoundingBox2D | null = null;
  private activeGuides: SnappingGuide[] = [];

  public static readonly ROTATION_STEM_OFFSET = 0.05; // 5% height above top edge
  public static readonly HANDLE_RADIUS = 0.024; // Normalized handle hit radius

  constructor() {
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'CanvasTransformOverlay';

    // 1. Bounding Box Line
    const boxGeometry = new THREE.BufferGeometry();
    const boxPositions = new Float32Array(12); // 4 points * 3 coords
    boxGeometry.setAttribute('position', new THREE.BufferAttribute(boxPositions, 3));
    const boxMaterial = new THREE.LineBasicMaterial({
      color: 0x6366f1, // Indigo 500
      linewidth: 2,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    });
    this.boxLine = new THREE.LineLoop(boxGeometry, boxMaterial);
    this.rootGroup.add(this.boxLine);

    // 2. Handles Group
    this.handlesGroup = new THREE.Group();
    this.rootGroup.add(this.handlesGroup);

    // Rotation Stem Line
    const stemGeom = new THREE.BufferGeometry();
    stemGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const stemMat = new THREE.LineBasicMaterial({
      color: 0x6366f1,
      linewidth: 1.5,
      depthTest: false,
    });
    this.stemLine = new THREE.Line(stemGeom, stemMat);
    this.handlesGroup.add(this.stemLine);

    // Rotation Knob Mesh
    const knobGeom = new THREE.CircleGeometry(0.014, 16);
    const knobMat = new THREE.MeshBasicMaterial({
      color: 0x4f46e5,
      depthTest: false,
    });
    this.rotateKnob = new THREE.Mesh(knobGeom, knobMat);
    this.handlesGroup.add(this.rotateKnob);

    // 8 Bounding Handles (4 corners + 4 edges)
    const handleNames: TransformHandleType[] = ['tl', 'tc', 'tr', 'ml', 'mr', 'bl', 'bc', 'br'];
    const handleGeom = new THREE.PlaneGeometry(0.02, 0.02);
    const handleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      depthTest: false,
      side: THREE.DoubleSide,
    });

    for (const name of handleNames) {
      const handleMesh = new THREE.Mesh(handleGeom.clone(), handleMat.clone());
      handleMesh.name = `handle-${name}`;
      this.handlesGroup.add(handleMesh);
    }

    // 3. Magnetic Snapping Guidelines LineSegments
    const maxGuides = 10;
    const guidesGeom = new THREE.BufferGeometry();
    const guidesPositions = new Float32Array(maxGuides * 2 * 3); // max 10 lines * 2 vertices * 3
    guidesGeom.setAttribute('position', new THREE.BufferAttribute(guidesPositions, 3));
    const guidesMat = new THREE.LineBasicMaterial({
      color: 0x06b6d4, // Cyan 500
      linewidth: 1.5,
      depthTest: false,
      transparent: true,
      opacity: 0.85,
    });
    this.guidesLineSegments = new THREE.LineSegments(guidesGeom, guidesMat);
    this.rootGroup.add(this.guidesLineSegments);

    this.rootGroup.visible = false;
  }

  public setVisible(visible: boolean): void {
    this.rootGroup.visible = visible;
  }

  public isVisible(): boolean {
    return this.rootGroup.visible;
  }

  /**
   * Updates the overlay with the current active bounding box and snapping guidelines.
   * Coordinates in normalized canvas space [0, 1].
   */
  public update(box: BoundingBox2D | null, activeGuides: SnappingGuide[] = []): void {
    this.currentBox = box;
    this.activeGuides = activeGuides;

    if (!box) {
      this.rootGroup.visible = false;
      return;
    }

    this.rootGroup.visible = true;

    // Convert normalized [0, 1] to Three.js Orthographic space [-1, 1]
    // Normalized (0,0) is top-left -> Three.js (-1, 1)
    const toThreeX = (normX: number) => (normX - 0.5) * 2;
    const toThreeY = (normY: number) => (0.5 - normY) * 2;
    const toThreeW = (normW: number) => normW * 2;
    const toThreeH = (normH: number) => normH * 2;

    const cx = toThreeX(box.x);
    const cy = toThreeY(box.y);
    const halfW = toThreeW(box.width) / 2;
    const halfH = toThreeH(box.height) / 2;
    const rad = (-box.rotation * Math.PI) / 180; // Negative because Y is flipped

    // Helper to rotate local offset around (cx, cy)
    const rotatePt = (lx: number, ly: number): [number, number] => {
      const rx = lx * Math.cos(rad) - ly * Math.sin(rad);
      const ry = lx * Math.sin(rad) + ly * Math.cos(rad);
      return [cx + rx, cy + ry];
    };

    // 1. Update Box Line vertices (tl -> tr -> br -> bl)
    const [p0x, p0y] = rotatePt(-halfW, halfH);  // Top-Left in 3D
    const [p1x, p1y] = rotatePt(halfW, halfH);   // Top-Right in 3D
    const [p2x, p2y] = rotatePt(halfW, -halfH);  // Bottom-Right in 3D
    const [p3x, p3y] = rotatePt(-halfW, -halfH); // Bottom-Left in 3D

    const boxPositions = this.boxLine.geometry.attributes.position as THREE.BufferAttribute;
    const boxArr = boxPositions.array as Float32Array;
    boxArr[0] = p0x; boxArr[1] = p0y; boxArr[2] = 0.05;
    boxArr[3] = p1x; boxArr[4] = p1y; boxArr[5] = 0.05;
    boxArr[6] = p2x; boxArr[7] = p2y; boxArr[8] = 0.05;
    boxArr[9] = p3x; boxArr[10] = p3y; boxArr[11] = 0.05;
    boxPositions.needsUpdate = true;

    // 2. Update 8 Handles positions
    const handleCoordMap: Record<string, [number, number]> = {
      'handle-tl': rotatePt(-halfW, halfH),
      'handle-tc': rotatePt(0, halfH),
      'handle-tr': rotatePt(halfW, halfH),
      'handle-ml': rotatePt(-halfW, 0),
      'handle-mr': rotatePt(halfW, 0),
      'handle-bl': rotatePt(-halfW, -halfH),
      'handle-bc': rotatePt(0, -halfH),
      'handle-br': rotatePt(halfW, -halfH),
    };

    for (const child of this.handlesGroup.children) {
      if (child.name.startsWith('handle-')) {
        const coords = handleCoordMap[child.name];
        if (coords) {
          child.position.set(coords[0], coords[1], 0.06);
          child.rotation.z = rad;
        }
      }
    }

    // 3. Update Rotation Stem & Knob
    const [tcX, tcY] = rotatePt(0, halfH);
    const [knobX, knobY] = rotatePt(0, halfH + toThreeH(CanvasTransformOverlay.ROTATION_STEM_OFFSET));

    const stemPositions = this.stemLine.geometry.attributes.position as THREE.BufferAttribute;
    const stemArr = stemPositions.array as Float32Array;
    stemArr[0] = tcX; stemArr[1] = tcY; stemArr[2] = 0.05;
    stemArr[3] = knobX; stemArr[4] = knobY; stemArr[5] = 0.05;
    stemPositions.needsUpdate = true;

    this.rotateKnob.position.set(knobX, knobY, 0.06);

    // 4. Update Magnetic Guidelines
    const guideAttr = this.guidesLineSegments.geometry.attributes.position as THREE.BufferAttribute;
    const guideArr = guideAttr.array as Float32Array;
    let guideIdx = 0;

    for (const guide of activeGuides) {
      if (guideIdx >= guideArr.length - 6) break;
      if (guide.orientation === 'vertical') {
        const gx = toThreeX(guide.position);
        guideArr[guideIdx++] = gx; guideArr[guideIdx++] = 1.0; guideArr[guideIdx++] = 0.04;
        guideArr[guideIdx++] = gx; guideArr[guideIdx++] = -1.0; guideArr[guideIdx++] = 0.04;
      } else {
        const gy = toThreeY(guide.position);
        guideArr[guideIdx++] = -1.0; guideArr[guideIdx++] = gy; guideArr[guideIdx++] = 0.04;
        guideArr[guideIdx++] = 1.0; guideArr[guideIdx++] = gy; guideArr[guideIdx++] = 0.04;
      }
    }

    // Zero out unused guide vertices
    while (guideIdx < guideArr.length) {
      guideArr[guideIdx++] = 0;
    }
    guideAttr.needsUpdate = true;
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
    // Un-rotate pointer around box center into local box space using pts.js Pt
    const dx = pointerNormX - box.x;
    const dy = pointerNormY - box.y;
    const rad = (-box.rotation * Math.PI) / 180;

    const pt = new Pt(dx, dy);
    // Un-rotate: [x * cos(-rad) - y * sin(-rad), x * sin(-rad) + y * cos(-rad)]
    const cosR = Math.cos(-rad);
    const sinR = Math.sin(-rad);
    const localX = pt.x * cosR - pt.y * sinR;
    const localY = pt.x * sinR + pt.y * cosR;

    const halfW = box.width / 2;
    const halfH = box.height / 2;
    const r = CanvasTransformOverlay.HANDLE_RADIUS;

    // 1. Check Rotation Knob (top center + stem offset)
    const knobLocalY = -halfH - CanvasTransformOverlay.ROTATION_STEM_OFFSET;
    if (Math.hypot(localX - 0, localY - knobLocalY) <= r * 1.2) {
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
      if (Math.hypot(localX - hx, localY - hy) <= r) {
        return handleType;
      }
    }

    // 3. Check Inside Box Body
    if (Math.abs(localX) <= halfW && Math.abs(localY) <= halfH) {
      return 'body';
    }

    return null;
  }

  /**
   * Computes the new transform resulting from a pointer drag operation.
   */
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
      // Calculate angle from box center to current pointer
      const dx = currentPointer.x - startBox.x;
      const dy = currentPointer.y - startBox.y;
      // In normalized coordinates, Y is downwards, so angle 0 is up when -dy
      const angleRad = Math.atan2(dy, dx) + Math.PI / 2;
      let angleDeg = (angleRad * 180) / Math.PI;
      if (angleDeg < 0) angleDeg += 360;

      // Snap to 15-degree increments if Shift is held or within 3 degrees of 0/90/180/270
      for (const card of [0, 90, 180, 270, 360]) {
        if (Math.abs(angleDeg - card) <= 3) {
          angleDeg = card % 360;
          break;
        }
      }

      return {
        box: {
          ...startBox,
          rotation: Math.round(angleDeg),
        },
      };
    }

    // Scale / Stretch handles
    const dx = currentPointer.x - startPointer.x;
    const dy = currentPointer.y - startPointer.y;
    const rad = (-startBox.rotation * Math.PI) / 180;
    const cosR = Math.cos(-rad);
    const sinR = Math.sin(-rad);
    const localDx = dx * cosR - dy * sinR;
    const localDy = dx * sinR + dy * cosR;

    let newWidth = startBox.width;
    let newHeight = startBox.height;
    const minSize = 0.05; // 5% minimum width/height

    switch (handle) {
      case 'mr':
        newWidth = Math.max(minSize, startBox.width + localDx);
        break;
      case 'ml':
        newWidth = Math.max(minSize, startBox.width - localDx);
        break;
      case 'bc':
        newHeight = Math.max(minSize, startBox.height + localDy);
        break;
      case 'tc':
        newHeight = Math.max(minSize, startBox.height - localDy);
        break;
      case 'br':
      case 'tr':
      case 'bl':
      case 'tl': {
        const factorX = handle.includes('r') ? localDx : -localDx;
        const factorY = handle.includes('b') ? localDy : -localDy;
        newWidth = Math.max(minSize, startBox.width + factorX);
        newHeight = Math.max(minSize, startBox.height + factorY);

        if (lockAspectRatio) {
          const aspect = startBox.width / Math.max(0.001, startBox.height);
          const scaledH = newWidth / aspect;
          newHeight = Math.max(minSize, scaledH);
        }
        break;
      }
    }

    return {
      box: {
        ...startBox,
        width: Number(newWidth.toFixed(4)),
        height: Number(newHeight.toFixed(4)),
      },
    };
  }

  public dispose(): void {
    this.boxLine.geometry.dispose();
    (this.boxLine.material as THREE.Material).dispose();
    this.stemLine.geometry.dispose();
    (this.stemLine.material as THREE.Material).dispose();
    this.rotateKnob.geometry.dispose();
    (this.rotateKnob.material as THREE.Material).dispose();
    this.guidesLineSegments.geometry.dispose();
    (this.guidesLineSegments.material as THREE.Material).dispose();

    this.handlesGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose();
        }
      }
    });

    this.rootGroup.clear();
  }
}

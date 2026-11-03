import { describe, it, expect } from 'bun:test';
import {
  MagneticSnapEngine,
  Gizmo2DTransformation,
  type BoundingBox2D,
  type SiblingGuideBox,
} from '../apps/studio/src/lib/gizmo/Gizmo2DTransformation';

describe('Studio Canvas Interaction & Direct Manipulation Suite', () => {
  describe('Pillar 1: Sibling Smart Guides & Magnetic Snapping', () => {
    it('snaps accurately to sibling center X and adds a sibling guide', () => {
      const siblingBoxes: SiblingGuideBox[] = [
        {
          id: 'sib-title-1',
          label: 'Main Title',
          normX: 0.35,
          normY: 0.25,
          normWidth: 0.3,
          normHeight: 0.08,
        },
      ];

      // Proposed box near sibling center X (0.353 vs 0.35, well within default threshold 0.018)
      const res = MagneticSnapEngine.snap(
        0.353,
        0.5,
        0.2,
        0.1,
        MagneticSnapEngine.DEFAULT_THRESHOLD,
        false,
        siblingBoxes
      );

      expect(res.snappedX).toBe(true);
      expect(res.x).toBeCloseTo(0.35, 4);
      expect(res.activeGuides.some((g) => g.type === 'sibling' && g.position === 0.35)).toBe(true);
      expect(res.activeGuides.some((g) => g.label.includes('Main Title'))).toBe(true);
    });

    it('snaps accurately to sibling left edge (flush left alignment)', () => {
      const siblingBoxes: SiblingGuideBox[] = [
        {
          id: 'sib-badge-1',
          label: 'Subtitle Badge',
          normX: 0.5,
          normY: 0.8,
          normWidth: 0.4, // left is 0.5 - 0.2 = 0.3
          normHeight: 0.06,
        },
      ];

      const myWidth = 0.2; // halfW = 0.1
      // For my left edge (x - 0.1) to align with sibling left (0.3), my center x should be 0.4
      // We propose x = 0.408 (my left is 0.308, delta is 0.008 < threshold 0.018)
      const res = MagneticSnapEngine.snap(
        0.408,
        0.2,
        myWidth,
        0.1,
        MagneticSnapEngine.DEFAULT_THRESHOLD,
        false,
        siblingBoxes
      );

      expect(res.snappedX).toBe(true);
      // Center snapped so my left aligns with 0.3 -> final center = 0.4
      expect(res.x).toBeCloseTo(0.4, 3);
      expect(res.activeGuides.some((g) => g.type === 'sibling' && g.position === 0.3)).toBe(true);
    });

    it('bypasses snapping completely when disabled flag is true (Ctrl/Cmd key held)', () => {
      const siblingBoxes: SiblingGuideBox[] = [
        {
          id: 'sib-1',
          label: 'Header',
          normX: 0.5,
          normY: 0.5,
          normWidth: 0.2,
          normHeight: 0.1,
        },
      ];

      const res = MagneticSnapEngine.snap(
        0.505,
        0.505,
        0.2,
        0.1,
        MagneticSnapEngine.DEFAULT_THRESHOLD,
        true, // disabled
        siblingBoxes
      );

      expect(res.snappedX).toBe(false);
      expect(res.snappedY).toBe(false);
      expect(res.x).toBe(0.505);
      expect(res.y).toBe(0.505);
      expect(res.activeGuides).toHaveLength(0);
    });
  });

  describe('Pillar 2: Interactive Anchor Point / Pivot Tool', () => {
    it('calculates anchor displacement accurately in unrotated box space', () => {
      const startBox: BoundingBox2D = {
        x: 0.5,
        y: 0.5,
        width: 0.4, // left: 0.3, right: 0.7
        height: 0.2, // top: 0.4, bottom: 0.6
        rotation: 0,
      };

      // Drag anchor handle from center to right edge (x = 0.7, y = 0.5)
      const resRight = Gizmo2DTransformation.computeDragTransform(
        startBox,
        'anchor',
        { x: 0.7, y: 0.5 },
        { x: 0.5, y: 0.5 }
      );

      expect(resRight.anchorResult).toBeDefined();
      expect(resRight.anchorResult![0]).toBeCloseTo(1.0, 2);
      expect(resRight.anchorResult![1]).toBeCloseTo(0.5, 2);

      // Drag anchor handle to left edge (x = 0.3, y = 0.5)
      const resLeft = Gizmo2DTransformation.computeDragTransform(
        startBox,
        'anchor',
        { x: 0.3, y: 0.5 },
        { x: 0.5, y: 0.5 }
      );

      expect(resLeft.anchorResult![0]).toBeCloseTo(0.0, 2);
      expect(resLeft.anchorResult![1]).toBeCloseTo(0.5, 2);

      // Drag anchor handle outside box (bottom-right offset pivot: x = 0.9, y = 0.7)
      const resOutside = Gizmo2DTransformation.computeDragTransform(
        startBox,
        'anchor',
        { x: 0.9, y: 0.7 },
        { x: 0.5, y: 0.5 }
      );

      expect(resOutside.anchorResult![0]).toBeCloseTo(1.5, 2);
      expect(resOutside.anchorResult![1]).toBeCloseTo(1.5, 2);
    });

    it('calculates anchor displacement accurately on a rotated box', () => {
      const startBox: BoundingBox2D = {
        x: 0.5,
        y: 0.5,
        width: 0.4,
        height: 0.2,
        rotation: 90, // 90 degrees clockwise
      };

      // In a 90-degree rotated box, the local right edge (dx_local = +0.2)
      // corresponds to global deltaY = +0.2 (downwards)
      const resRot = Gizmo2DTransformation.computeDragTransform(
        startBox,
        'anchor',
        { x: 0.5, y: 0.7 }, // pointer down by 0.2
        { x: 0.5, y: 0.5 }
      );

      expect(resRot.anchorResult).toBeDefined();
      expect(resRot.anchorResult![0]).toBeCloseTo(1.0, 2); // local X reached right edge
      expect(resRot.anchorResult![1]).toBeCloseTo(0.5, 2);
    });
  });

  describe('Pillar 3: Pro NLE Canvas Manipulations', () => {
    it('constrains movement strictly to horizontal axis when axisLock is true and dx > dy', () => {
      const startBox: BoundingBox2D = {
        x: 0.5,
        y: 0.5,
        width: 0.2,
        height: 0.1,
        rotation: 0,
      };

      // Pointer moved dx = +0.15, dy = +0.04 (horizontal dominant)
      const res = Gizmo2DTransformation.computeDragTransform(
        startBox,
        'body',
        { x: 0.65, y: 0.54 },
        { x: 0.5, y: 0.5 },
        false,
        true, // disable snapping for pure delta test
        [],
        true,
        true // axisLock enabled
      );

      expect(res.box.x).toBeCloseTo(0.65, 3);
      expect(res.box.y).toBeCloseTo(0.5, 3); // Y delta locked to 0!
    });

    it('constrains movement strictly to vertical axis when axisLock is true and dy > dx', () => {
      const startBox: BoundingBox2D = {
        x: 0.5,
        y: 0.5,
        width: 0.2,
        height: 0.1,
        rotation: 0,
      };

      // Pointer moved dx = +0.02, dy = +0.20 (vertical dominant)
      const res = Gizmo2DTransformation.computeDragTransform(
        startBox,
        'body',
        { x: 0.52, y: 0.7 },
        { x: 0.5, y: 0.5 },
        false,
        true,
        [],
        true,
        true // axisLock enabled
      );

      expect(res.box.x).toBeCloseTo(0.5, 3); // X delta locked to 0!
      expect(res.box.y).toBeCloseTo(0.7, 3);
    });

    it('snaps rotation magnetically to 15-degree increments', () => {
      const startBox: BoundingBox2D = {
        x: 0.5,
        y: 0.5,
        width: 0.2,
        height: 0.1,
        rotation: 0,
      };

      // Drag rotation knob slightly past 15° (e.g. 16.5°)
      // In radians: ~16.5° is x = 0.5 + cos(16.5°)*r, y = 0.5 + sin(16.5°)*r
      const rad16 = (16.2 * Math.PI) / 180;
      const res = Gizmo2DTransformation.computeDragTransform(
        startBox,
        'rotate',
        { x: 0.5 + Math.cos(rad16) * 0.3, y: 0.5 + Math.sin(rad16) * 0.3 },
        { x: 0.8, y: 0.5 }, // start pointer at 0°
        false,
        false
      );

      // Within snap threshold (4°), snaps to 15° exactly
      expect(res.box.rotation).toBe(15);
    });
  });
});

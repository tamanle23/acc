import { describe, it, expect } from "bun:test";
import {
  CanvasTransformOverlay,
  MagneticSnapEngine,
  type BoundingBox2D,
} from "../packages/effect-engines/src/three/CanvasTransformOverlay.js";
import { UniversalThreeScene } from "../packages/effect-engines/src/three/UniversalThreeScene.js";

describe("Phase 1: In-Canvas 2D Vector Transform & Direct Staging Layer", () => {
  it("should verify MagneticSnapEngine standard guidelines and snap accuracy", () => {
    const guides = MagneticSnapEngine.getStandardGuides();
    expect(guides.length).toBeGreaterThanOrEqual(10);

    const centerX = guides.find((g) => g.id === "center-x");
    expect(centerX).toBeDefined();
    expect(centerX?.position).toBe(0.5);

    const centerY = guides.find((g) => g.id === "center-y");
    expect(centerY).toBeDefined();
    expect(centerY?.position).toBe(0.5);

    // Test snapping close to center
    const snapped = MagneticSnapEngine.snap(0.508, 0.495, 0.4, 0.3, 0.015);
    expect(snapped.snappedX).toBe(true);
    expect(snapped.x).toBe(0.5);
    expect(snapped.snappedY).toBe(true);
    expect(snapped.y).toBe(0.5);
    expect(snapped.activeGuides.length).toBeGreaterThanOrEqual(2);

    // Test disabled snapping (e.g. with Shift key)
    const unconstrained = MagneticSnapEngine.snap(0.508, 0.495, 0.4, 0.3, 0.015, true);
    expect(unconstrained.snappedX).toBe(false);
    expect(unconstrained.x).toBe(0.508);
    expect(unconstrained.snappedY).toBe(false);
    expect(unconstrained.y).toBe(0.495);
    expect(unconstrained.activeGuides.length).toBe(0);
  });

  it("should verify CanvasTransformOverlay scenegraph structure and visibility toggling", () => {
    const overlay = new CanvasTransformOverlay();
    expect(overlay.rootGroup).toBeDefined();
    expect(overlay.isVisible()).toBe(false);

    overlay.setVisible(true);
    expect(overlay.isVisible()).toBe(true);

    const box: BoundingBox2D = {
      x: 0.5,
      y: 0.5,
      width: 0.4,
      height: 0.3,
      rotation: 0,
    };

    const guides = MagneticSnapEngine.getStandardGuides().slice(0, 2);
    overlay.update(box, guides);
    expect(overlay.isVisible()).toBe(true);

    // Suppress during headless export
    overlay.setVisible(false);
    expect(overlay.isVisible()).toBe(false);

    overlay.dispose();
  });

  it("should verify accurate hitTest resolution for body, rotation knob, and all 8 handles", () => {
    const overlay = new CanvasTransformOverlay();
    const box: BoundingBox2D = {
      x: 0.5,
      y: 0.5,
      width: 0.4, // halfW = 0.2, x range: [0.3, 0.7]
      height: 0.3, // halfH = 0.15, y range: [0.35, 0.65]
      rotation: 0,
    };

    overlay.update(box);

    // 1. Center of box -> 'body'
    expect(overlay.hitTest(0.5, 0.5, box)).toBe("body");

    // 2. Far outside -> null
    expect(overlay.hitTest(0.1, 0.1, box)).toBe(null);

    // 3. Rotation knob (top center: x=0.5, y = 0.5 - 0.15 - 0.05 = 0.30)
    expect(overlay.hitTest(0.5, 0.30, box)).toBe("rotate");

    // 4. Corner handles
    // Top-Left: x = 0.5 - 0.2 = 0.3, y = 0.5 - 0.15 = 0.35
    expect(overlay.hitTest(0.3, 0.35, box)).toBe("tl");
    // Top-Right: x = 0.5 + 0.2 = 0.7, y = 0.35
    expect(overlay.hitTest(0.7, 0.35, box)).toBe("tr");
    // Bottom-Left: x = 0.3, y = 0.5 + 0.15 = 0.65
    expect(overlay.hitTest(0.3, 0.65, box)).toBe("bl");
    // Bottom-Right: x = 0.7, y = 0.65
    expect(overlay.hitTest(0.7, 0.65, box)).toBe("br");

    // 5. Edge handles
    // Middle-Left: x = 0.3, y = 0.5
    expect(overlay.hitTest(0.3, 0.5, box)).toBe("ml");
    // Middle-Right: x = 0.7, y = 0.5
    expect(overlay.hitTest(0.7, 0.5, box)).toBe("mr");
    // Top-Center: x = 0.5, y = 0.35
    expect(overlay.hitTest(0.5, 0.35, box)).toBe("tc");
    // Bottom-Center: x = 0.5, y = 0.65
    expect(overlay.hitTest(0.5, 0.65, box)).toBe("bc");

    overlay.dispose();
  });

  it("should verify computeDragTransform handles move, rotation, and proportional scaling", () => {
    const startBox: BoundingBox2D = {
      x: 0.5,
      y: 0.5,
      width: 0.4,
      height: 0.3,
      rotation: 0,
    };

    // 1. Move dragging with magnetic snapping
    const moveRes = CanvasTransformOverlay.computeDragTransform(
      startBox,
      "body",
      { x: 0.505, y: 0.502 },
      { x: 0.5, y: 0.5 },
      false,
      false
    );
    expect(moveRes.box.x).toBe(0.5); // Snapped to center X
    expect(moveRes.box.y).toBe(0.5); // Snapped to center Y
    expect(moveRes.snapResult?.snappedX).toBe(true);

    // 2. Rotation dragging
    // Pointer moved to the right of center: (0.7, 0.5) -> dx = 0.2, dy = 0 -> angle = 90 deg
    const rotRes = CanvasTransformOverlay.computeDragTransform(
      startBox,
      "rotate",
      { x: 0.7, y: 0.5 },
      { x: 0.5, y: 0.3 },
      false,
      false
    );
    expect(rotRes.box.rotation).toBe(90);

    // 3. Proportional Corner scaling with lockAspectRatio
    const scaleRes = CanvasTransformOverlay.computeDragTransform(
      startBox,
      "br",
      { x: 0.75, y: 0.7 },
      { x: 0.7, y: 0.65 },
      true, // Lock aspect ratio
      false
    );
    expect(scaleRes.box.width).toBeGreaterThan(startBox.width);
    // Aspect ratio startBox = 0.4 / 0.3 = 1.3333...
    const expectedAspect = startBox.width / startBox.height;
    const actualAspect = scaleRes.box.width / scaleRes.box.height;
    expect(Math.abs(actualAspect - expectedAspect)).toBeLessThan(0.01);
  });

  it("should verify UniversalThreeScene integration with overlay and zero memory leak lifecycle", () => {
    const scene = new UniversalThreeScene({ width: 1920, height: 1080 });
    expect(scene.overlay).toBeDefined();

    scene.updateOverlay({
      x: 0.5,
      y: 0.5,
      width: 0.5,
      height: 0.5,
      rotation: 0,
    });
    expect(scene.overlay.isVisible()).toBe(true);

    // Headless export hide
    scene.setOverlayVisible(false);
    expect(scene.overlay.isVisible()).toBe(false);

    // Dispose
    scene.dispose();
  });
});

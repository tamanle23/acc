import { describe, it, expect, beforeEach } from "bun:test";
import { IRStateManager } from "../apps/studio/src/lib/ir/irState.js";

describe("Phase 2: Deep Collapsible Inspector Panels & 3D Numeric Suite", () => {
  beforeEach(async () => {
    await IRStateManager.getInstance().switchTemplate("scifi");
  });

  it("should update 3D depth relighting parameters in VideoIR via IRStateManager", () => {
    const manager = IRStateManager.getInstance();
    const seqId = "seq-city-intro";

    manager.updateModifier(seqId, "vfx/depth_relighting", {
      enabled: true,
      lightColor: "#ff5500", // Sunset amber
      lightX: 3.5,
      lightY: -1.2,
      lightZ: 6.8,
      diffuse: 1.4,
      specular: 2.1,
      shininess: 64,
      rimIntensity: 1.1,
    });

    const state = manager.getState();
    const seq = state.doc.tracks[0].sequences.find((s) => s.id === seqId);
    expect(seq).toBeDefined();

    const relight = seq?.modifiers?.find((m) => m.type === "vfx/depth_relighting");
    expect(relight).toBeDefined();
    expect(relight?.params.lightColor).toBe("#ff5500");
    expect(relight?.params.lightX).toBe(3.5);
    expect(relight?.params.shininess).toBe(64);
  });

  it("should update 3D camera spline & rack focus parameters and preserve valid DAG compilation", () => {
    const manager = IRStateManager.getInstance();
    const seqId = "seq-city-intro";

    manager.updateModifier(seqId, "camera/3d", {
      enabled: true,
      eyeX: 1.5,
      eyeY: 2.0,
      eyeZ: 12.0,
      targetX: 0.0,
      targetY: 0.5,
      targetZ: -1.0,
      fov: 65,
      roll: -15,
      focalDistance: 3.2,
      focalRange: 1.8,
      bokehRadius: 8.5,
    });

    const state = manager.getState();
    expect(state.error).toBeNull();

    const seq = state.doc.tracks[0].sequences.find((s) => s.id === seqId);
    const camera = seq?.modifiers?.find((m) => m.type === "camera/3d");
    expect(camera).toBeDefined();
    expect(camera?.params.fov).toBe(65);
    expect(camera?.params.focalDistance).toBe(3.2);
    expect(camera?.params.bokehRadius).toBe(8.5);
  });

  it("should update particle VFX simulation physics and post-processing shaders", () => {
    const manager = IRStateManager.getInstance();
    const seqId = "seq-city-intro";

    manager.updateModifier(seqId, "overlay/canvas_particles", {
      enabled: true,
      preset: "matrix_rain",
      particleCount: 5000,
      gravity: -3.5,
      drag: 0.22,
      turbulence: 2.4,
      bloomThreshold: 0.45,
      chromaticAberration: 4.5,
    });

    const state = manager.getState();
    const seq = state.doc.tracks[0].sequences.find((s) => s.id === seqId);
    const particles = seq?.modifiers?.find((m) => m.type === "overlay/canvas_particles");
    expect(particles).toBeDefined();
    expect(particles?.params.preset).toBe("matrix_rain");
    expect(particles?.params.particleCount).toBe(5000);
    expect(particles?.params.chromaticAberration).toBe(4.5);
  });

  it("should update text typography styling and karaoke glow parameters", () => {
    const manager = IRStateManager.getInstance();
    const seqId = "seq-city-intro";

    manager.updateModifier(seqId, "text/style", {
      enabled: true,
      fontFamily: "Outfit",
      fontSize: 36,
      fontWeight: 800,
      letterSpacing: 2.0,
      fillColor: "#facc15",
      glowColor: "#ec4899",
    });

    const state = manager.getState();
    const seq = state.doc.tracks[0].sequences.find((s) => s.id === seqId);
    const textStyle = seq?.modifiers?.find((m) => m.type === "text/style");
    expect(textStyle).toBeDefined();
    expect(textStyle?.params.fontFamily).toBe("Outfit");
    expect(textStyle?.params.fontSize).toBe(36);
    expect(textStyle?.params.glowColor).toBe("#ec4899");
  });

  it("should support removing a modifier and restoring it cleanly via undo", () => {
    const manager = IRStateManager.getInstance();
    const seqId = "seq-city-intro";

    // 1. Add modifier
    manager.updateModifier(seqId, "sfx/dynamic_ducking", {
      duckVolume: 0.15,
      attackMs: 200,
      releaseMs: 500,
      stereoPan: -0.4,
    });

    let seq = manager.getState().doc.tracks[0].sequences.find((s) => s.id === seqId);
    expect(seq?.modifiers?.some((m) => m.type === "sfx/dynamic_ducking")).toBe(true);

    // 2. Remove modifier
    manager.removeModifier(seqId, "sfx/dynamic_ducking");
    seq = manager.getState().doc.tracks[0].sequences.find((s) => s.id === seqId);
    expect(seq?.modifiers?.some((m) => m.type === "sfx/dynamic_ducking")).toBe(false);

    // 3. Undo removal
    manager.undo();
    seq = manager.getState().doc.tracks[0].sequences.find((s) => s.id === seqId);
    expect(seq?.modifiers?.some((m) => m.type === "sfx/dynamic_ducking")).toBe(true);
  });

  it("should ensure no nested buttons or switches are children of AccordionTrigger in RightSidebar", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const rightSidebarPath = path.resolve(__dirname, "../apps/studio/src/components/RightSidebar.tsx");
    const content = fs.readFileSync(rightSidebarPath, "utf-8");

    // Match each <AccordionItem ... </AccordionItem> block
    const itemRegex = /<AccordionItem[\s\S]*?<\/AccordionItem>/g;
    const items = content.match(itemRegex) || [];
    expect(items.length).toBeGreaterThan(0);

    for (const item of items) {
      // Find the <AccordionTrigger ... </AccordionTrigger> block within each item
      const triggerMatch = item.match(/<AccordionTrigger[\s\S]*?<\/AccordionTrigger>/);
      if (!triggerMatch) continue;

      const triggerBlock = triggerMatch[0];

      // In RightSidebar, AccordionTrigger children are the title div block
      // Props end before `<div className="flex items-center gap-1.5">`
      const childrenStartIndex = triggerBlock.indexOf('<div className="flex items-center gap-1.5">');
      expect(childrenStartIndex).toBeGreaterThan(-1);

      const childrenEndIndex = triggerBlock.lastIndexOf('</AccordionTrigger>');
      const innerChildren = triggerBlock.slice(childrenStartIndex, childrenEndIndex);

      // Verify that NO Button or Switch is rendered as a child of AccordionTrigger
      expect(innerChildren).not.toContain("<Button");
      expect(innerChildren).not.toContain("<Switch");
    }
  });
});

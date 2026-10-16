import { describe, it, expect } from 'bun:test';
import { UniversalThreeScene } from '../packages/effect-engines/src/three/UniversalThreeScene';
import * as THREE from 'three';

describe('Phase 1: Shared Isomorphic 3D Engine (UniversalThreeScene & pts.js)', () => {
  it('should initialize UniversalThreeScene with perspective and orthographic cameras', () => {
    const scene = new UniversalThreeScene({ width: 1280, height: 720, fov: 60 });
    expect(scene.scene).toBeDefined();
    expect(scene.camera).toBeDefined();
    expect(scene.orthoCamera).toBeDefined();
    expect(scene.camera.aspect).toBeCloseTo(1280 / 720, 3);
    scene.dispose();
  });

  it('should generate 3D depth displacement mesh and shaders using pts.js vector geometry', () => {
    const scene = new UniversalThreeScene({ width: 1920, height: 1080 });
    scene.initDepthMesh(32, 32, 10, 6);

    expect(scene.scene.children.length).toBeGreaterThan(0);
    const mesh = scene.scene.children[0] as THREE.Mesh;
    expect(mesh.isMesh).toBe(true);
    expect(mesh.geometry).toBeDefined();
    expect((mesh.material as THREE.ShaderMaterial).uniforms.time).toBeDefined();
    scene.dispose();
  });

  it('should generate particle warp tunnel with pts.js cylindrical vector coordinates', () => {
    const scene = new UniversalThreeScene({ width: 800, height: 600 });
    scene.initParticleSystem(100);

    const points = scene.scene.children.find((c) => c instanceof THREE.Points) as THREE.Points;
    expect(points).toBeDefined();
    expect(points.geometry.getAttribute('position').count).toBe(100);

    // Update at time 1.5s
    scene.update(1.5);
    const positions = points.geometry.getAttribute('position') as THREE.BufferAttribute;
    expect(positions.version).toBeGreaterThan(0);

    scene.dispose();
  });

  it('should initialize holographic HUD and update orbital camera path cleanly', () => {
    const scene = new UniversalThreeScene({ width: 1280, height: 720 });
    scene.initHologramHUD(8, 4.5);

    scene.update(2.0, 1.2);
    // Camera orbital motion check
    expect(scene.camera.position.x).not.toBe(0);
    expect(scene.camera.position.z).not.toBe(0);

    scene.resize(1920, 1080);
    expect(scene.camera.aspect).toBeCloseTo(1920 / 1080, 3);

    scene.dispose();
  });
});
